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
