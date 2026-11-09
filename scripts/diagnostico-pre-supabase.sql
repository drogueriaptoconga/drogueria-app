-- ============================================================================
-- DIAGNOSTICO PRE-SUPABASE
-- Proyecto: Drogueria App
-- Motor: PostgreSQL (probado en 18.x, compatible con 12+)
-- Uso: DBeaver -> conexion a la BD LOCAL -> abrir este archivo -> "Execute SQL script"
--      (Alt+X en Windows). Es SOLO LECTURA: no altera datos ni estructura.
--      Solo crea una tabla TEMPORAL para el chequeo de secuencias.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. DATOS GENERALES DEL SERVIDOR Y LA BASE
-- ---------------------------------------------------------------------------
SELECT
    version()                                        AS version_servidor,
    current_database()                               AS base_actual,
    current_user                                     AS usuario_actual,
    current_setting('server_version')                AS version_corta,
    current_setting('server_encoding')               AS encoding_servidor,
    current_setting('client_encoding')               AS encoding_cliente,
    current_setting('TimeZone')                      AS zona_horaria,
    current_setting('wal_level')                     AS wal_level,
    current_setting('max_connections')               AS max_conexiones;

SELECT
    datname                                          AS base,
    pg_encoding_to_char(encoding)                    AS encoding,
    datcollate                                       AS collation,
    datctype                                         AS ctype,
    pg_size_pretty(pg_database_size(datname))        AS tamano
FROM pg_database
WHERE datname = current_database();


-- ---------------------------------------------------------------------------
-- 2. TAMANO POR TABLA
-- ---------------------------------------------------------------------------
SELECT
    n.nspname                                        AS esquema,
    c.relname                                        AS tabla,
    c.reltuples::bigint                              AS filas_estimadas,
    pg_size_pretty(pg_total_relation_size(c.oid))    AS tamano_total,
    pg_size_pretty(pg_relation_size(c.oid))          AS solo_datos,
    pg_size_pretty(pg_indexes_size(c.oid))           AS indices,
    pg_size_pretty(pg_total_relation_size(c.reltoastrelid)) AS toast
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r'
  AND n.nspname NOT IN ('pg_catalog', 'information_schema')
ORDER BY pg_total_relation_size(c.oid) DESC;


-- ---------------------------------------------------------------------------
-- 3. CONTEO EXACTO DE FILAS (todas las tablas, sin escribir nombres a mano)
-- ---------------------------------------------------------------------------
SELECT
    n.nspname                                        AS esquema,
    c.relname                                        AS tabla,
    (xpath('/row/c/text()',
        query_to_xml(
            format('SELECT count(*) AS c FROM %I.%I', n.nspname, c.relname),
            false, true, ''
        )
    ))[1]::text::bigint                              AS filas_exactas
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r'
  AND n.nspname NOT IN ('pg_catalog', 'information_schema')
ORDER BY 1, 2;


-- ---------------------------------------------------------------------------
-- 4. COLUMNAS (tipos, nulos, defaults, identity/generated)
-- ---------------------------------------------------------------------------
SELECT
    c.table_schema                                   AS esquema,
    c.table_name                                     AS tabla,
    c.ordinal_position                               AS pos,
    c.column_name                                    AS columna,
    c.data_type                                      AS tipo,
    c.character_maximum_length                       AS largo,
    c.numeric_precision                              AS precision,
    c.numeric_scale                                  AS escala,
    c.is_nullable                                    AS permite_null,
    c.column_default                                 AS default_valor,
    c.is_identity                                    AS es_identity,
    c.is_generated                                   AS es_generada,
    c.collation_name                                 AS collation
FROM information_schema.columns c
WHERE c.table_schema NOT IN ('pg_catalog', 'information_schema')
ORDER BY c.table_schema, c.table_name, c.ordinal_position;


-- ---------------------------------------------------------------------------
-- 5. RESTRICCIONES (PK, FK, UNIQUE, CHECK y acciones ON DELETE/UPDATE)
-- ---------------------------------------------------------------------------
SELECT
    con.conrelid::regclass                           AS tabla,
    con.conname                                      AS restriccion,
    con.contype                                      AS tipo,   -- p=PK, f=FK, u=UNIQUE, c=CHECK, x=EXCLUDE
    pg_get_constraintdef(con.oid)                    AS definicion,
    CASE con.confdeltype
        WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT'
        WHEN 'c' THEN 'CASCADE'   WHEN 'n' THEN 'SET NULL'
        WHEN 'd' THEN 'SET DEFAULT' ELSE NULL
    END                                              AS on_delete,
    CASE con.confupdtype
        WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT'
        WHEN 'c' THEN 'CASCADE'   WHEN 'n' THEN 'SET NULL'
        WHEN 'd' THEN 'SET DEFAULT' ELSE NULL
    END                                              AS on_update,
    con.condeferrable                                AS diferible,
    con.convalidated                                 AS validada
