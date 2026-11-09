const db = require('../db');
const { hashPassword } = require('../utils/passwords');

function promptSecret(prompt) {
    return new Promise((resolve, reject) => {
        const input = process.stdin;
        if (!input.isTTY || typeof input.setRawMode !== 'function') {
            reject(new Error('Ejecuta este comando en una terminal interactiva para ocultar la contraseña.'));
            return;
        }

        let value = '';
        const cleanup = () => {
            input.setRawMode(false);
            input.pause();
            input.removeListener('data', onData);
            process.stdout.write('\n');
        };
        const onData = (character) => {
            if (character === '\u0003') {
                cleanup();
                reject(new Error('Operación cancelada.'));
            } else if (character === '\r' || character === '\n') {
                cleanup();
                resolve(value);
            } else if (character === '\u0008' || character === '\u007f') {
                value = value.slice(0, -1);
            } else if (character >= ' ') {
                value += character;
            }
        };

        process.stdout.write(prompt);
        input.setEncoding('utf8');
        input.setRawMode(true);
        input.resume();
        input.on('data', onData);
    });
}

async function resetAdminPassword() {
    try {
        const admins = await db.query("SELECT id, nombre_usuario FROM usuarios WHERE LOWER(rol) = 'admin'");
        if (admins.rowCount !== 1) {
            throw new Error(`Se esperaba exactamente una cuenta admin y se encontraron ${admins.rowCount}.`);
        }

        const password = await promptSecret('Contraseña temporal admin (mínimo 11 caracteres): ');
        const confirmation = await promptSecret('Repite la contraseña: ');
        if (password.length < 11 || password.length > 128) {
            throw new Error('La contraseña temporal debe tener entre 11 y 128 caracteres.');
        }
        if (password !== confirmation) {
            throw new Error('Las contraseñas no coinciden.');
        }

        await db.query(
            `UPDATE usuarios
             SET contrasena_hash = $1, rol = 'admin', activo = TRUE, debe_cambiar_contrasena = TRUE
             WHERE id = $2`,
            [hashPassword(password), admins.rows[0].id]
        );
        console.log(`Contraseña restablecida para ${admins.rows[0].nombre_usuario}. No se mostró ni guardó en texto plano.`);
    } finally {
        await db.pool.end();
    }
}

resetAdminPassword().catch((error) => {
    console.error('No se pudo restablecer la cuenta admin:', error.message);
    process.exitCode = 1;
});