# HANDOFF.md — Bitácora de relevo entre agentes

Archivo de comunicación entre agentes de IA (y humanos) que trabajan en **Droguería App**.
Su objetivo es que cualquier agente pueda retomar el trabajo sin reconstruir contexto ni pisar cambios ajenos.

- Guía técnica permanente: [`AGENTS.md`](./AGENTS.md)
- Este archivo es **histórico y vivo**: no borres entradas anteriores; agrega la tuya al final.
- Última actualización: **2026-11-08**

---

## 1. Cómo usar este archivo

### Antes de empezar

1. Lee `AGENTS.md` y luego las últimas 2–3 entradas de este archivo.
2. Ejecuta `git status` y `git log --oneline -5`. Hay trabajo sin commitear; **no lo reviertas ni lo reformatees**.
3. Revisa la sección [Pendientes priorizados](#4-pendientes-priorizados).
4. Si vas a tocar un área que otro agente está trabajando, anótalo en [Bloqueos y reclamos](#6-bloqueos-y-reclamos-activos).

### Al terminar

Agrega una entrada con la plantilla de la sección 8. Incluye siempre:

- Qué cambiaste y **por qué**.
- Archivos tocados.
- Comandos ejecutados (tests, `node --check`, migraciones).
- Qué quedó **sin probar**.
- Riesgos, decisiones y siguiente paso concreto.

### Reglas de convivencia

- No sobrescribas ni elimines cambios sin confirmación humana.
- No toques `.env`, dumps, datos reales ni ejecutes scripts `fix-*` / `diagnostico-*` sin autorización.
- No hagas `git commit`, `push`, `reset --hard` ni `checkout` que descarten trabajo sin que lo pidan.
- Un cambio por tema; evita mezclar refactors masivos con fixes puntuales.
- Si detectas un problema que no vas a arreglar, regístralo aquí en lugar de “arreglarlo de paso”.

---

## 2. Estado actual del proyecto (snapshot)

**Funcionalidad presente y usable**

- Login/logout, sesiones Bearer (8 h), cambio obligatorio de contraseña, gestión de vendedores.
- CRUD de productos con precios por unidad/sobre/caja, ventas exclusivas, márgenes, vencimientos y stock mínimo.
- Entradas de stock con actualización de costo/precios y cálculo de márgenes.
- Punto de venta con validación de stock, tipos de venta y pagos (efectivo/transferencia/mixto).
- Anulación de ventas con reposición de stock y auditoría.
- Traslados entre puntos reutilizando `entradas_stock` (cantidad negativa + observación estructurada).
- Gastos, reportes financieros, dashboard, historial detallado y respaldo `.dump`.
- Tests de lógica pura con `node:test`.

**Estado del repositorio**

- Rama actual con muchos archivos modificados sin commitear y varios módulos nuevos sin trackear (`routes/auth.js`, `routes/usuarios.js`, `routes/backup.js`, `routes/traslados.js`, `middleware/authentication.js`, `utils/`, `scripts/`, tests nuevos).
- `AGENTS.md` fue reescrito el 2026-11-08 para reflejar la arquitectura real (antes describía roles por header y omitía auth/usuarios/backup).
- `HANDOFF.md` (este archivo) es nuevo.
- **No hay cambios de código de aplicación en esta sesión**: solo documentación.

**Verificación ejecutada el 2026-11-08**

```bash
# Sintaxis: 27 archivos JS del backend
node --check <cada archivo de server.js, db.js, routes/, middleware/, utils/, scripts/, test/>
# Resultado: OK

node --test test/passwords.test.js test/productosConflict.test.js test/roles.test.js
# Resultado: 8/8 tests OK
```

No se ejecutaron tests que escriben en BD, ni servidores, ni migraciones.

---

## 3. Decisiones vigentes (no revertir sin discutirlo)

| Decisión | Motivo / consecuencia |
|---|---|
| Autenticación propia con token en memoria + `scrypt` | Sin dependencias externas; las sesiones se pierden al reiniciar el backend y no escala horizontalmente. |
| Roles `admin` y `vendedor` | El rol `asesor` ya no existe. `denyIfAsesor` es solo un alias de `requireAdmin`. |
| Permisos en backend con `req.user.role` | Los headers `x-user-*` no otorgan permisos. Quedan restos en el frontend, pero se ignoran. |
| Traslados dentro de `entradas_stock` con cantidad negativa | Evita cambiar el esquema. Se identifican con `observaciones ILIKE 'TRASLADO%'`. |
| “Solo Sobre” / “Solo Caja” descuentan 1 unidad de stock por presentación | El stock se maneja en sobres/cajas cuando el producto es exclusivo. |
| Costo de venta en reportes = `productos.costo_unidad` actual | No hay costo histórico por lote; si el costo cambia, los reportes anteriores se recalculan con el costo actual. |
| Zona horaria `America/Bogota` | Todos los filtros “por día” deben usar esa zona. |
| `fronted/` conserva el typo | Renombrarlo obliga a tocar scripts, imports y documentación. No hacerlo sin plan. |
| Sin ORM y sin framework de tests | SQL parametrizado + `node:test`. Mantener el estilo minimalista. |

---

## 4. Pendientes priorizados

> Referencias `archivo:línea` válidas al 2026-11-08. Verifica antes de editar.

### Alta prioridad

1. **Carrera de stock en ventas** — `routes/ventas.js:96-207`
   - `SELECT * FROM productos WHERE id = ANY(...)` (línea ~113) no usa `FOR UPDATE`; el descuento ocurre en la línea ~188.
   - Dos ventas concurrentes pueden vender el mismo stock.
   - Propuesta: bloquear filas con `SELECT ... FOR UPDATE` (ordenar por `id` para evitar deadlocks) o hacer `UPDATE ... WHERE stock_total >= $n` y validar `rowCount`.

2. **`npm test` roto** — `package.json:9`
   - El script hace `echo "Error: no test specified" && exit 1`.
   - Propuesta: `"test": "node --test test"` (verificar que los tests que importan routers toleren un `.env` sin BD o aislarlos).

3. **Costo promedio de entradas incorrecto** — `routes/entradas.js:193`
   - Usa `(costo_anterior + costo_nuevo) / 2`, un promedio simple.
   - Debe ser promedio ponderado por cantidades: `((stock_anterior * costo_anterior) + (cantidad_nueva * costo_nuevo)) / (stock_anterior + cantidad_nueva)`.
   - Impacto: costo, márgenes y reportes de ganancia.

4. **CORS abierto y login sin rate limit** — `server.js:37`, `routes/auth.js:18`
   - `app.use(cors())` permite cualquier origen.
   - No hay límite de intentos de login.
   - Aceptable en LAN; bloquear antes de exponer a internet. Evaluar `helmet`, `express-rate-limit` y lista blanca de orígenes.

5. **URL del API hardcodeada** — frontend
   - `http://localhost:3001` aparece en `App.js`, `Login.js`, `Navbar.js`, `Dashboard.js`, `PuntoDeVenta.js`, `EntradasStock.js`, `HistorialDeVentas.js`, `Gastos.js`, `Reportes.js`, `Usuarios.js`, `useProductosLogic.js`, `ProductoForm.js`, `Traslados.js`.
   - Propuesta: centralizar en `fronted/src/api.js` usando `process.env.REACT_APP_API_URL || 'http://localhost:3001'`.

### Media prioridad

6. **Conexión fuera del `try`** — `routes/ventas.js:101`, `routes/entradas.js:158`, `routes/traslados.js:81`
   - Si falla `db.pool.connect()`, Express 4 no captura el rechazo de la promesa.
   - Propuesta: mover el `connect()` dentro del `try` o envolver los handlers con un wrapper `asyncHandler`.

7. **Validaciones faltantes**
   - `routes/gastos.js:8`: POST no valida `concepto` ni `monto` (PUT sí lo hace).
   - `routes/gastos.js:55`: DELETE responde éxito aunque el id no exista.
   - `routes/productos.js:391`: PUT no verifica `rowCount`; responde “actualizado” para ids inexistentes.
   - `routes/traslados.js:77`: `punto_origen.trim()` falla si llega un número u objeto.

8. **UX navbar vendedor** — `fronted/src/components/Navbar.js:82` vs `fronted/src/App.js:106`
   - “Entradas de Stock” se muestra a vendedores, pero `AdminRoute` los redirige.
   - Propuesta: ocultar el link para no-admin o abrir solo lectura si el negocio lo permite.

9. **Auditoría inconsistente** — `routes/entradas.js:322`
   - `modificado_por` guarda `String(auditUserId)` (id), mientras productos/traslados guardan el nombre.
   - Decidir un criterio único (idealmente nombre de usuario) y documentarlo.

10. **Filtros inconsistentes en reportes** — `routes/reportes.js:332,339,370`
    - Gastos, inversión y traslados solo aplican rango si vienen `startDate` **y** `endDate`; ingresos y ganancia aplican cada uno por separado.
    - Propuesta: normalizar el manejo de fechas (mismo `where` para todas las subconsultas).
    - Revisar también `trasladosParams` (usa `'YYYY-MM-DD 00:00:00'` contra `::date`).

11. **Código muerto / limpieza**
    - `fronted/src/pages/ProductoForm.js` y `ProductoLista.js` no se usan.
    - Headers `x-user-role` / `x-user-id` residuales en `fronted/src/pages/HistorialDeVentas.js:75`.
    - Scripts legacy en la raíz: `check-schema.js`, `check-sequence.js`, `fix-ventas-sequence.js`, `fix-detalle-venta-sequence.js`, `verify-ventas-state.js`, `diagnostico.js`, `diagnostico-venta-exclusiva.js`. Mover a `scripts/` o eliminar con aprobación.
    - `package.json` del frontend declara `tailwindcss`/`postcss` sin uso real.

12. **Inconsistencia de nombre de BD**
    - `README.md:34` dice `drogueria_db`.
    - `.env.example:9` y `db.js:22` usan `drogueria_app`.
    - Unificar (sin tocar `.env` reales).

### Baja prioridad / mejoras

13. Validar variables de entorno al arrancar (fallar rápido si falta configuración).
14. Agregar `engines.node` y script de lint.
15. Revisar `DELETE /productos/:id` cuando hay ventas/entradas asociadas (hoy devuelve 500 si una FK lo bloquea).
16. `capital_invertido` y `ganancia_potencial` no filtran stock negativo/cero (`routes/reportes.js:162,175`).
17. Respaldos: `pg_dump` debe estar en `PATH` o definir `PG_DUMP_PATH`; documentar en despliegue.

---

## 5. Mapa rápido de módulos

| Área | Backend | Frontend |
|---|---|---|
| Login / sesión | `routes/auth.js`, `middleware/authentication.js`, `utils/passwords.js` | `Login.js`, `CambiarContrasena.js`, `auth.js`, `App.js` |
| Usuarios | `routes/usuarios.js`, `middleware/roles.js` | `Usuarios.js` |
| Productos | `routes/productos.js`, `routes/productosConflict.js` | `Productos.js`, `useProductosLogic.js`, `ProductForm.js`, `ProductTable.js` |
| Entradas | `routes/entradas.js` | `EntradasStock.js` |
| Ventas | `routes/ventas.js` | `PuntoDeVenta.js` |
| Historial | `routes/historial.js` | `HistorialDeVentas.js` |
| Traslados | `routes/traslados.js` | `Traslados.js` |
| Gastos | `routes/gastos.js` | `Gastos.js` |
| Reportes | `routes/reportes.js` | `Reportes.js`, `Dashboard.js` |
| Respaldo | `routes/backup.js` | `Navbar.js` |

---

## 6. Bloqueos y reclamos activos

> Formato: `ÁREA — agente — desde — nota`. Vacío al 2026-11-08.

- _(ninguno)_

---

## 7. Comandos útiles

```bash
# Backend
npm run dev
node --check routes/ventas.js
node --test test
node --test test/ventas-payment.test.js

# Frontend
cd fronted
npm start
npm test -- --watchAll=false
npm run build

# Base de datos
node scripts/apply-users-migration.js
node scripts/reset-admin-password.js
```

Advertencia: `iniciar-app.bat` ejecuta `taskkill /IM node.exe /F` y cierra **todos** los procesos Node de la máquina.

---

## 8. Plantilla de entrada

Copia este bloque al final del archivo y complétalo:

```markdown
### YYYY-MM-DD — <agente/modelo> — <título corto>

**Objetivo:** ...

**Cambios:**
- `ruta/archivo.js`: ...

**Comandos ejecutados:**
- `node --check ...` → OK
- `node --test ...` → X/Y OK

**Sin probar:** ...

**Riesgos / notas:** ...

**Siguiente paso:** ...
```

---

## 9. Historial de entradas

### 2026-11-08 — DeepSeek V4.1 Flash — Revisión general y documentación

**Objetivo:** revisar todo el proyecto sin modificar código y crear los archivos de coordinación entre agentes.

**Cambios:**
- `AGENTS.md`: reescrito para reflejar la arquitectura real (Bearer + sesiones en memoria, roles admin/vendedor, routers auth/usuarios/backup/traslados, `utils/`, `migrations/`, scripts, esquema y convenciones actuales).
- `HANDOFF.md`: creado con protocolo de relevo, decisiones, pendientes priorizados y bitácora.

**Comandos ejecutados:**
- `node --check` sobre 27 archivos JS del backend → OK.
- `node --test test/passwords.test.js test/productosConflict.test.js test/roles.test.js` → 8/8 OK.
- `git status` / `git log --oneline -12` → solo lectura.

**Sin probar:**
- Suite completa (`node --test test`): varios tests requieren conexión a BD.
- Servidores backend/frontend.
- Flujos manuales de venta, traslado, entrada y respaldo.

**Riesgos / notas:**
- Working tree con muchos cambios sin commitear: no revertir.
- Hallazgos principales: carrera de stock en ventas, `npm test` roto, costo promedio simple en entradas, CORS abierto y URLs hardcodeadas. Detalle en la sección 4.
- No se modificó código de aplicación ni `.env`.

**Siguiente paso:** priorizar el fix de concurrencia en `routes/ventas.js` y el promedio ponderado en `routes/entradas.js`; después, centralizar la URL del API en el frontend.

### 2026-11-08 — DeepSeek V4.1 Flash — Configuración de Admin y vendedores

**Objetivo:** validar autenticación/roles y dejar operativas las cuentas solicitadas (1 admin + 2 vendedores).

**Cambios:**
- `fronted/src/components/Navbar.js`: "Entradas de Stock" ahora solo se muestra a admin (antes el vendedor veía el enlace aunque la ruta lo redirigía).
- `routes/usuarios.js`: nuevo `PATCH /api/usuarios/:id/username` (solo admin, solo vendedores, valida formato y unicidad). Se extrajo `validateUsername`.
- `fronted/src/pages/Usuarios.js`: botón y formulario "Cambiar nombre" para vendedores.
- `AGENTS.md`: documentada la nueva ruta.
- `.gitignore`: excepciones para versionar `migrations/*.sql`, `supabase/*.sql` y `scripts/diagnostico-pre-supabase.sql` (los respaldos siguen ignorados).

**Datos aplicados (sin guardar claves en el repo):**
- Clave temporal del Admin restablecida y `debe_cambiar_contrasena = TRUE`.
- Creados `vendedor1` (id 7) y `vendedor2` (id 8), rol vendedor, activos, con cambio obligatorio de clave.
- Claves temporales entregadas al usuario por chat; deben cambiarse en el primer ingreso.

**Comandos ejecutados:**
- `node --check` sobre `routes/auth.js`, `routes/usuarios.js`, `middleware/*`, `scripts/reset-admin-password.js` → OK.
- `node --test test/passwords.test.js test/roles.test.js` → 5/5 OK.
- `npm run build` (fronted) → compila; solo warnings preexistentes de `Reportes.js` y `useProductosLogic.js`.
- Pruebas HTTP: login admin/vendedor, creación de vendedores, `/productos` sin costos/márgenes, `/reportes` y `/usuarios` 403 para vendedor, renombrar 200/400/403.
- Backend de 3001 reiniciado para cargar la ruta nueva. Frontend en 3000 sigue corriendo.

**Sin probar:**
- Flujo manual completo en navegador (cambio de clave y venta real).
- No se creó ninguna venta ni se modificó stock.

**Riesgos / notas:**
- `debe_cambiar_contrasena` se exige solo en el frontend; el backend no bloquea otras rutas mientras el cambio esté pendiente. Anotado como mejora.
- La clave `conga2026` (9 caracteres) no cumple la política 12–128; se usó una temporal de 14 caracteres.
- La base conserva solo las cuentas reales (Admin, vendedor1, vendedor2).
- Supabase queda pendiente: no se creó esquema ni sincronización.

**Siguiente paso:** entrar a http://localhost:3000 como Admin, cambiar la clave temporal, verificar la pantalla Usuarios y luego retomar el respaldo en Supabase.

### 2026-11-08 — DeepSeek V4.1 Flash — Respaldo espejo en Supabase

**Objetivo:** montar la misma base en Supabase como respaldo y dejarlo automatizado.

**Cambios:**
- `supabase/schema.sql`: DDL de las 6 tablas + `sync_control`, secuencias, FKs e índices (adaptado de PostgreSQL 18 a Supabase 17).
- `scripts/bootstrap-supabase.js`: crea el esquema una sola vez.
- `scripts/sync-to-supabase.js`: copia completa transaccional (`TRUNCATE` + lotes), ajusta secuencias, verifica conteos, registra en `sync_control`, reintenta conexiones y usa DNS público si falla el local.
- `scripts/sync-supabase.bat`: ejecuta el sync con la ruta completa de Node y deja log.
- `SUPABASE.md`: guía completa.
- `.env.example`: variables `SUPABASE_DATABASE_URL` y `SUPABASE_DB_SSL`.
- `package.json`: scripts `db:supabase:schema` y `db:supabase:sync`.
- `BACKUP.md`: enlace a la guía de Supabase.

**Datos aplicados:**
- Proyecto Supabase `mddlmovkbnjsbbeukska` (PostgreSQL 17.11, `us-west-2`).
- Esquema creado y primera carga: usuarios 3, productos 2.364, ventas 5.024, detalle_venta 7.788, entradas_stock 1.055, gastos 13.
- Tarea programada de Windows `Drogueria - Respaldo Supabase`, diaria a las 23:00; probada con código 0.
- `sync_control` registra cada ejecución.

**Comandos ejecutados:**
- `npm run db:supabase:schema` → OK.
- `npm run db:supabase:sync` → OK (varias veces).
- `schtasks /Run /TN "Drogueria - Respaldo Supabase"` → código 0.
- Validación del esquema en una base temporal → 7 tablas, 4 FKs, 10 índices.

**Sin probar:**
- Restauración desde Supabase hacia local (no se ha necesitado).
- Corte de red prolongado; el script reintenta 3 veces y usa DNS público si falla el local.

**Riesgos / notas:**
- La app sigue usando la base local; Supabase es un espejo diario, no escritura doble.
- El password de la base de Supabase está en `.env` (ignorado por git).
- La clave `sb_secret_...` se compartió por chat; conviene rotarla.
- El plan gratuito de Supabase puede pausar el proyecto por inactividad; el sync diario lo mantiene activo.
- Los vendedores siguen con `debe_cambiar_contrasena = true` hasta que entren por primera vez.

**Siguiente paso:** confirmar que los vendedores ya cambiaron su clave y, si se quiere, subir la frecuencia del sync (cada hora o cada 15 minutos) o agregar un botón de “sincronizar ahora” para admin.

### 2026-11-08 — DeepSeek V4.1 Flash — Botón “Sincronizar ahora” y validaciones

**Objetivo:** permitir que el admin dispare el sync desde la app sin riesgo para el backend.

**Cambios:**
- `routes/supabaseSync.js`: `POST /api/supabase/sync` (solo admin). Lanza el sync en un proceso aparte, con timeout de 5 minutos, bloqueo de concurrencia (`409`) y salida acotada.
- `server.js`: registra el router `/api/supabase`.
- `fronted/src/components/Navbar.js`: botón **“Sincronizar ahora”** solo para admin, con estado “Sincronizando...”.
- `AGENTS.md`: documentada la ruta nueva.
- `SUPABASE.md`: documentado el botón y su funcionamiento.

**Validaciones ejecutadas:**
- Sin token → `401`.
- Con token de vendedor → `403`.
- Dos clics simultáneos del admin → `[200, 409]` (solo corre un sync).
- Servidor responde `200` después del sync.
- Conteos locales antes/después: sin cambios.
- Usuarios de prueba en local y en Supabase: `0`.
- Supabase termina con los 3 usuarios reales: Admin, vendedor1, vendedor2.
- `sync_control` con estados `OK`.
- `npm run build` del frontend: compila.

**Sin probar:**
- Clic real en el navegador. La API y el build están OK; el backend se reinició y las sesiones actuales se perdieron.

**Riesgos / notas:**
- El sync corre en un proceso aparte; un fallo del script no tumba el backend.
- Si el administrador cierra el navegador durante el sync, el proceso continúa.
- El bloqueo de concurrencia es por proceso del backend; además, el script usa un advisory lock en Supabase.

**Siguiente paso:** entrar como Admin, refrescar el navegador (Ctrl+F5) y probar el botón. Si se quiere, subir la frecuencia del sync.

### 2026-11-08 — DeepSeek V4.1 Flash — Navbar: botón “Cerrar sesión” visible

**Objetivo:** hacer visible el botón de cerrar sesión y evitar que la barra se desborde con tantos ítems.

**Cambios:**
- `fronted/src/components/Navbar.js`: “Cerrar sesión” se movió al final y usa la clase `nav-logout`; las acciones usan `nav-action`.
- `fronted/src/components/Navbar.css`: la barra y los enlaces ahora envuelven (`flex-wrap`), y los botones de acción/logout tienen borde y estilo distintivo. El logout queda en rojo.

**Validación:**
- `npm run build` compila; solo quedan los warnings preexistentes de `Reportes.js` y `useProductosLogic.js`.

**Sin probar:**
- Clic visual en el navegador; el cambio es solo de estilos y el build pasó.

**Siguiente paso:** refrescar con Ctrl+F5. El botón **“Cerrar sesión”** debe quedar al final de la barra, con borde rojo.

### 2026-11-08 — DeepSeek V4.1 Flash — Actualización manual desde el escritorio (sin tarea cada 5 min)

**Objetivo:** reemplazar la tarea automática cada 5 minutos por una actualización manual controlada, para no reiniciar el backend en horario de venta.

**Cambios:**
- `scripts/auto-deploy.js`: actualización por sondeo manual; pull `--ff-only`, validación de sintaxis, dependencias, migraciones, build, tests, preflight en el puerto 3002 y reinicio del backend en el 3001. Soporta `--force-restart`.
- `scripts/actualizar-app.bat`: wrapper con confirmación S/N, ejecuta el deploy y pausa al final.
- `scripts/auto-deploy.bat`: wrapper para una eventual tarea programada (no se usa por ahora).
- Escritorio: `C:\Users\drogu\OneDrive\Desktop\Actualizar Drogueria App.bat`.
- `package.json`: script `deploy:auto`.
- `SETUP.md` y `README.md`: documentan la actualización manual.
- `fronted/src/pages/Dashboard.js`: commit aparte que quita tres KPIs de ganancia bruta que ya estaban modificados en el working tree.

**Commits:**
- `9c0dd85` — auto-deploy por sondeo de Git.
- `f753c59` — limpieza de KPIs del dashboard.

**Validaciones:**
- `node scripts/auto-deploy.js` sin cambios → “Sin cambios”.
- `node scripts/auto-deploy.js --force-restart` → preflight 3002 OK, backend 3001 reiniciado y `/api/test` responde.
- La tarea `Drogueria - Auto Deploy` fue eliminada.
- La tarea diaria `Drogueria - Respaldo Supabase` sigue habilitada a las 23:00.

**Sin probar:**
- El `.bat` del escritorio con un commit real desde la máquina de desarrollo.

**Riesgos / notas:**
- El `.bat` reinicia el backend solo si hay cambios de backend; la sesión se cierra.
- No ejecutarlo en medio de una venta.
- Si falla la validación/build/tests antes del reinicio, el backend anterior sigue corriendo.
- El sync de datos no se ejecuta desde el `.bat`; sigue la tarea diaria.

**Siguiente paso:** probar el `.bat` del escritorio con un commit nuevo desde la máquina de desarrollo.

### 2026-11-08 — DeepSeek V4.1 Flash — Esquema `puerto_millo` en Supabase

**Objetivo:** dejar lista la segunda droguería (Puerto Millo) en el mismo proyecto de Supabase, separada por esquema y solo con el catálogo de productos.

**Cambios:**
- `db.js`: soporte `DB_SCHEMA` para fijar `search_path`.
- `scripts/sync-to-supabase.js` y `scripts/migrate.js`: respetan `DB_SCHEMA`; `schema_migrations` se crea en el esquema activo.
- `scripts/create-puerto-millo.js`: crea el esquema `puerto_millo`, copia el catálogo de `public` con stock 0 y vencimiento nulo, registra la migración base y opcionalmente crea Admin.
- `package.json`: script `db:create-puerto-millo`.
- `PUERTO_MILLO.md`: guía de despliegue.
- `.env.example`: `DB_SCHEMA` documentado.
- `SETUP.md`, `SUPABASE.md`, `README.md`, `AGENTS.md`: documentación actualizada.

**Datos aplicados en Supabase:**
- Esquema `puerto_millo`: 2.364 productos (stock 0), 0 ventas, 0 detalles, 0 entradas, 0 gastos, 1 Admin (debe cambiar clave).
- `public` intacto: 3 usuarios, 2.364 productos, 5.024 ventas, 7.788 detalles, 1.055 entradas, 13 gastos.
- `puerto_millo.schema_migrations`: baseline `20261108_users_security.sql`.
- Tablas: 6 de negocio + `schema_migrations` + `sync_control` (sin uso).
- `DB_SCHEMA=puerto_millo` probado contra Supabase: `current_schema()` = `puerto_millo`.
- El script aborta si se vuelve a ejecutar.
- La migración con `DB_SCHEMA=puerto_millo` hace SKIP del baseline.

**Sin probar:**
- Despliegue real de la app de Puerto Millo en otro equipo/host.
- Login con el Admin temporal (no se probó para no cambiar la clave).

**Riesgos / notas:**
- La app de Puerto Millo debe usar `DATABASE_URL` a Supabase + `DB_SCHEMA=puerto_millo` + `SUPABASE_SYNC_ENABLED=false`.
- No ejecutar `db:supabase:sync` en Puerto Millo; allí Supabase es la base principal.
- El sync diario de la droguería actual solo toca `public`.
- La clave temporal del Admin de Puerto Millo se entregó por chat y debe cambiarse en el primer ingreso.
- La `sb_secret_...` sigue pendiente de rotar.

**Siguiente paso:** cuando se decida montar Puerto Millo, clonar el repo en el host, crear el `.env` con `DB_SCHEMA=puerto_millo`, correr `npm run db:migrate:supabase` y arrancar.
---

### 2026-11-08 â€” OpenCode (Beam) â€” Montaje en mÃ¡quina de desarrollo

**Objetivo:** clonar y dejar operativo el proyecto en la mÃ¡quina de desarrollo (Windows), apuntando a PostgreSQL local, con Supabase como espejo quieto en producciÃ³n. Posteriormente se recibieron los 5 commits pendientes del remoto (fast-forward) y se resolviÃ³ el conflicto de HANDOFF.md.

**Cambios:**
- Repo clonado en `C:\Users\BS-TECNOLOGI02\Documents\Desarrolllos prueba\drogueria-app` (rama `main`).
- Dependencias instaladas en raÃ­z y en `fronted/` (`--legacy-peer-deps` en frontend por conflicto de `typescript`).
- Base `drogueria_app` creada en PostgreSQL local (puerto 5432) y restaurada desde `drogueria_app_para_dev.dump` (conteos: usuarios 3, productos 2.364, ventas 5.024, detalle_venta 7.788, entradas_stock 1.055, gastos 13).
- `.env` creado con `DB_*` locales, `PG_DUMP_PATH`, `SUPABASE_SYNC_ENABLED=false`. `SUPABASE_DATABASE_URL` dejada comentada.
- `npm run db:migrate:local` â†’ `SKIP 20261108_users_security.sql`.
- Backend arrancado (`npm run dev`): conecta a PostgreSQL y responde en `http://localhost:3001` (`/api/test` OK).
- Frontend arrancado (`npm start`) en `http://localhost:3000`.
- ContraseÃ±a del rol `postgres` local restablecida a `DrogueriaDev2026!` (script temporal ejecutado como administrador; script borrado despuÃ©s).
- `package-lock.json` revertido para mantener el Ã¡rbol limpio.
- Recibidos 5 commits del remoto (auto-deploy, KPIs dashboard, actualizaciÃ³n manual, esquema puerto_millo, fix productos solo admin). Fast-forward sin conflictos de cÃ³digo; conflicto de HANDOFF.md resuelto combinando ambas versiones.

**Comandos ejecutados:**
- `git clone https://github.com/drogueriaptoconga/drogueria-app.git`
- `npm install` (raÃ­z) y `npm install --legacy-peer-deps` (fronted)
- `createdb` + `pg_restore --no-owner --no-privileges drogueria_app_para_dev.dump`
- `npm run db:migrate:local` â†’ SKIP
- `npm run dev` (backend) y `npm start` (frontend) en background
- `git fetch origin` + `git stash` + `git pull` + `git stash pop` (conflicto resuelto) + `git stash drop`
- `git status` â†’ limpio (salvo `HANDOFF.md`)

**Sin probar:**
- Login manual en navegador (pendiente de la contraseÃ±a real del Admin).
- Flujo completo de venta/entrada/traslado en esta mÃ¡quina.
- Migraciones de esquema a Supabase (`npm run db:migrate:supabase`) por no tener la connection string de la base.
- Sync de datos: **no ejecutado** (bloqueado por `SUPABASE_SYNC_ENABLED=false`).

**Riesgos / notas:**
- La contraseÃ±a `DrogueriaDev2026!` quedÃ³ en el `.env` (ignorado por git). No compartirla.
- Las keys de Supabase publicadas por chat (`sb_publishable_...`, `sb_secret_...`) deben rotarse por seguridad.
- El PostgreSQL local corre en el puerto 5432 estÃ¡ndar.
- Para aplicar migraciones de esquema a Supabase desde aquÃ­, falta la `SUPABASE_DATABASE_URL` (Session Pooler, puerto 5432).

**Siguiente paso:** entrar a `http://localhost:3000` como `Admin` con su contraseÃ±a real y verificar el login; luego, si se requiere, agregar la connection string de Supabase al `.env` para poder correr `npm run db:migrate:supabase`.
'


### 2026-11-08 — OpenCode (Beam) — Ventas por vendedor con filtros de fecha/hora

**Objetivo:** permitir consultar cuánto vendió cada vendedor, con filtros por intervalo de fechas y horas, y mostrar el vendedor en el historial de ventas.

**Cambios:**
- `routes/historial.js`: `/ventas_detallado` ahora hace `LEFT JOIN usuarios` y devuelve `usuario_id`/`usuario_nombre` por venta; filtros opcionales `usuario_id`, `hora_inicio`, `hora_fin` (zona `America/Bogota`).
- `routes/reportes.js`: nuevo `GET /api/reportes/ventas_por_vendedor` que resume por vendedor (cantidad de ventas, total vendido, ganancia) en un rango de fecha/hora, con filtros opcionales de vendedor y método de pago.
- `fronted/src/pages/HistorialDeVentas.js`: columna "Vendedor", filtros de vendedor (admin), hora inicio/fin.
- `fronted/src/pages/VentasPorVendedor.js`: nueva página con resumen por vendedor y totales.
- `fronted/src/App.js` y `fronted/src/components/Navbar.js`: ruta y enlace "Ventas por Vendedor" (solo admin).
- `AGENTS.md`: documentado el nuevo endpoint.

**Comandos ejecutados:**
- `node --check routes/historial.js routes/reportes.js` → OK.
- Prueba SQL directa de ambos queries → OK.
- Prueba HTTP con usuario admin temporal (creado/borrado) de ambos endpoints → 200, datos correctos.
- `npm run build` (fronted) → compiló con warnings preexistentes.

**Sin probar:**
- Clic visual en navegador (UI).
- Filtro por vendedor específico en `/ventas_por_vendedor` con múltiples vendedores (solo Admin tiene ventas en la BD local).

**Riesgos / notas:**
- Los reportes siguen siendo solo admin (`denyIfAsesor`). El vendedor no accede al historial ni a este reporte.
- La hora se interpreta en zona `America/Bogota`; rangos que cruzan medianoche se soportan con la lógica de envoltura.

**Siguiente paso:** probar en navegador como Admin; si se quiere, permitir que el vendedor consulte sus propias ventas.
---

### 2026-11-09 â€” OpenCode (Beam) â€” Correcciones por reporte de producciÃ³n (Conga)

**Objetivo:** atender reporte de la mÃ¡quina de producciÃ³n: dashboard no mostraba datos (cerrar caja) y opciÃ³n de editar productos "desaparecida". Aplicar correcciones robustas y preparar para enviar a producciÃ³n.

**Reporte original (Conga):**
- Dashboard: error al cargar datos; no mostraba ventas del dÃ­a ni permitÃ­a cerrar caja.
- Productos: se eliminÃ³ la opciÃ³n de editar; se pidiÃ³ dejar las opciones al lado del Estado.

**AnÃ¡lisis realizado:**
- Se verificaron los 4 endpoints del Dashboard (`ventas_diarias`, `ganancia_diaria`, `ventas_semana`, `promedio_mensual`) en la BD local con un usuario admin de prueba: todos responden 200. Las queries SQL funcionan.
- El Dashboard usaba `Promise.all`: si un solo endpoint fallaba, **todo** el dashboard fallaba y mostraba "Error al cargar datos".
- La opciÃ³n "Editar/Eliminar" en ProductTable ya existÃ­a para admin, pero estaba en una columna separada al final de la tabla (scroll horizontal), lo que la hacÃ­a difÃ­cil de ver.

**Cambios:**
- `fronted/src/pages/Dashboard.js`: se reemplazÃ³ `Promise.all` por `Promise.allSettled`. Ahora cada KPI se carga de forma independiente: si un endpoint falla, los demÃ¡s se muestran y solo se muestra error si **todos** fallan.
- `fronted/src/pages/ProductTable.js`: los botones "Editar" y "Eliminar" se movieron a la celda de "Estado" (columna "Estado / Acciones"), para que estÃ©n visibles sin scroll horizontal. Se eliminÃ³ la columna "Acciones" separada.
- Se creÃ³ un usuario admin de prueba para validar los endpoints; se borrÃ³ despuÃ©s. No se modificaron datos reales.

**Comandos ejecutados:**
- `npm run build` (frontend) â†’ OK (solo warnings preexistentes).
- `npm test` (backend) â†’ 27/27 OK.
- Endpoints del Dashboard probados con token admin â†’ 200 en los 4.

**Sin probar:**
- VerificaciÃ³n visual en navegador (frontend arrancado en http://localhost:3000).
- Prueba con la clienta en producciÃ³n (pendiente de enviar cambios).

**Riesgos / notas:**
- La causa raÃ­z del fallo en producciÃ³n puede ser: (a) la clienta logueada como vendedor (Dashboard es solo admin), (b) un error de red/CORS si la app estÃ¡ expuesta por tÃºnel, o (c) un endpoint que falla por datos especÃ­ficos de producciÃ³n. La correcciÃ³n de robustez (Promise.allSettled) mitiga el caso (c).
- La columna "Acciones" ahora estÃ¡ junto a "Estado", mÃ¡s visible.

---
### 2026-11-09 — OpenCode — Montaje en mÃ¡quina de desarrollo (esta sesiÃ³n)

**Objetivo:** clonar, instalar, restaurar base local, crear .env, aplicar migraciones y arrancar backend + frontend para dejar el flujo listo para desarrollar.

**Cambios:**
- `C:\Users\capde\drogueria-app`: repo clonado (rama `main`, actualizado con `origin/main`, commit `6e9fc2b`).
- `.env`: creado con `DB_*` locales (`DB_PASSWORD=lauren20`), `DB_SSL=false`, `SUPABASE_SYNC_ENABLED=false`, `SUPABASE_DATABASE_URL` comentado (pendiente de password de Supabase). `.env` estÃ¡ ignorado por git (no se versiona).
- `package-lock.json`: modificado por `npm install` (backend y frontend).

**Base de datos local:**
- Password del rol `postgres` reseteado a `lauren20` (script ejecutado por el usuario como administrador de Windows; pg_hba.conf restaurado a su estado original despuÃ©s).
- Base `drogueria_app` dropeada, recreada y restaurada desde `C:\Users\capde\Downloads\dumb drogeuria\drogueria_app_para_dev.dump`.
- Conteos verificados: usuarios 3, productos 2.364, ventas 5.024, detalle_venta 7.788, entradas_stock 1.055, gastos 13. Coincide con el estado esperado.

**Migraciones:**
- `npm run db:migrate:local` â†ª `SKIP 20261108_users_security.sql` (el dump ya la trae).

**Arranque y verificaciÃ³n:**
- Backend (nodemon, puerto 3001): `http://localhost:3001/api/test` responde `200`.
- Frontend (npm start, puerto 3000): `http://localhost:3000` responde `200` (carga el login).
- `git status`: limpio salvo `package-lock.json` (por npm install) y `.env` (ignorado).

**Comandos ejecutados:**
- `git clone https://github.com/drogueriaptoconga/drogueria-app.git`
- `npm install` (raÃ­z) y `npm install --legacy-peer-deps` (fronted)
- `dropdb` / `createdb` / `pg_restore --no-owner --no-privileges` (base local)
- `npm run db:migrate:local` â†ª SKIP
- `npm run dev` (backend) y `npm start` (frontend)

**Sin probar:**
- Login manual en navegador como `Admin` (pendiente de que el usuario entre con su clave real).
- Flujo completo de venta / entrada / traslado.
- `npm run db:migrate:supabase` (falta `SUPABASE_DATABASE_URL` / password de Supabase).
- `npm run db:supabase:sync`: **NO ejecutado** (prohibido en desarrollo, `SUPABASE_SYNC_ENABLED=false`).
- Tests que escriben en BD (`node --test test`).

**Riesgos / notas:**
- No se crearon usuarios, no se cambiaron contraseñas, no se modificaron datos sin autorizaciÃ³n.
- El Admin ya tiene su clave definitiva; no se tocÃ³.
- vendedor1 y vendedor2 deben cambiar su clave en el primer ingreso (`debe_cambiar_contrasena = TRUE`).
- `SUPABASE_DATABASE_URL` queda comentado; si se consigue el password de Supabase, agregarlo al `.env` y correr `npm run db:migrate:supabase`.
- No se escribiÃ³ directamente en Supabase.

**Siguiente paso:** que el usuario entre a http://localhost:3000 como `Admin` y verifique el login; luego, si se consigue el password de Supabase, completar `SUPABASE_DATABASE_URL` en `.env` y aplicar migraciones a Supabase.

**Siguiente paso:** enviar los cambios a producciÃ³n vÃ­a Git (`git add/commit/push`), luego en producciÃ³n hacer `git pull`, `npm install` si cambiÃ³ package.json, reiniciar backend/frontend. Probar con la clienta.

---
### 2026-11-12 — OpenCode — Desactivar tope de 8 horas en sesiones

**Objetivo:** eliminar el tiempo de expiración de sesiones (8 horas) porque el vendedor se quedaba bloqueado después de varias horas de trabajo.

**Cambios:**
- `middleware/authentication.js`: `SESSION_TTL_MS` cambiado de `8 * 60 * 60 * 1000` (8 horas) a `30 * 24 * 60 * 60 * 1000` (30 días). Las sesiones ya no expiran al cabo de 8 horas; solo se cierran al reiniciar el backend o al cerrar sesión manualmente.

**Comandos ejecutados:**
- `node --check middleware/authentication.js` → OK
- Backend levantado temporalmente para verificar `http://localhost:3001/api/test` → 200 OK

**Sin probar:**
- Login manual prolongado para verificar que no expire antes de 30 días.
- Despliegue en producción (pendiente de `git pull` en la máquina de la cliente).

**Riesgos / notas:**
- Las sesiones siguen viviendo en memoria del backend; si el backend se reinicia (actualización por Git, apagón, reinicio de PC), todas las sesiones se borran y hay que volver a hacer login. Para evitar eso sería necesario pasar las sesiones a la base de datos.
- Este cambio se envía por Git; en producción debe aplicarse con el botón/scripts de actualizar.

**Siguiente paso:** `git add/commit/push` y luego en producción ejecutar la actualización.
'