FROM pg_constraint con
WHERE con.connamespace = 'public'::regnamespace
ORDER BY 1, 2;


-- ---------------------------------------------------------------------------
-- 6. INDICES (incluye los implicados por PK/UNIQUE)
-- ---------------------------------------------------------------------------
SELECT
    schemaname                                       AS esquema,
    tablename                                        AS tabla,
    indexname                                        AS indice,
    indexdef                                         AS definicion
FROM pg_indexes
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY 1, 2, 3;


-- ---------------------------------------------------------------------------
-- 7. SECUENCIAS Y DESFASE vs MAX(id)
--    (detecta el problema tipico de "duplicate key value violates unique
--     constraint" cuando la secuencia quedo atras)
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS _diag_secuencias;
CREATE TEMP TABLE _diag_secuencias (
    esquema        text,
    secuencia      text,
    tabla          text,
    columna        text,
    valor_secuencia bigint,
    is_called      boolean,
    max_id         bigint,
    estado         text
);

DO $$
DECLARE
    r        record;
    v_max    bigint;
    v_last   bigint;
    v_called boolean;
    v_efectivo bigint;
BEGIN
    FOR r IN
        SELECT ns.nspname AS sch, s.relname AS seq,
               t.relname AS tbl, a.attname AS col
        FROM pg_class s
        JOIN pg_namespace ns ON ns.oid = s.relnamespace
        JOIN pg_depend d
             ON d.objid = s.oid
            AND d.classid = 'pg_class'::regclass
            AND d.refclassid = 'pg_class'::regclass
            AND d.deptype IN ('a', 'i')
        JOIN pg_class t ON t.oid = d.refobjid
        JOIN pg_attribute a
             ON a.attrelid = t.oid
            AND a.attnum = d.refobjsubid
        WHERE s.relkind = 'S'
          AND ns.nspname NOT IN ('pg_catalog', 'information_schema')
    LOOP
        EXECUTE format('SELECT COALESCE(MAX(%I), 0) FROM %I.%I', r.col, r.sch, r.tbl)
           INTO v_max;
        EXECUTE format('SELECT last_value, is_called FROM %I.%I', r.sch, r.seq)
           INTO v_last, v_called;

        v_efectivo := CASE WHEN v_called THEN v_last ELSE v_last - 1 END;

        INSERT INTO _diag_secuencias
        VALUES (
            r.sch, r.seq, r.tbl, r.col, v_last, v_called, v_max,
            CASE WHEN v_efectivo < v_max
                 THEN 'DRIFT: secuencia por debajo del MAX(id)'
                 ELSE 'OK'
            END
        );
    END LOOP;
END $$;

SELECT * FROM _diag_secuencias ORDER BY esquema, tabla;


-- ---------------------------------------------------------------------------
-- 8. TRIGGERS
-- ---------------------------------------------------------------------------
SELECT
    n.nspname                                        AS esquema,
    c.relname                                        AS tabla,
    t.tgname                                         AS trigger,
    pg_get_triggerdef(t.oid)                         AS definicion,
    t.tgenabled                                      AS habilitado,
    CASE t.tgenabled
        WHEN 'O' THEN 'ORIGIN (activo)'
        WHEN 'D' THEN 'DISABLED'
        WHEN 'R' THEN 'REPLICA'
        WHEN 'A' THEN 'ALWAYS'
        ELSE t.tgenabled::text
    END                                              AS estado
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE NOT t.tgisinternal
  AND n.nspname NOT IN ('pg_catalog', 'information_schema')
ORDER BY 1, 2, 3;


-- ---------------------------------------------------------------------------
-- 9. VISTAS Y VISTAS MATERIALIZADAS
-- ---------------------------------------------------------------------------
SELECT
    schemaname                                       AS esquema,
    viewname                                         AS vista,
    definition                                       AS definicion
FROM pg_views
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY 1, 2;

SELECT
    schemaname                                       AS esquema,
    matviewname                                      AS vista_materializada,
    ispopulated                                      AS poblada,
    pg_get_viewdef(format('%I.%I', schemaname, matviewname)::regclass, true) AS definicion
FROM pg_matviews
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY 1, 2;


-- ---------------------------------------------------------------------------
-- 10. FUNCIONES / PROCEDIMIENTOS
-- ---------------------------------------------------------------------------
SELECT
    n.nspname                                        AS esquema,
    p.proname                                        AS rutina,
    CASE p.prokind WHEN 'f' THEN 'funcion' WHEN 'p' THEN 'procedimiento'
                   WHEN 'a' THEN 'agregado' WHEN 'w' THEN 'window' END AS tipo,
    pg_get_function_identity_arguments(p.oid)        AS argumentos,
    l.lanname                                        AS lenguaje,
    p.prosecdef                                      AS security_definer,
    pg_get_functiondef(p.oid)                        AS definicion
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
JOIN pg_language l ON l.oid = p.prolang
WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
  AND p.prokind IN ('f', 'p')
ORDER BY 1, 2;


-- ---------------------------------------------------------------------------
-- 11. TIPOS PROPIOS (ENUM / DOMINIOS / COMPUESTOS)
-- ---------------------------------------------------------------------------
SELECT
    n.nspname                                        AS esquema,
    t.typname                                        AS tipo,
    CASE t.typtype WHEN 'e' THEN 'ENUM' WHEN 'd' THEN 'DOMINIO'
                   WHEN 'c' THEN 'COMPUESTO' WHEN 'b' THEN 'BASE' END AS clase,
    string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) AS valores_enum
