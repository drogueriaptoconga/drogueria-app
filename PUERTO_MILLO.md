# Droguería Puerto Millo (segunda droguería)

## Estado actual

- Esquema **`puerto_millo`** creado en el **mismo proyecto de Supabase** (`mddlmovkbnjsbbeukska`).
- Tablas: `usuarios`, `productos`, `ventas`, `detalle_venta`, `entradas_stock`, `gastos`, `schema_migrations` y `sync_control`.
- Catálogo: **2.364 productos** copiados desde `public`, con `stock_total = 0`, sin fecha de vencimiento y sin fecha de última entrada.
- Usuarios: solo `Admin` (rol admin, activo, debe cambiar la clave en el primer ingreso).
- Ventas, detalles, entradas y gastos: **vacíos**.
- El esquema `public` de la droguería actual **no se modificó**.

## Cómo desplegar la app para Puerto Millo

En el equipo o host de Puerto Millo:

1. Clonar el repo:
   ```bash
   git clone https://github.com/drogueriaptoconga/drogueria-app.git
   cd drogueria-app
   ```
2. Instalar dependencias:
   ```bash
   npm install
   cd fronted
   npm install
   cd ..
   ```
3. Crear `.env`:
   ```env
   DATABASE_URL=postgresql://postgres.mddlmovkbnjsbbeukska:TU_PASSWORD@aws-1-us-west-2.pooler.supabase.com:5432/postgres
   DB_SSL=true
   DB_SCHEMA=puerto_millo

   SUPABASE_DATABASE_URL=postgresql://postgres.mddlmovkbnjsbbeukska:TU_PASSWORD@aws-1-us-west-2.pooler.supabase.com:5432/postgres
   SUPABASE_DB_SSL=true
   SUPABASE_SYNC_ENABLED=false

   PORT=3001
   ```
   - `DATABASE_URL` es la base principal de Puerto Millo (Supabase).
   - `DB_SCHEMA=puerto_millo` hace que la app use ese esquema.
   - No pongas `public` en `DB_SCHEMA`.
   - `SUPABASE_SYNC_ENABLED=false` porque aquí Supabase es la base principal, no un espejo.
4. Aplicar migraciones:
   ```bash
   npm run db:migrate:supabase
   ```
   Con `DB_SCHEMA=puerto_millo`, el runner usa `puerto_millo.schema_migrations` y no toca `public`.
5. Arrancar backend y frontend:
   ```bash
   npm run dev
   # otra terminal
   cd fronted
   npm start
   ```
6. Entrar como **`Admin`** con la clave temporal entregada por el administrador y cambiarla.

> La URL del API en el frontend está fija en `http://localhost:3001`. Si el backend de
> Puerto Millo va a estar en otro host, hay que centralizarla en `REACT_APP_API_URL`.

## Crear el esquema de nuevo

El script `scripts/create-puerto-millo.js` crea el esquema y copia el catálogo desde
`public` en el **mismo proyecto**:

```bash
PUERTO_MILLO_ADMIN_PASSWORD='UnaClaveDe12+' npm run db:create-puerto-millo
```

- Requiere `SUPABASE_DATABASE_URL` en el `.env`.
- Aborta si `puerto_millo.productos` ya existe.
- No toca `public`.
- `PUERTO_MILLO_ADMIN_PASSWORD` es opcional; si no se define, no crea Admin.
- Para otro proyecto de Supabase, cambia `SUPABASE_DATABASE_URL`. El catálogo se copia
  desde el `public` de ese proyecto; debe tener productos.

## Reglas

- **No ejecutar `npm run db:supabase:sync` en Puerto Millo**: allí Supabase es la base
  principal, no un espejo.
- Las migraciones de esquema se aplican con `DB_SCHEMA=puerto_millo npm run db:migrate:supabase`.
- El sync diario de la droguería actual solo toca `public`; no toca `puerto_millo`.
- Los datos de ambas droguerías están aislados por esquema dentro del mismo proyecto.
- Si se usa la API de Supabase (no la app), hay que exponer el esquema `puerto_millo` y
  dar grants; la app usa conexión directa `pg` y no lo necesita.
