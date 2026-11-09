-- ============================================================================
-- PERMISOS PARA admin@conga.com  (ejecutar DESPUES del diagnostico)
-- ============================================================================
-- IMPORTANTE:
--   * admin@conga.com (con @) normalmente es un usuario de Authentication,
--     NO un rol de PostgreSQL. Un usuario Auth no se conecta con `pg` ni con
--     DBeaver usando ese correo; para eso se usa el usuario `postgres` de la
--     cadena de conexion de Supabase.
--   * Para el respaldo diario NO hace falta dar permisos especiales: la
--     sincronizacion usa el usuario `postgres`, que ya es dueno de las tablas.
--   * Este script es idempotente: se puede ejecutar varias veces.
--   * No toca la estructura de `public.usuarios`. Si el otro agente esta
--     migrando usuarios, puedes ejecutar los GRANT sin conflicto.
-- ============================================================================


-- ============================================================================
-- CASO A: admin@conga.com es usuario de Supabase Authentication
-- ============================================================================

-- A.1 Permisos base para los roles de la API de Supabase.
--     `authenticated` = usuarios logueados por Supabase Auth.
--     `service_role`  = backend con permisos totales.
--     No se da DML a `anon` (visitantes sin login) por seguridad.
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
    ON ALL TABLES IN SCHEMA public
    TO authenticated, service_role;

GRANT USAGE, SELECT
    ON ALL SEQUENCES IN SCHEMA public
    TO authenticated, service_role;

-- Que las tablas/secuencias que se creen en el futuro hereden los permisos.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO authenticated, service_role;


-- A.2 (OPCIONAL) Marcar al usuario como admin en su metadata.
--     Solo sirve si luego usas RLS o un panel con Supabase Auth.
--     En Supabase el rol `postgres` puede no tener permiso de UPDATE sobre
--     `auth.users`; si falla, hazlo con la Admin API usando la service_role key
--     o desde Dashboard -> Authentication -> Users.
--
-- UPDATE auth.users
-- SET raw_app_meta_data =
--       COALESCE(raw_app_meta_data, '{}'::jsonb)
--       || jsonb_build_object('role', 'admin')
-- WHERE lower(email) = lower('admin@conga.com');


-- A.3 (OPCIONAL) RLS: lectura para logueados, escritura solo admin.
--     NO lo apliques sobre `usuarios` hasta que termine la migracion del otro
--     agente. Descomenta y adapta cuando el esquema ya exista.
--
-- ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;
--
-- CREATE POLICY "productos_lectura_autenticados"
--     ON public.productos
--     FOR SELECT
--     TO authenticated
--     USING (true);
--
-- CREATE POLICY "productos_escritura_admin"
--     ON public.productos
--     FOR ALL
--     TO authenticated
--     USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
--     WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');


-- ============================================================================
-- CASO B: quieres un rol de PostgreSQL dedicado (no Auth)
-- ============================================================================
-- Recomendacion: para la sincronizacion usa el usuario `postgres` que ya viene
-- en la cadena de conexion. Solo crea este rol si necesitas separar permisos.
-- Cambia la contrasena antes de descomentar. Funciona con conexion directa o
-- Session Pooler; el Transaction Pooler (puerto 6543) puede no aceptarlo.
--
-- DO $$
-- BEGIN
--     IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'drogueria_app') THEN
--         CREATE ROLE drogueria_app LOGIN PASSWORD 'CAMBIA_ESTA_CLAVE_LARGA_Y_UNICA';
--     END IF;
-- END $$;
--
-- GRANT CONNECT ON DATABASE postgres TO drogueria_app;
-- GRANT USAGE ON SCHEMA public TO drogueria_app;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO drogueria_app;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO drogueria_app;
--
-- ALTER DEFAULT PRIVILEGES IN SCHEMA public
--     GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO drogueria_app;
-- ALTER DEFAULT PRIVILEGES IN SCHEMA public
--     GRANT USAGE, SELECT ON SEQUENCES TO drogueria_app;


-- ============================================================================
-- VERIFICACION
-- ============================================================================

-- ¿Existe el rol?
SELECT rolname, rolcanlogin, rolsuper, rolcreatedb, rolcreaterole
FROM pg_roles
WHERE rolname IN ('admin@conga.com', 'drogueria_app')
ORDER BY rolname;

-- ¿Que permisos quedaron en public?
SELECT
    grantee,
    table_name,
    string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privilegios
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
GROUP BY grantee, table_name
ORDER BY grantee, table_name;
