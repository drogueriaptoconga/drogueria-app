const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, execFileSync } = require('child_process');

const PROJECT_ROOT = path.join(__dirname, '..');
const LOGS_DIR = path.join(PROJECT_ROOT, 'logs');
const LOCK_FILE = path.join(LOGS_DIR, 'auto-deploy.lock');
const BACKEND_LOG = path.join(LOGS_DIR, 'backend.log');
const PORT = 3001;
const PREFLIGHT_PORT = 3002;
const BRANCH = 'main';
const REMOTE = 'origin';
const FORCE_RESTART = process.argv.includes('--force-restart');

function log(message) {
    const line = `[${new Date().toISOString()}] ${message}`;
    console.log(line);
}

function run(command, args, options = {}) {
    const { timeout = 10 * 60 * 1000, ...spawnOptions } = options;

    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            cwd: PROJECT_ROOT,
            windowsHide: true,
            ...spawnOptions,
        });

        let stdout = '';
        let stderr = '';
        let settled = false;

        const timer = setTimeout(() => {
            if (settled) return;
            settled = true;
            child.kill('SIGKILL');
            reject(new Error(`${command} ${args.join(' ')} excedio el tiempo maximo de ${timeout} ms`));
        }, timeout);

        child.stdout?.on('data', (chunk) => { stdout += chunk; });
        child.stderr?.on('data', (chunk) => { stderr += chunk; });

        child.on('error', (error) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            reject(error);
        });

        child.on('close', (code) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            if (code === 0) resolve({ stdout, stderr });
            else reject(new Error(`${command} ${args.join(' ')} fallo con codigo ${code}\n${(stderr || stdout).trim()}`));
        });
    });
}

function runSync(command, args, options = {}) {
    return execFileSync(command, args, {
        cwd: PROJECT_ROOT,
        encoding: 'utf8',
        windowsHide: true,
        ...options,
    }).trim();
}

function isProcessRunning(pid) {
    try {
        process.kill(pid, 0);
        return true;
    } catch (_) {
        return false;
    }
}

function acquireLock() {
    fs.mkdirSync(LOGS_DIR, { recursive: true });

    if (fs.existsSync(LOCK_FILE)) {
        const pid = Number(fs.readFileSync(LOCK_FILE, 'utf8').trim());
        if (Number.isInteger(pid) && isProcessRunning(pid)) {
            log(`Ya hay un auto-deploy en curso (PID ${pid}). Se omite esta ejecucion.`);
            return false;
        }
        fs.unlinkSync(LOCK_FILE);
    }

    fs.writeFileSync(LOCK_FILE, String(process.pid), 'utf8');
    return true;
}

function releaseLock() {
    try {
        if (fs.existsSync(LOCK_FILE)) fs.unlinkSync(LOCK_FILE);
    } catch (_) {
        // Sin accion: el siguiente intento limpiara el lock huerfano.
    }
}

async function checkSyntaxFromRemote(changedFiles) {
    const jsFiles = changedFiles.filter(
        (file) => file.endsWith('.js') && !file.startsWith('fronted/') && !file.startsWith('test/')
    );

    for (const file of jsFiles) {
        let content;
        try {
            content = runSync('git', ['show', `${REMOTE}/${BRANCH}:${file}`]);
        } catch (_) {
            continue; // Archivo eliminado en el commit nuevo.
        }

        const temp = path.join(os.tmpdir(), `deploy-check-${process.pid}-${path.basename(file)}`);
        fs.writeFileSync(temp, content, 'utf8');
        try {
            await run(process.execPath, ['--check', temp], { timeout: 60000 });
            log(`Sintaxis OK: ${file}`);
        } finally {
            try { fs.unlinkSync(temp); } catch (_) {}
        }
    }
}

function findListeningPids(port) {
    try {
        const output = runSync('powershell.exe', [
            '-NoProfile',
            '-Command',
            `Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique`,
        ]);
        return output.split(/\r?\n/)
            .map((line) => Number(line.trim()))
            .filter((pid) => Number.isInteger(pid) && pid > 0);
    } catch (_) {
        try {
            const output = runSync('netstat', ['-ano']);
            const pids = output.split(/\r?\n/)
                .filter((line) => line.includes(`:${port}`) && line.toUpperCase().includes('LISTENING'))
                .map((line) => Number(line.trim().split(/\s+/).pop()))
                .filter((pid) => Number.isInteger(pid) && pid > 0);
            return [...new Set(pids)];
        } catch (_) {
            return [];
        }
    }
}

function killPids(pids) {
    for (const pid of pids) {
        try {
            runSync('taskkill', ['/PID', String(pid), '/F']);
            log(`Proceso ${pid} detenido.`);
        } catch (error) {
            log(`No se pudo detener el proceso ${pid}: ${error.message}`);
        }
    }
}

function startBackend(port) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
    const out = fs.openSync(BACKEND_LOG, 'a');
    const err = fs.openSync(BACKEND_LOG, 'a');

    const child = spawn(process.execPath, ['server.js'], {
        cwd: PROJECT_ROOT,
        env: { ...process.env, PORT: String(port) },
        detached: true,
        windowsHide: true,
        stdio: ['ignore', out, err],
    });
    child.unref();

    fs.closeSync(out);
    fs.closeSync(err);
    return child.pid;
}

