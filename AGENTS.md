# AGENTS.md — Droguería App

Guía operativa para agentes de IA que trabajen en este repositorio. Léela completa antes de tocar código y revisa también [`HANDOFF.md`](./HANDOFF.md), que contiene el estado actual, decisiones y pendientes.

> Este documento describe el proyecto **tal como está hoy**. Si cambias arquitectura, rutas o convenciones, actualízalo en el mismo cambio.

---

## 1. Resumen

Aplicación fullstack de inventario y ventas para una droguería.

- **Backend:** Node.js + Express 4 + PostgreSQL (`pg`), puerto `3001` (`process.env.PORT`).
- **Frontend:** React 19 + react-router-dom 7 + axios + recharts, servido por `react-scripts` en el puerto `3000`.
- **Autenticación:** propia, con token Bearer y sesiones en memoria; contraseñas con `scrypt`.
- **Base de datos:** PostgreSQL (local, remota o Supabase) configurada por `.env`.
- **Idioma:** UI, mensajes de error y documentación en español. Mantén esa convención.

---

## 2. Arranque rápido

```bash
# 1. Dependencias backend (raíz)
npm install

# 2. Dependencias frontend
cd fronted
npm install
cd ..

# 3. Configuración: copiar .env.example a .env y completar credenciales
#    (.env NO se versiona; nunca lo leas, imprimas ni commitees)

# 4. Backend (nodemon, puerto 3001)
npm run dev

# 5. Frontend (otra terminal, puerto 3000)
cd fronted && npm start
```

Preparación inicial de usuarios:

```bash
node scripts/apply-users-migration.js     # agrega activo / debe_cambiar_contrasena
node scripts/reset-admin-password.js      # interactivo, oculta la entrada
```

`iniciar-app.bat` arranca ambos servidores, pero **mata todos los procesos `node.exe`** (`taskkill /IM node.exe /F`). No lo ejecutes si hay otros servicios Node en la máquina.

---

## 3. Estructura real

```text
drogueria-app/
├── server.js                     # Express: CORS, JSON, routers, 404, sync de secuencias
├── db.js                         # Pool de PostgreSQL + helper query()
├── package.json                  # Backend
├── .env.example                  # Plantilla de variables (sin secretos)
├── iniciar-app.bat               # Arranque Windows (mata node.exe)
├── README.md / BACKUP.md         # Instalación y respaldo manual
├── AGENTS.md                     # Este archivo
├── HANDOFF.md                    # Bitácora de relevo entre agentes
├── routes/
│   ├── auth.js                   # login, me, logout, change-password
│   ├── usuarios.js               # CRUD de vendedores (solo admin)
│   ├── productos.js              # CRUD, estadísticas, alertas, ajuste de stock
│   ├── productosConflict.js      # Lógica pura de conflicto de códigos
│   ├── entradas.js               # Entradas de stock, búsqueda, historial, stats
│   ├── ventas.js                 # Crear venta (transacción) y anular
│   ├── historial.js              # Historial detallado de ventas y traslados
│   ├── reportes.js               # Reportes financieros y de inventario
│   ├── gastos.js                 # Gastos
│   ├── traslados.js              # Traslados entre puntos (usa entradas_stock)
│   └── backup.js                 # Descarga .dump con pg_dump (solo admin)
├── middleware/
│   ├── authentication.js         # Sesiones en memoria, Bearer, TTL 8 h
│   └── roles.js                  # requireRole / requireAdmin / requireSellerOrAdmin
├── utils/
│   └── passwords.js              # hashPassword / verifyPassword (scrypt)
├── migrations/
│   └── 20261108_users_security.sql
├── scripts/
│   ├── apply-users-migration.js
│   ├── auto-deploy.js            # Auto-deploy por sondeo de Git (solo produccion)
│   ├── auto-deploy.bat           # Tarea programada de Windows
│   ├── bootstrap-supabase.js
│   ├── create-puerto-millo.js   # Esquema puerto_millo en Supabase
│   ├── diagnostico-pre-supabase.sql
│   ├── migrate.js                # Runner de migraciones local/Supabase
│   ├── reset-admin-password.js
│   ├── sync-supabase.bat
│   └── sync-to-supabase.js
├── supabase/                     # Diagnóstico y permisos para Supabase (SQL)
├── test/                         # Tests con node:test (ver sección 9)
├── fronted/                      # ⚠️ carpeta con typo histórico; NO renombrar sin migrar todo
│   ├── package.json
│   ├── public/
│   └── src/
│       ├── App.js                # Rutas, sesión, AdminRoute, foco automático
│       ├── auth.js               # localStorage + interceptor axios
│       ├── components/Navbar.js
│       └── pages/                # Una página por módulo
└── (raíz) check-*.js, fix-*.js, diagnostico*.js, verify-*.js   # scripts legacy de mantenimiento
```

