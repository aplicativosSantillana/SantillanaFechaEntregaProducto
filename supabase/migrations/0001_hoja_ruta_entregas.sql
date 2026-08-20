-- Registro de entregas con incidencias (hoja de ruta).
-- SQL Server (cabHojaDeRutaReg / linHojaDeRutaReg) sigue siendo solo lectura;
-- estas tablas son la fuente propia de la app para asignaciones, catálogo de
-- incidencias y registros de entrega.
--
-- Aplicar manualmente desde el SQL Editor del dashboard de Supabase
-- (no hay CLI de Supabase configurado en este proyecto).

-- ---------------------------------------------------------------------------
-- profiles: rol de cada usuario. Se crea manualmente (INSERT) después de dar
-- de alta el usuario en Authentication → Users, igual que hoy se crean los
-- usuarios a mano.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('admin', 'jefe_bodega', 'transportista')),
  nombre text not null,
  created_at timestamptz not null default now()
);

-- Función SECURITY DEFINER para leer el rol del usuario actual sin disparar
-- recursión de RLS sobre la propia tabla profiles.
create or replace function public.current_user_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid();
$$;

alter table public.profiles enable row level security;
grant select on public.profiles to authenticated;

create policy "profiles_select_self_or_gestor"
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or public.current_user_role() in ('admin', 'jefe_bodega'));

-- ---------------------------------------------------------------------------
-- incidencias_catalogo
-- ---------------------------------------------------------------------------
create table if not exists public.incidencias_catalogo (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  orden int not null default 0,
  activo boolean not null default true
);

alter table public.incidencias_catalogo enable row level security;
grant select, insert, update, delete on public.incidencias_catalogo to authenticated;

create policy "incidencias_select_authenticated"
  on public.incidencias_catalogo for select
  to authenticated
  using (true);

create policy "incidencias_manage_admin"
  on public.incidencias_catalogo for all
  to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

insert into public.incidencias_catalogo (nombre, orden) values
  ('Entregado sin incidencia', 1),
  ('Producto duplicado', 2),
  ('Producto faltante', 3),
  ('Producto cruzado', 4),
  ('Producto dañado', 5),
  ('Cliente ausente', 6),
  ('Otro', 99)
on conflict (nombre) do nothing;

-- ---------------------------------------------------------------------------
-- hoja_ruta_asignaciones: qué transportista lleva cada hoja de ruta
-- (no_hoja_ruta viene de cabHojaDeRutaReg.noHojaRuta en SQL Server).
-- ---------------------------------------------------------------------------
create table if not exists public.hoja_ruta_asignaciones (
  id uuid primary key default gen_random_uuid(),
  no_hoja_ruta text not null,
  transportista_user_id uuid not null references public.profiles (id),
  asignado_por uuid not null references public.profiles (id),
  fecha_asignacion timestamptz not null default now(),
  activo boolean not null default true
);

-- Solo una asignación activa por hoja de ruta a la vez.
create unique index if not exists hoja_ruta_asignaciones_activa_unica
  on public.hoja_ruta_asignaciones (no_hoja_ruta)
  where activo;

create index if not exists hoja_ruta_asignaciones_transportista_idx
  on public.hoja_ruta_asignaciones (transportista_user_id)
  where activo;

alter table public.hoja_ruta_asignaciones enable row level security;
grant select, insert, update, delete on public.hoja_ruta_asignaciones to authenticated;

create policy "asignaciones_select"
  on public.hoja_ruta_asignaciones for select
  to authenticated
  using (
    transportista_user_id = auth.uid()
    or public.current_user_role() in ('admin', 'jefe_bodega')
  );

create policy "asignaciones_manage_gestor"
  on public.hoja_ruta_asignaciones for all
  to authenticated
  using (public.current_user_role() in ('admin', 'jefe_bodega'))
  with check (public.current_user_role() in ('admin', 'jefe_bodega'));

-- ---------------------------------------------------------------------------
-- entregas_pedido: registro de entrega por pedido dentro de una hoja de ruta
-- (no_pedido viene de linHojaDeRutaReg.noPedido, agrupado por pedido).
-- ---------------------------------------------------------------------------
create table if not exists public.entregas_pedido (
  id uuid primary key default gen_random_uuid(),
  no_hoja_ruta text not null,
  no_pedido text not null,
  cod_cliente text,
  nombre_cliente text,
  incidencia_id uuid not null references public.incidencias_catalogo (id),
  comentario text,
  fecha_hora_entrega timestamptz not null default now(),
  registrado_por uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  corregido_por uuid references public.profiles (id),
  corregido_en timestamptz,
  unique (no_hoja_ruta, no_pedido)
);

create index if not exists entregas_pedido_hoja_ruta_idx
  on public.entregas_pedido (no_hoja_ruta);

alter table public.entregas_pedido enable row level security;
grant select, insert, update on public.entregas_pedido to authenticated;

create policy "entregas_select"
  on public.entregas_pedido for select
  to authenticated
  using (
    public.current_user_role() in ('admin', 'jefe_bodega')
    or exists (
      select 1 from public.hoja_ruta_asignaciones a
      where a.no_hoja_ruta = entregas_pedido.no_hoja_ruta
        and a.transportista_user_id = auth.uid()
        and a.activo
    )
  );

create policy "entregas_insert_transportista_asignado"
  on public.entregas_pedido for insert
  to authenticated
  with check (
    registrado_por = auth.uid()
    and exists (
      select 1 from public.hoja_ruta_asignaciones a
      where a.no_hoja_ruta = entregas_pedido.no_hoja_ruta
        and a.transportista_user_id = auth.uid()
        and a.activo
    )
  );

create policy "entregas_update_transportista_asignado_o_gestor"
  on public.entregas_pedido for update
  to authenticated
  using (
    public.current_user_role() in ('admin', 'jefe_bodega')
    or exists (
      select 1 from public.hoja_ruta_asignaciones a
      where a.no_hoja_ruta = entregas_pedido.no_hoja_ruta
        and a.transportista_user_id = auth.uid()
        and a.activo
    )
  )
  with check (
    public.current_user_role() in ('admin', 'jefe_bodega')
    or exists (
      select 1 from public.hoja_ruta_asignaciones a
      where a.no_hoja_ruta = entregas_pedido.no_hoja_ruta
        and a.transportista_user_id = auth.uid()
        and a.activo
    )
  );