FROM pg_type t
JOIN pg_namespace n ON n.oid = t.typnamespace
LEFT JOIN pg_enum e ON e.enumtypid = t.oid
WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
  AND t.typtype IN ('e', 'd', 'c')
GROUP BY 1, 2, 3
ORDER BY 1, 2;


-- ---------------------------------------------------------------------------
-- 12. EXTENSIONES INSTALADAS
-- ---------------------------------------------------------------------------
SELECT
    e.extname                                        AS extension,
    e.extversion                                     AS version,
    n.nspname                                        AS esquema
FROM pg_extension e
JOIN pg_namespace n ON n.oid = e.extnamespace
ORDER BY 1;


-- ---------------------------------------------------------------------------
-- 13. DUENOS, PERMISOS Y ROLES (para replicar privilegios en Supabase)
-- ---------------------------------------------------------------------------
SELECT
    schemaname                                       AS esquema,
    tablename                                        AS tabla,
    tableowner                                       AS dueno
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY 1, 2;

SELECT
    table_schema                                     AS esquema,
    table_name                                       AS tabla,
    grantee                                          AS rol,
    string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privilegios
FROM information_schema.role_table_grants
WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
GROUP BY 1, 2, 3
ORDER BY 1, 2, 3;

SELECT
    rolname                                          AS rol,
    rolsuper                                         AS superuser,
    rolcreaterole                                    AS crea_roles,
    rolcreatedb                                      AS crea_bd,
    rolcanlogin                                      AS puede_login,
    rolreplication                                   AS replicacion
FROM pg_roles
WHERE rolname NOT LIKE 'pg\_%'
ORDER BY 1;


-- ---------------------------------------------------------------------------
-- 14. RLS Y POLITICAS (local normalmente vacio; en Supabase puede haber)
-- ---------------------------------------------------------------------------
SELECT
    n.nspname                                        AS esquema,
    c.relname                                        AS tabla,
    c.relrowsecurity                                 AS rls_habilitado,
    c.relforcerowsecurity                            AS rls_forzado
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r'
  AND n.nspname NOT IN ('pg_catalog', 'information_schema')
ORDER BY 1, 2;

SELECT
    schemaname                                       AS esquema,
    tablename                                        AS tabla,
    policyname                                       AS politica,
    permissive,
    roles,
    cmd,
    qual                                             AS using_expr,
    with_check
FROM pg_policies
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY 1, 2, 3;


-- ---------------------------------------------------------------------------
-- 15. REPLICACION (publicaciones / suscripciones)
-- ---------------------------------------------------------------------------
SELECT pubname AS publicacion, puballtables AS todas_las_tablas, pubinsert, pubupdate, pubdelete, pubtruncate
FROM pg_publication
ORDER BY 1;

SELECT subname AS suscripcion, subenabled AS habilitada, subslotname AS slot
FROM pg_subscription
ORDER BY 1;


-- ---------------------------------------------------------------------------
-- 16. OBJETOS FUERA DE public (sorpresa tipica al migrar)
-- ---------------------------------------------------------------------------
SELECT
    n.nspname                                        AS esquema,
    c.relname                                        AS objeto,
    CASE c.relkind
        WHEN 'r' THEN 'tabla' WHEN 'p' THEN 'tabla particionada'
        WHEN 'v' THEN 'vista' WHEN 'm' THEN 'vista materializada'
        WHEN 'S' THEN 'secuencia' WHEN 'f' THEN 'tabla foranea'
    END                                              AS tipo
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
  AND n.nspname NOT LIKE 'pg_temp_%'
  AND n.nspname NOT LIKE 'pg_toast_temp_%'
  AND n.nspname <> 'public'
ORDER BY 1, 2;