---

## 4. Autenticación y roles

### Flujo

1. `POST /api/auth/login` valida usuario activo y contraseña (`scrypt`), crea sesión y devuelve `{ token, user }`.
2. El frontend guarda `authToken` y `currentUser` en `localStorage` (`fronted/src/auth.js`).
3. Un interceptor de axios agrega `Authorization: Bearer <token>` a todas las peticiones.
4. `middleware/authentication.js` valida el token contra un `Map` en memoria, consulta el usuario en BD y expone `req.user`.
5. Sesiones: TTL de **8 horas**, se pierden al reiniciar el backend, no hay Redis ni JWT.

### Roles

- `admin`: acceso total.
- `vendedor`: productos (lectura), punto de venta, cambio de contraseña.
- El alias `denyIfAsesor` equivale hoy a `requireAdmin` (compatibilidad histórica). No asumas un rol `asesor`; ya no existe.

### Regla de oro

**El backend manda.** Los permisos se validan con `req.user.role`, nunca con headers enviados por el cliente. No confíes en `x-user-role`, `x-user-id` ni similares (quedan restos en el frontend, pero son ignorados).

### Reglas de contraseña

- Longitud 12–128 caracteres.
- Hash `scrypt` con formato `scrypt$<salt>$<hash>` (`utils/passwords.js`).
- `debe_cambiar_contrasena = TRUE` obliga a pasar por `/cambiar-contrasena`.

---

## 5. API

Todas las rutas cuelgan de `/api`. Excepto `POST /api/auth/login` y `GET /api/test`, requieren `Authorization: Bearer <token>`.

| Router | Ruta | Método | Rol |
|---|---|---|---|
| auth | `/auth/login` | POST | público |
| auth | `/auth/me` | GET | autenticado |
| auth | `/auth/logout` | POST | autenticado |
| auth | `/auth/change-password` | POST | autenticado |
| usuarios | `/usuarios` | GET/POST | admin |
| usuarios | `/usuarios/:id/active` | PATCH | admin |
| usuarios | `/usuarios/:id/username` | PATCH | admin |
| usuarios | `/usuarios/:id/password` | PATCH | admin |
| productos | `/productos` | GET | autenticado |
| productos | `/productos/:id` | GET | autenticado |
| productos | `/productos` | POST | admin |
| productos | `/productos/:id` | PUT/DELETE | admin |
| productos | `/productos/:id/stock` | PATCH | admin |
| productos | `/productos/estadisticas`, `/alertas/*` | GET | admin |
| entradas | `/entradas/*` | todas | admin (router completo) |
| ventas | `/ventas` | POST | admin y vendedor |
| ventas | `/ventas/:id/anular` | PUT | admin |
| historial | `/historial/ventas_detallado` | GET | admin |
| historial | `/historial/traslados_detallado` | GET | admin |
| reportes | `/reportes/*` | GET | admin |
| reportes | `/reportes/ventas_por_vendedor` | GET | admin |
| gastos | `/gastos/*` | GET/POST/PUT/DELETE | admin |
| traslados | `/traslados/*` | GET/POST/PATCH | admin |
| backup | `/backup` | GET | admin |
| supabase | `/supabase/sync` | POST | admin |

Respuestas:

- Éxito: `res.json({ message, ...data })` o `201` al crear.
- Error: `res.status(400|401|403|404|409|500).json({ error: 'mensaje en español' })`.
- No cambies el formato `{ error }`: el frontend lo consume directamente.

---

## 6. Base de datos

No hay ORM. Todo es SQL parametrizado (`$1, $2...`) con `pg`.

### Tablas y columnas que usa el código

**`productos`**
`id`, `codigo_producto`, `nombre`, `costo_unidad`, `precio_unidad`, `stock_total`,
`margen_porcentaje`, `margen_sobre`, `margen_caja`, `margen_solo_sobre`, `margen_solo_caja`,
`stock_minimo_alerta`, `venta_por_unidad_habilitada`,
`vender_por_sobre`, `unidades_por_sobre`, `precio_por_sobre`,
`vender_por_caja`, `unidades_por_caja`, `precio_por_caja`,
`venta_exclusiva_sobre`, `cantidad_solo_sobre`, `precio_solo_sobre`,
`venta_exclusiva_caja`, `cantidad_solo_caja`, `precio_solo_caja`,
`fecha_vencimiento`, `dias_alerta_vencimiento`, `fecha_ultima_entrada`,
`fecha_creacion`, `fecha_modificacion`, `creado_por`, `modificado_por`.