async function waitForBackend(port, attempts = 30) {
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
        try {
            const response = await fetch(`http://localhost:${port}/api/test`);
            if (response.ok) return true;
        } catch (_) {
            // Reintento.
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    return false;
}

async function preflightBackend() {
    const pids = findListeningPids(PREFLIGHT_PORT);
    if (pids.length) killPids(pids);

    const pid = startBackend(PREFLIGHT_PORT);
    try {
        const ok = await waitForBackend(PREFLIGHT_PORT, 30);
        if (!ok) {
            throw new Error(`El backend nuevo no arranco en el puerto de prueba ${PREFLIGHT_PORT}.`);
        }
        log(`Preflight del backend OK en el puerto ${PREFLIGHT_PORT}.`);
    } finally {
        killPids(findListeningPids(PREFLIGHT_PORT));
        try { process.kill(pid); } catch (_) {}
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }
}

async function restartBackend() {
    await preflightBackend();

    killPids(findListeningPids(PORT));
    await new Promise((resolve) => setTimeout(resolve, 1000));

    for (let attempt = 1; attempt <= 2; attempt += 1) {
        startBackend(PORT);
        if (await waitForBackend(PORT, 20)) {
            log(`Backend reiniciado en el puerto ${PORT}.`);
            return;
        }
        log(`El backend no respondio en el intento ${attempt}. Reintentando...`);
        killPids(findListeningPids(PORT));
        await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    throw new Error(`El backend no respondio en el puerto ${PORT}. Revisa logs/backend.log.`);
}

async function main() {
    if (!acquireLock()) return;

    try {
        log('Inicio de auto-deploy.');

        const status = runSync('git', ['status', '--porcelain', '--untracked-files=no']);
        if (status) {
            log('Hay cambios locales sin commitear. Auto-deploy cancelado.');
            log(status);
            return;
        }

        const branch = runSync('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
        if (branch !== BRANCH) {
            log(`La rama actual es ${branch}, no ${BRANCH}. Auto-deploy cancelado.`);
            return;
        }

        await run('git', ['fetch', REMOTE, BRANCH], { timeout: 120000 });

        const localHead = runSync('git', ['rev-parse', 'HEAD']);
        const remoteHead = runSync('git', ['rev-parse', `${REMOTE}/${BRANCH}`]);

        if (localHead === remoteHead) {
            log('Sin cambios en el repositorio.');
            if (FORCE_RESTART) {
                log('Reinicio forzado solicitado.');
                await restartBackend();
                log('Reinicio forzado completado.');
            }
            return;
        }

        const changedFiles = runSync('git', ['diff', '--name-only', localHead, remoteHead])
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean);

        log(`Cambios detectados: ${changedFiles.length} archivo(s).`);
        log(changedFiles.join(', '));

        log('Validando sintaxis de los archivos JS nuevos...');
        await checkSyntaxFromRemote(changedFiles);

        log('Aplicando cambios...');
        await run('git', ['merge', '--ff-only', `${REMOTE}/${BRANCH}`], { timeout: 120000 });

        const packageChanged = changedFiles.some((file) =>
            ['package.json', 'package-lock.json'].includes(file)
        );
        const frontendPackageChanged = changedFiles.some((file) =>
            ['fronted/package.json', 'fronted/package-lock.json'].includes(file)
        );
        const frontendChanged = changedFiles.some(
            (file) => file.startsWith('fronted/src/') || file === 'fronted/public/index.html'
        );

        if (packageChanged) {
            log('Instalando dependencias del backend...');
            await run('npm.cmd', ['install'], { shell: true });
        }

        if (frontendPackageChanged) {
            log('Instalando dependencias del frontend...');
            await run('npm.cmd', ['install'], {
                shell: true,
                cwd: path.join(PROJECT_ROOT, 'fronted'),
            });
        }

        if (changedFiles.some((file) => file.startsWith('migrations/'))) {
            log('Aplicando migraciones locales...');
            await run(process.execPath, [path.join(PROJECT_ROOT, 'scripts', 'migrate.js'), 'local']);
            log('Aplicando migraciones en Supabase...');
            await run(process.execPath, [path.join(PROJECT_ROOT, 'scripts', 'migrate.js'), 'supabase']);
        }

        if (frontendChanged) {
            log('Compilando frontend para validar...');
            await run('npm.cmd', ['run', 'build'], {
                shell: true,
                cwd: path.join(PROJECT_ROOT, 'fronted'),
            });
        }

        log('Ejecutando tests puros...');
        await run(process.execPath, [
            '--test',
            'test/passwords.test.js',
            'test/productosConflict.test.js',
            'test/roles.test.js',
        ]);

        const backendChanged = changedFiles.some(
            (file) =>
                file === 'server.js' ||
                file === 'db.js' ||
                file.startsWith('routes/') ||
                file.startsWith('middleware/') ||
                file.startsWith('utils/') ||
                ['package.json', 'package-lock.json'].includes(file)
        );

        if (backendChanged || FORCE_RESTART) {
            log('Reiniciando backend...');
            await restartBackend();
        } else {
            log('No se requiere reiniciar el backend.');
        }

        log('Auto-deploy completado.');
    } catch (error) {
        log(`ERROR: ${error.message}`);
        process.exitCode = 1;
    } finally {
        releaseLock();
    }
}

main();
