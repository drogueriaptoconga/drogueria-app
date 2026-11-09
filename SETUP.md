# Montar el proyecto en otra máquina

Esta guía es para pasar de la máquina de **producción** (donde está la caja) a una
máquina de **desarrollo**, y luego bajar los cambios de vuelta por Git.

## 1. Requisitos

- Node.js 20 o superior (probado con 24).
- PostgreSQL 18 local (o compatible) con `pg_dump`, `pg_restore` y `createdb`.
- Git.
- npm.

En Windows, los binarios de PostgreSQL suelen estar en:

```text
C:\Program Files\PostgreSQL\18\bin
```

## 2. Clonar e instalar

```bash
git clone https://github.com/drogueriaptoconga/drogueria-app.git
cd drogueria-app
npm install
cd fronted
npm install
cd ..
```

## 3. Crear el `.env`

Copiar `.env.example` a `.env` y completar. **El `.env` no se versiona.**

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=tu_password
DB_NAME=drogueria_app
DB_SSL=false
```

Para Supabase (solo si vas a aplicar migraciones de esquema o sincronizar datos):

```env
SUPABASE_DATABASE_URL=postgresql://postgres.mddlmovkbnjsbbeukska:TU_PASSWORD@aws-1-us-west-2.pooler.supabase.com:5432/postgres
SUPABASE_DB_SSL=true

# IMPORTANTE: en desarrollo dejar en false.
# Solo la máquina de producción lo pone en true.
SUPABASE_SYNC_ENABLED=false
```

> No pongas la URL de Supabase en `DATABASE_URL`. Esa variable tiene prioridad y la app
> usaría Supabase como base principal. `SUPABASE_DATABASE_URL` es solo para el respaldo.

## 4. Preparar la base local

### Opción A: restaurar el dump de producción (recomendada)

En la máquina de producción se generó el archivo:

```text
C:\xampp\htdocs\drogueria_app_para_dev.dump
```

Cópialo a la máquina de desarrollo (USB, red interna o nube; **no por Git**). Luego:

```powershell
& "C:\Program Files\PostgreSQL\18\bin\createdb.exe" -U postgres drogueria_app
& "C:\Program Files\PostgreSQL\18\bin\pg_restore.exe" -U postgres -d drogueria_app --no-owner --no-privileges "C:\ruta\drogueria_app_para_dev.dump"
```

Ese dump incluye las 6 tablas, los índices, las secuencias, los 3 usuarios y los datos.
También incluye `schema_migrations`, así que el runner no repetirá la migración ya aplicada.

### Opción B: dump desde Supabase

Si no tienes el archivo anterior, puedes bajar una copia desde Supabase:

```powershell
& "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe" "postgresql://postgres.mddlmovkbnjsbbeukska:TU_PASSWORD@aws-1-us-west-2.pooler.supabase.com:5432/postgres" -Fc -f drogueria.dump
& "C:\Program Files\PostgreSQL\18\bin\createdb.exe" -U postgres drogueria_app
& "C:\Program Files\PostgreSQL\18\bin\pg_restore.exe" -U postgres -d drogueria_app --no-owner --no-privileges drogueria.dump
```

Si el DNS local falla, resuelve el host con `nslookup aws-1-us-west-2.pooler.supabase.com`
y usa `-h <IP>` en el `pg_dump`.

### Opción C: base nueva desde el esquema

```powershell
& "C:\Program Files\PostgreSQL\18\bin\createdb.exe" -U postgres drogueria_app
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -d drogueria_app -f supabase\schema.sql
npm run db:migrate:local
```

Queda sin datos y sin usuarios. Para poder entrar necesitas crear un Admin o restaurar
una copia con datos. Para desarrollo normal, usa la Opción A o B.

## 5. Migraciones de esquema

Cada cambio de base de datos va en un archivo nuevo dentro de `migrations/`, por ejemplo:

```text
migrations/20261109_agregar_columna_ejemplo.sql
```

Luego se aplica en los dos lados:

```bash
npm run db:migrate:local
npm run db:migrate:supabase
```

El runner crea la tabla `public.schema_migrations` y registra cada archivo aplicado,
así no se repite. `supabase/schema.sql` es el esquema inicial de referencia; para cambios
posteriores usa migraciones.

> Orden recomendado: aplicar y probar en local, luego en Supabase, y por último correr
> el sync de datos desde **producción**.

## 6. Ejecutar la app

Backend:

```bash
npm run dev
```

Frontend (otra terminal):

```bash
cd fronted
npm start
```

- Backend: `http://localhost:3001`
- Frontend: `http://localhost:3000`
- Entra con el usuario `Admin` que viene en el dump.

## 7. Sincronización con Supabase

- Manual en producción: `npm run db:supabase:sync`
- Desde la app: botón **“Sincronizar ahora”** (solo admin)
- Automática: tarea de Windows `Drogueria - Respaldo Supabase`, diaria a las 23:00.

### Candado de seguridad

`SUPABASE_SYNC_ENABLED=true` **solo en producción**. En desarrollo debe quedar en `false`
(o ausente). Si alguien pulsa el botón en desarrollo, el script se niega a correr y no
sobrescribe el espejo de producción.

Las **migraciones de esquema** sí se pueden aplicar a Supabase desde desarrollo
(`npm run db:migrate:supabase`); lo que no se debe hacer desde desarrollo es el **sync de datos**.

Si necesitas probar el botón/sync en desarrollo, crea un proyecto de Supabase aparte para
desarrollo y apunta ahí `SUPABASE_DATABASE_URL`.

## 8. Flujo entre las dos máquinas

### Máquina de desarrollo

1. `git pull`
2. Desarrollar.
3. Si cambió la base: crear migración, `npm run db:migrate:local`, probar, `npm run db:migrate:supabase`.
4. Probar: `node --test test` y `npm run build` (frontend).
5. `git add`, `git commit`, `git push`.

### Máquina de producción (esta)

1. `git pull`
2. Si cambió `package.json` o `fronted/package.json`: `npm install` y `cd fronted && npm install`.
3. `npm run db:migrate:local`
4. `npm run db:migrate:supabase`
5. Reiniciar backend y frontend.
6. La tarea diaria de las 23:00 sigue funcionando.

### Reglas

- Nunca commitear `.env`, dumps, logs ni `node_modules`.
- No ejecutar el sync de datos desde desarrollo.
- No escribir directamente en Supabase: el sync reemplaza las tablas de `public`.
- La tarea programada de Windows es específica de cada máquina; en desarrollo no hace falta.

## 9. Checklist de la nueva máquina

- [ ] Repo clonado.
- [ ] `npm install` en raíz y en `fronted`.
- [ ] `.env` creado (local + Supabase + `SUPABASE_SYNC_ENABLED=false`).
- [ ] Base local restaurada (dump o Supabase).
- [ ] `npm run db:migrate:local` sin errores.
- [ ] Backend y frontend arrancan.
- [ ] Login con Admin funciona.
- [ ] Si vas a tocar Supabase: `npm run db:migrate:supabase` funciona.
- [ ] Confirmaste que el botón “Sincronizar ahora” está bloqueado en desarrollo.

## 10. Seguridad

- El `.env` contiene la contraseña de PostgreSQL y la de Supabase. No compartirlo.
- Rotar cualquier clave de Supabase que se haya compartido por chat.
- Los dumps contienen hashes de contraseñas y datos reales: tratarlos como confidenciales.