**`entradas_stock`**
`id`, `producto_id`, `cantidad_entrada` (INTEGER; **negativa** en traslados),
`fecha_entrada`, `costo_unidad_entrada`, `costo_anterior`, `costo_nuevo`,
`proveedor`, `numero_factura`, `observaciones`, `usuario_id`,
`anulado`, `motivo_anulacion`, `fecha_anulacion`.
No se usa `fecha_vencimiento` aquí (hay esquemas antiguos sin esa columna).

**`ventas`**
`id`, `usuario_id`, `fecha_venta`, `metodo_pago` (`Efectivo` | `Transferencia` | `Mixto`),
`monto_total`, `monto_efectivo`, `monto_transferencia`,
`anulado`, `estado`, `motivo_anulacion`, `fecha_anulacion`, `usuario_anulacion_id`.

**`detalle_venta`**
`id`, `venta_id`, `producto_id`, `cantidad_vendida`, `precio_venta`,
`tipo_venta` (`Unidad` | `Sobre` | `Caja` | `Solo Sobre` | `Solo Caja`).

**`gastos`**: `id`, `fecha_gasto`, `concepto`, `monto`.

**`usuarios`**: `id`, `nombre_usuario`, `contrasena_hash`, `rol`, `activo`, `debe_cambiar_contrasena`.

### Migraciones

- Viven en `migrations/`.
- `scripts/apply-users-migration.js` aplica la migración de usuarios dentro de una transacción.
- **No modifiques el esquema desde el código.** Si necesitas un cambio, agrega un archivo SQL nuevo en `migrations/` y documenta cómo aplicarlo.

### Conexión

`db.js` prioriza `DATABASE_URL`; si no existe, usa `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`. Con `DB_SSL=true` acepta certificados remotos (Supabase). Si `DB_SCHEMA` está definido, fija `search_path` a ese esquema (por ejemplo `puerto_millo`) y usa `public` como respaldo. Pool: `max 20`, timeout de conexión 2 s.

---

## 7. Convenciones de código

### Usuario de auditoría

```js
function getAuditUser(req) {
    return { userId: req.user.id, userName: req.user.nombre };
}
```

`req.user` lo inyecta `authenticate`. No vuelvas al patrón antiguo de leer headers.

### Transacciones

```js
const client = await db.pool.connect();
try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT * FROM productos WHERE id = $1 FOR UPDATE', [id]);
    // lógica + INSERT/UPDATE
    await client.query('COMMIT');
    res.status(201).json({ message: '...' });
} catch (error) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: error.message });
} finally {
    client.release();
}
```

- Usa `FOR UPDATE` cuando leas stock y vayas a descontarlo (entradas y traslados lo hacen; ventas **aún no** — ver HANDOFF).
- No mezcles `db.query` y `client.query` dentro de la misma transacción.

### Dinero

- Totales de venta: `Math.round(...)`.
- Listados de productos: redondeo a 2 decimales.
- Porcentajes de margen: `((precio - costo) / precio) * 100`, acotado a `>= 0`.

### Fechas

- Zona de negocio: `America/Bogota`.
- Usa `(fecha_columna AT TIME ZONE 'America/Bogota')::date` en filtros por día.
- Para "hoy" usa `(NOW() AT TIME ZONE 'America/Bogota')::date`.

### Ventas

- `calcularDetalleVenta(producto, item)` define precio y unidades a descontar por `tipo_venta`.
- Productos con `venta_exclusiva_sobre/caja` solo se venden en esa presentación.
- `Solo Sobre` / `Solo Caja` descuentan y reponen **1 unidad de stock por presentación** (el stock se maneja en sobres/cajas).
- `validarDesglosePago` exige que efectivo + transferencia coincidan al centavo con el total.
- Al anular, se repone stock y se registra motivo/usuario/fecha.

### Traslados (sin cambiar el esquema)

Se reutiliza `entradas_stock`:

- `cantidad_entrada` = negativo.
- `observaciones` = `TRASLADO|Origen:<x>|Destino:<y>|Observación:<texto>`.
- `proveedor` = `NULL`, `costo_unidad_entrada` = costo actual.
- Se identifican con `observaciones ILIKE 'TRASLADO%'` y se excluyen de entradas/reportes de compra.

