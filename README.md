# Droguería App

Aplicación fullstack (Express + React) para inventario y ventas de la droguería.

## Documentación

- [`SETUP.md`](./SETUP.md): montar el proyecto en otra máquina y flujo entre desarrollo y producción.
- [`SUPABASE.md`](./SUPABASE.md): respaldo espejo en Supabase.
- [`BACKUP.md`](./BACKUP.md): respaldos locales con `pg_dump`.
- [`AGENTS.md`](./AGENTS.md) y [`HANDOFF.md`](./HANDOFF.md): guía y bitácora para agentes.

## Inicio rápido

1. Clonar el repo:

```bash
git clone https://github.com/drogueriaptoconga/drogueria-app.git
cd drogueria-app
```

2. Instalar dependencias del backend:

```bash
npm install
```

3. Instalar dependencias del frontend:

```bash
cd fronted
npm install
cd ..
```

4. Crear el `.env` desde `.env.example` (NO se versiona):

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=tu_password
DB_NAME=drogueria_app
DB_SSL=false
```

5. Preparar la base local. La opción recomendada es restaurar desde Supabase o desde un dump; ver [`SETUP.md`](./SETUP.md).

6. Aplicar migraciones:

```bash
npm run db:migrate:local
# Si vas a actualizar también Supabase:
npm run db:migrate:supabase
```

7. Ejecutar el backend:

```bash
npm run dev
```

8. Ejecutar el frontend (otra terminal):

```bash
cd fronted
npm start
```

## Actualizar producción

En la máquina de producción, doble clic en **`Actualizar Drogueria App`** del escritorio
(o ejecuta `scripts\actualizar-app.bat`). Revisa `origin/main`, aplica los cambios y reinicia
el backend solo si hace falta. No lo ejecutes en medio de una venta.

## Base de datos y Supabase

- La app usa el PostgreSQL local por defecto.
- `DATABASE_URL` tiene prioridad sobre `DB_*`. No la apuntes a Supabase salvo que quieras que la app use Supabase como base principal.
- El respaldo de datos a Supabase se ejecuta con `npm run db:supabase:sync` o con el botón **“Sincronizar ahora”** del admin.
- `SUPABASE_SYNC_ENABLED=true` solo debe estar en la máquina de producción. En desarrollo déjalo en `false` para no sobrescribir el espejo de producción.
- Las migraciones de esquema sí se pueden aplicar a Supabase desde desarrollo con `npm run db:migrate:supabase`.

## Usuarios

- Las contraseñas usan `scrypt` (`utils/passwords.js`).
- Si necesitas resetear la clave del Admin: `node scripts/reset-admin-password.js` (interactivo, sin eco).
- Los vendedores se crean desde la pantalla **Usuarios** y deben cambiar la clave en el primer ingreso.
- Las sesiones son tokens Bearer en memoria, duran 8 horas y se pierden al reiniciar el backend.

## Seguridad

- No commitear `.env`, dumps, logs ni `node_modules`.
- No compartir la `SUPABASE_DATABASE_URL` ni la `service_role`/secret key.
- Si una clave se compartió por chat, rotarla en el dashboard de Supabase.
