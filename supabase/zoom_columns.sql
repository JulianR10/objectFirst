-- Ejecutar en Supabase → SQL Editor (una vez).
-- 1. Columnas con el resultado del registro en Zoom (las escribe /api/register).
alter table public.webinar_registrations_italia
  add column if not exists zoom_registrant_id text,
  add column if not exists zoom_join_url text,
  add column if not exists zoom_status text,   -- ok | error
  add column if not exists zoom_error text,
  add column if not exists referrer text;      -- sitio de origen si no hay UTMs

-- 1b. Teléfono (opcional en el formulario). Ejecutar ANTES de deployar el cambio,
--     si no el insert de /api/register falla por columna inexistente.
alter table public.webinar_registrations_italia
  add column if not exists telefono text;

-- 2. DESPUÉS de verificar que /api/register funciona en producción:
--    quitar el INSERT público, para que nadie se salte Zoom usando la key publicable.
--    /api/register usa la service_role key, que ignora RLS.
--    Ver el nombre real de la policy con:
--      select policyname, cmd, roles from pg_policies where tablename = 'webinar_registrations_italia';
--    y luego:
--      drop policy "<nombre_de_la_policy_insert>" on public.webinar_registrations_italia;

-- 3. Leads que Zoom no pudo registrar (para reprocesar):
--    select * from public.webinar_registrations_italia where zoom_status = 'error';
