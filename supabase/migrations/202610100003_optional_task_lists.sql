-- Supports tasks without a list; retains all custom lists and tasks.
begin;
create table if not exists public.listas (
  usuario_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  nombre text not null check (length(btrim(nombre)) between 1 and 120),
  creada_en timestamptz not null default now(),
  primary key (usuario_id, id)
);
alter table public.listas enable row level security;
revoke all on public.listas from anon, authenticated;
grant select, insert on public.listas to authenticated;
drop policy if exists listas_propias on public.listas;
create policy listas_propias on public.listas to authenticated
  using ((select auth.uid()) = usuario_id) with check ((select auth.uid()) = usuario_id);
alter table public.tareas add column if not exists lista_id text;
alter table public.tareas alter column lista_id drop not null;
alter table public.tareas alter column lista_id drop default;
update public.tareas set lista_id = null where lista_id = 'mis-tareas';
delete from public.listas where id = 'mis-tareas';
do $$ begin
  if not exists (select 1 from pg_catalog.pg_constraint where conrelid = 'public.tareas'::regclass and conname = 'tareas_lista_propia') then
    alter table public.tareas add constraint tareas_lista_propia foreign key (usuario_id, lista_id) references public.listas(usuario_id, id);
  end if;
end $$;

create or replace function public.mejordia_sync(operaciones jsonb default '[]'::jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  propietario uuid := auth.uid();
  op jsonb;
  campos jsonb;
  registro text;
  accion text;
  entidad text;
  fecha_dia date;
  completados date[];
begin
  if propietario is null then raise exception 'Debes iniciar sesión' using errcode = '42501'; end if;
  if jsonb_typeof(operaciones) is distinct from 'array' or jsonb_array_length(operaciones) > 200 then
    raise exception 'Lote de cambios inválido';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(propietario::text, 0));
  for op in select value from jsonb_array_elements(operaciones) loop
    registro := op->>'id';
    accion := op->>'accion';
    entidad := op->>'entidad';
    campos := coalesce(op->'campos', '{}'::jsonb);
    if coalesce(op->>'cambio_id', '') = '' or coalesce(registro, '') = ''
      or entidad is null or entidad not in ('tareas', 'habitos', 'listas')
      or accion is null or accion not in ('crear', 'importar', 'editar', 'eliminar', 'dia')
      or jsonb_typeof(campos) <> 'object' then raise exception 'Cambio inválido'; end if;
    if exists (select 1 from public.cambios_aplicados where usuario_id = propietario and id = op->>'cambio_id') then continue; end if;
    if entidad = 'listas' then
      if accion not in ('crear', 'importar') then raise exception 'Acción inválida para listas'; end if;
      insert into public.listas(usuario_id, id, nombre, creada_en)
      values (propietario, registro, btrim(campos->>'nombre'), coalesce((campos->>'creada_en')::timestamptz, now()))
      on conflict (usuario_id, id) do nothing;
    elsif entidad = 'tareas' then
      if accion in ('crear', 'importar') then
        insert into public.tareas(usuario_id, id, nombre, descripcion, fecha, hora, favorita, realizada, creada_en, lista_id)
        values (propietario, registro, btrim(campos->>'nombre'), coalesce(campos->>'descripcion', ''),
          (campos->>'fecha')::date, (campos->>'hora')::time,
          coalesce((campos->>'favorita')::boolean, false), coalesce((campos->>'realizada')::boolean, false),
          coalesce((campos->>'creada_en')::timestamptz, now()), nullif(campos->>'lista_id', 'mis-tareas'))
        on conflict (usuario_id, id) do nothing;
      elsif accion = 'editar' then
        update public.tareas set
          lista_id = case when campos ? 'lista_id' then nullif(campos->>'lista_id', 'mis-tareas') else lista_id end,
          nombre = case when campos ? 'nombre' then btrim(campos->>'nombre') else nombre end,
          descripcion = case when campos ? 'descripcion' then campos->>'descripcion' else descripcion end,
          fecha = case when campos ? 'fecha' then (campos->>'fecha')::date else fecha end,
          hora = case when campos ? 'hora' then (campos->>'hora')::time else hora end,
          favorita = case when campos ? 'favorita' then (campos->>'favorita')::boolean else favorita end,
          realizada = case when campos ? 'realizada' then (campos->>'realizada')::boolean else realizada end,
          actualizada_en = now()
        where usuario_id = propietario and id = registro and borrada_en is null;
      elsif accion = 'eliminar' then
        update public.tareas set borrada_en = now(), actualizada_en = now()
        where usuario_id = propietario and id = registro and borrada_en is null;
      else raise exception 'Acción inválida para tareas'; end if;
    else
      if accion in ('crear', 'importar') then
        select coalesce(array_agg(distinct value::date order by value::date), '{}'::date[]) into completados
          from jsonb_array_elements_text(coalesce(campos->'dias_completados', '[]'::jsonb));
        insert into public.habitos(usuario_id, id, nombre, descripcion, dias, dias_completados, creado_el)
        values (propietario, registro, btrim(campos->>'nombre'), coalesce(campos->>'descripcion', ''),
          coalesce((campos->>'dias')::bigint, 1), completados, coalesce((campos->>'creado_el')::date, current_date))
        on conflict (usuario_id, id) do nothing;
      elsif accion = 'editar' then
        update public.habitos set
          nombre = case when campos ? 'nombre' then btrim(campos->>'nombre') else nombre end,
          descripcion = case when campos ? 'descripcion' then campos->>'descripcion' else descripcion end,
          dias = case when campos ? 'dias' then (campos->>'dias')::bigint else dias end,
          actualizada_en = now()
        where usuario_id = propietario and id = registro and borrado_en is null;
      elsif accion = 'dia' then
        fecha_dia := (op->>'dia')::date;
        if fecha_dia is null or jsonb_typeof(op->'completado') is distinct from 'boolean' then raise exception 'Día inválido'; end if;
        update public.habitos set dias_completados = case when (op->>'completado')::boolean then
          array(select distinct d from unnest(dias_completados || array[fecha_dia]) as d order by d)
          else array_remove(dias_completados, fecha_dia) end, actualizada_en = now()
        where usuario_id = propietario and id = registro and borrado_en is null;
      elsif accion = 'eliminar' then
        update public.habitos set borrado_en = now(), actualizada_en = now()
        where usuario_id = propietario and id = registro and borrado_en is null;
      end if;
    end if;
    insert into public.cambios_aplicados(usuario_id, id) values (propietario, op->>'cambio_id');
  end loop;
  return jsonb_build_object(
    'listas', coalesce((select jsonb_agg(l order by l.creada_en, l.id) from public.listas l where l.usuario_id = propietario), '[]'::jsonb),
    'tareas', coalesce((select jsonb_agg(t order by t.creada_en, t.id) from public.tareas t where t.usuario_id = propietario and t.borrada_en is null), '[]'::jsonb),
    'habitos', coalesce((select jsonb_agg(h order by h.creado_el, h.id) from public.habitos h where h.usuario_id = propietario and h.borrado_en is null), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.mejordia_sync(jsonb) from public, anon;
grant execute on function public.mejordia_sync(jsonb) to authenticated;
notify pgrst, 'reload schema';
commit;
