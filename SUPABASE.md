# Respaldo espejo en Supabase

## Estado actual (2026-11-08)

- Proyecto Supabase: `mddlmovkbnjsbbeukska` (PostgreSQL 17.11, región `us-west-2`).
- Esquema creado y primera carga completada.
- Conteos en Supabase: usuarios 3, productos 2.364, ventas 5.024, detalle_venta 7.788, entradas_stock 1.055, gastos 13.
- Tarea programada de Windows: **`Drogueria - Respaldo Supabase`**, diaria a las **11:00 p. m.**
- Log: `logs/supabase-sync.log`.
- `sync_control` registra cada ejecución con estado `OK` o `ERROR`.

## Botón "Sincronizar ahora"

En la barra superior, solo para administradores, hay un botón **“Sincronizar ahora”**
junto a **“Respaldar BD”**:

- Llama a `POST /api/supabase/sync`.
- El sync corre en un **proceso Node aparte**, no dentro del servidor web.
- Tiene **timeout de 5 minutos** y un bloqueo: si ya hay un sync en curso, responde `409`.
- Si el navegador se cierra, el sync continúa.
- Si falla, el mensaje muestra las últimas líneas del log.
- También se puede ejecutar a mano con `npm run db:supabase:sync`.

## Cómo funciona

La aplicación sigue trabajando contra el **PostgreSQL local** (funciona sin internet).
Un trabajo programado toma una foto completa de la base local y la deja en Supabase
en **una sola transacción**:

```text
App  ->  PostgreSQL local  --(sync programado)-->  Supabase (espejo de solo lectura para respaldo)
```

No se hace escritura doble en tiempo real. Eso evita ventas a medias si falla internet
o si una de las dos bases rechaza una operación. La copia diaria es completa y atómica:
mientras corre, Supabase sigue mostrando la copia anterior; si algo falla, hace rollback.

## Requisitos

1. Proyecto de Supabase activo.
2. Cadena de conexión del **Session Pooler** (puerto **5432**, no el Transaction Pooler 6543).
3. Password de la base de Supabase.

> Las claves `sb_publishable_...` y `sb_secret_...` son para la API (REST/Auth/Storage).
> **No sirven para conectarse a PostgreSQL ni para crear tablas.** La sincronización usa
> la cadena de conexión de la base con el usuario `postgres`.

### Dónde sacar la cadena

Supabase Dashboard → botón **Connect** (arriba) → **Session pooler** → copiar la URI.
Si aparece `[YOUR-PASSWORD]`, reemplazarlo por el password de la base. Si no lo recuerdas:
Project Settings → Database → **Reset database password**.

## Configuración

Agregar al `.env` (nunca commitear este archivo):

```env
SUPABASE_DATABASE_URL=postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
SUPABASE_DB_SSL=true
```

## Primera carga

```bash
# 1. Crear tablas, secuencias, FKs e índices en Supabase
npm run db:supabase:schema

# 2. Copiar todos los datos (usuarios, productos, ventas, detalle, entradas, gastos)
npm run db:supabase:sync
```

El esquema se crea una sola vez. Si las tablas ya existen, el primer comando no hace nada
y avisa que uses el segundo.

## Verificar

En el SQL Editor de Supabase:

```sql
-- Últimas sincronizaciones
select * from public.sync_control order by id desc limit 5;

-- Conteos esperados (deben coincidir con la base local)
select 'usuarios' as tabla, count(*) from public.usuarios
union all select 'productos', count(*) from public.productos
union all select 'ventas', count(*) from public.ventas
union all select 'detalle_venta', count(*) from public.detalle_venta
union all select 'entradas_stock', count(*) from public.entradas_stock
union all select 'gastos', count(*) from public.gastos;
```

## Programar la sincronización diaria

La tarea **ya está creada** en este equipo:

- Nombre: `Drogueria - Respaldo Supabase`
- Frecuencia: diaria, 11:00 p. m.
- Ejecuta: `scripts/sync-supabase.bat`
- Log: `logs/supabase-sync.log`
- Última prueba: código `0` (correcta)

> La tarea quedó configurada como **“Solo interactivo”**: corre con la sesión de Windows
> del usuario `drogu` iniciada. Si el equipo se apaga o se cierra sesión, no corre.
> Para que corra siempre, en el Programador de tareas → Propiedades → “Ejecutar tanto
> si el usuario inició sesión como si no” (requiere guardar la contraseña de Windows).

El proyecto incluye `scripts/sync-supabase.bat`, que ejecuta la sincronización y escribe
el resultado en `logs/supabase-sync.log`.

En Windows:

1. Abrir **Programador de tareas** → **Crear tarea básica**.
2. Nombre: `Drogueria - Respaldo Supabase`.
3. Frecuencia: **Diaria**, a la hora de cierre (por ejemplo 11:00 p. m.).
4. Acción: **Iniciar un programa**.
   - Programa: `C:\xampp\htdocs\drogueria-app\scripts\sync-supabase.bat`
   - Iniciar en: `C:\xampp\htdocs\drogueria-app`
5. Guardar y probar con **Ejecutar**.

También se puede ejecutar manualmente:

```bash
npm run db:supabase:sync
```

## Notas importantes

- **No escribir directamente en Supabase.** La sincronización reemplaza las 6 tablas de
  `public`; cualquier cambio hecho solo allá se pierde en la siguiente copia.
- El script reintenta la conexión 3 veces. Si el DNS local falla, resuelve con DNS público
  (`8.8.8.8` / `1.1.1.1`) y se conecta por IP; esto cubre los cortes intermitentes de DNS
  que se vieron en este equipo.
- Los usuarios se crean en la app local y se replican. Los hashes de contraseña viajan
  tal cual; no se exponen al frontend.
- El plan gratuito de Supabase puede pausar proyectos por inactividad; una sincronización
  diaria mantiene el proyecto activo. El plan gratuito no incluye los backups automáticos
  ni el PITR de los planes pagos; este espejo es el respaldo propio.
- La base actual pesa ~10 MB. El plan gratuito de Supabase incluye 500 MB.
- Si algún día se necesita una copia casi en tiempo real, se puede subir la frecuencia
  (cada hora o cada 15 minutos) sin cambiar el diseño. La escritura doble en vivo no se
  recomienda.
- Rotar la clave `sb_secret_...` si se compartió por chat o quedó en algún log.