### Secuencias

Los IDs se desfasan con frecuencia en esta base. Ya existen helpers que ejecutan `setval`:

- `server.js` sincroniza `ventas` y `detalle_venta` al arrancar.
- `entradas.js` y `traslados.js` sincronizan `entradas_stock` antes de insertar.
- `productos.js` calcula `MAX(id)+1` y sincroniza antes de insertar.

Mantén ese patrón si agregas inserts con ID explícito.

---

## 8. Frontend

- Carpeta: `fronted/` (sic).
- Rutas protegidas en `App.js`: `AdminRoute` redirige a `/punto-de-venta` si el rol no es `admin`.
- Sesión: `getAuthToken`, `getCurrentUser`, `getAuthHeaders`, `saveAuthSession`, `clearAuthSession`.
- Interceptor global de axios en `fronted/src/auth.js`.
- Formularios: componentes controlados; el foco inicial lo maneja `RouteFocus` (no agregues `autoFocus` salvo en Login).
- Estilos: un CSS por página/componente (no hay framework de UI real; Tailwind está declarado pero sin uso).
- Recharts se usa en el Dashboard.
- `ProductoForm.js` y `ProductoLista.js` son código muerto: la vista activa usa `useProductosLogic` + `ProductForm` + `ProductTable`.

### Deuda conocida del frontend

- URLs `http://localhost:3001/...` hardcodeadas en ~20 lugares; no existe `REACT_APP_API_URL`.
- Restos de headers `x-user-*` en `HistorialDeVentas.js` (inofensivos, pero conviene limpiar).
- El navbar muestra "Entradas de Stock" a vendedores, pero la ruta los devuelve al punto de venta.

---

## 9. Tests

No hay framework externo: se usa `node:test` + `node:assert/strict`.

```bash
# Suite completa (raíz)
node --test test

# Un archivo
node --test test/ventas-payment.test.js

# Frontend
cd fronted
npm test -- --watchAll=false
```

Estado actual:

- `npm test` de la raíz **no está configurado** (`package.json` hace `exit 1`). Usa `node --test test` o corrige el script.
- Varios tests importan routers que a su vez importan `db.js`; por eso requieren un `.env` con conexión válida aunque no escriban en BD.
- Tests puros (sin BD): `passwords`, `productosConflict`, `roles`.
- Antes de cerrar un cambio, ejecuta al menos `node --check` sobre los archivos tocados y los tests relacionados.

---

## 10. Variables de entorno

| Variable | Uso |
|---|---|
| `PORT` | Puerto del backend (default `3001`). |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Conexión PostgreSQL. Default de `DB_NAME`: `drogueria_app`. |
| `DATABASE_URL` | Alternativa de conexión única (Supabase/remoto); tiene prioridad. |
| `DB_SSL` | `true` para conexiones remotas con SSL. |
| `DB_SCHEMA` | Opcional. Esquema a usar (ej. `puerto_millo`). Por defecto `public`. |
| `PG_DUMP_PATH` | Ruta completa a `pg_dump` si no está en `PATH`. |
| `NODE_ENV` | `production` oculta detalles de error y logs de depuración. |

Nunca commitees `.env`, dumps ni respaldos. `.gitignore` ya cubre `.env`, `*.sql` y `backup_*.sql`.

---

## 11. Reglas para agentes

1. **Lee `AGENTS.md` y `HANDOFF.md` antes de empezar.** Revisa `git status` y no reviertas cambios ajenos.
2. **No toques `.env` ni datos reales.** No ejecutes `DROP`, `DELETE` masivos, `pg_restore -c` ni scripts de "fix" sin confirmación humana.
3. **No renombres `fronted/`** ni cambies el esquema sin migración.
4. **Mantén el español** en UI, mensajes y documentación.
5. **Valida permisos en el backend**, no solo en React.
6. **Todo cambio de stock debe ser transaccional** y bloquear la fila (`FOR UPDATE`).
7. **No agregues dependencias** sin justificarlo (el proyecto es deliberadamente minimalista: Express, pg, dotenv, cors).
8. **Prueba con `node --check` y los tests relevantes**; reporta qué ejecutaste y qué no.
9. **Actualiza `HANDOFF.md`** al terminar: qué hiciste, archivos, comandos, riesgos y siguiente paso.
10. **Si algo está ambiguo, pregunta** antes de borrar o sobrescribir trabajo existente.