-- ---------------------------------------------------------------------------
-- 17. HALLAZGOS / ADVERTENCIAS
--    Cada fila es un problema detectado. Si no devuelve filas: todo OK.
-- ---------------------------------------------------------------------------
SELECT 'ALTA' AS severidad,
       'Falta la columna usuarios.activo' AS hallazgo,
       'routes/auth.js la usa en el login. Aplicar migrations/20261108_users_security.sql' AS accion
WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'usuarios' AND column_name = 'activo'
)
UNION ALL
SELECT 'ALTA',
       'Falta la columna usuarios.debe_cambiar_contrasena',
       'routes/auth.js la usa en el login. Aplicar migrations/20261108_users_security.sql'
WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'usuarios' AND column_name = 'debe_cambiar_contrasena'
)
UNION ALL
SELECT 'ALTA',
       'Hay tablas sin PRIMARY KEY: ' || string_agg(c.relname, ', '),
       'Agregar PK antes de replicar (TRUNCATE/COPY y actualizaciones dependen de ella)'
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r'
  AND n.nspname = 'public'
  AND NOT EXISTS (SELECT 1 FROM pg_constraint con WHERE con.conrelid = c.oid AND con.contype = 'p')
HAVING count(*) > 0
UNION ALL
SELECT 'MEDIA',
       'Extensiones adicionales: ' || string_agg(extname, ', '),
       'Verificar que Supabase las soporte (CREATE EXTENSION)'
FROM pg_extension
WHERE extname <> 'plpgsql'
HAVING count(*) > 0
UNION ALL
SELECT 'MEDIA',
       'Indices invalidos: ' || string_agg(indexrelid::regclass::text, ', '),
       'Reindexar antes de la copia'
FROM pg_index
WHERE NOT indisvalid
HAVING count(*) > 0
UNION ALL
SELECT 'MEDIA',
       'FKs no validadas: ' || string_agg(conname, ', '),
       'Revisar datos huerfanos antes de replicar'
FROM pg_constraint
WHERE connamespace = 'public'::regnamespace
  AND contype = 'f'
  AND NOT convalidated
HAVING count(*) > 0
UNION ALL
SELECT 'MEDIA',
       'Hay objetos en esquemas distintos de public: ' || string_agg(DISTINCT n.nspname, ', '),
       'Decidir si se migran o se excluyen'
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
  AND n.nspname NOT LIKE 'pg_temp_%'
  AND n.nspname NOT LIKE 'pg_toast_temp_%'
  AND n.nspname <> 'public'
HAVING count(*) > 0
UNION ALL
SELECT 'MEDIA',
       'La base no usa UTF8',
       'Crear el proyecto Supabase con UTF8 (por defecto) y revisar acentos'
WHERE current_setting('server_encoding') <> 'UTF8'
UNION ALL
SELECT 'BAJA',
       'wal_level = ' || current_setting('wal_level'),
       'Solo es relevante para replicacion logica. No afecta a la copia con COPY/TRUNCATE'
WHERE current_setting('wal_level') <> 'logical'
UNION ALL
SELECT 'BAJA',
       'Hay objetos grandes (large objects): ' || count(*),
       'COPY no los incluye. Exportarlos aparte si se usan'
FROM pg_largeobject_metadata
HAVING count(*) > 0
UNION ALL
SELECT 'ALTA',
       'Desfase de secuencia en: ' || string_agg(tabla || '.' || columna, ', '),
       'Reajustar con setval antes de sincronizar'
FROM _diag_secuencias
WHERE estado <> 'OK'
HAVING count(*) > 0
ORDER BY severidad, hallazgo;


-- ---------------------------------------------------------------------------
-- 18. RESUMEN FINAL (una sola fila para copiar/pegar si hay que reportar)
-- ---------------------------------------------------------------------------
SELECT
    current_database()                               AS base,
    current_setting('server_version')                AS version_pg,
    pg_size_pretty(pg_database_size(current_database())) AS tamano,
    (SELECT count(*) FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind = 'r' AND n.nspname = 'public')  AS tablas,
    (SELECT count(*) FROM pg_constraint
      WHERE connamespace = 'public'::regnamespace AND contype = 'f') AS foreign_keys,
    (SELECT count(*) FROM pg_indexes
      WHERE schemaname = 'public')                     AS indices,
    (SELECT count(*) FROM pg_trigger t
       JOIN pg_class c ON c.oid = t.tgrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE NOT t.tgisinternal AND n.nspname = 'public') AS triggers,
    (SELECT count(*) FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public')                      AS funciones,
    (SELECT count(*) FROM pg_views WHERE schemaname = 'public') AS vistas,
    (SELECT count(*) FROM pg_extension)                AS extensiones;
