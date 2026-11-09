-- ============================================================================
-- DIAGNOSTICO: que es admin@conga.com y que existe en este proyecto Supabase
-- ============================================================================
-- SOLO LECTURA. Ejecutar en: Supabase Dashboard -> SQL Editor -> New query.
-- No modifica nada.
-- ============================================================================


-- 1. Contexto del proyecto
SELECT
    current_database()  AS base,
    current_user        AS usuario_conectado,
    version()           AS version_postgres;


-- 2. ¿Es un usuario de Supabase Authentication?
--    Si devuelve una fila, es usuario de Auth (NO es un rol de Postgres).
SELECT
    id,
    email,
    phone,
    email_confirmed_at,
    created_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    raw_app_meta_data ->> 'role' AS rol_en_metadata
FROM auth.users
WHERE lower(email) = lower('admin@conga.com');


-- 3. ¿Es un rol de PostgreSQL?
--    Si devuelve una fila, se creo como rol de base de datos.
SELECT
    rolname,
    rolcanlogin   AS puede_login,
    rolsuper      AS superusuario,
    rolcreatedb   AS crea_bases,
    rolcreaterole AS crea_roles,
    rolreplication AS replicacion
FROM pg_roles
WHERE rolname = 'admin@conga.com';


-- 4. ¿Que tablas existen hoy en public?
--    (Si esta vacio, el esquema de la drogueria aun no se ha creado.)
SELECT
    table_schema,
    table_name,
    (SELECT count(*) FROM information_schema.columns col
      WHERE col.table_schema = t.table_schema
        AND col.table_name = t.table_name) AS columnas
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;


-- 5. Permisos actuales por tabla y rol
SELECT
    table_name,
    grantee,
    string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privilegios
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
GROUP BY table_name, grantee
ORDER BY table_name, grantee;


-- 6. RLS habilitado por tabla
SELECT
    n.nspname       AS esquema,
    c.relname       AS tabla,
    c.relrowsecurity AS rls_habilitado,
    c.relforcerowsecurity AS rls_forzado
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r'
  AND n.nspname = 'public'
ORDER BY 1, 2;


-- 7. Politicas RLS existentes
SELECT
    schemaname AS esquema,
    tablename  AS tabla,
    policyname AS politica,
    roles,
    cmd,
    qual       AS condicion_using,
    with_check AS condicion_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY 1, 2, 3;


-- 8. Roles estandar de Supabase (referencia)
SELECT rolname, rolcanlogin, rolsuper
FROM pg_roles
WHERE rolname IN ('postgres', 'anon', 'authenticated', 'service_role', 'supabase_admin', 'supabase_auth_admin')
ORDER BY rolname;
