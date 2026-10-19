-- Adds repeat interval settings and series identity to task records. Safe to rerun.
begin;
alter table public.tareas add column if not exists repetir_cada integer;
alter table public.tareas add column if not exists repetir_unidad text;
alter table public.tareas add column if not exists recurrencia_id text;
-- Preserve schedules made with the initial fixed repeat options.
do $$ begin
  if exists (select 1 from pg_catalog.pg_attribute where attrelid = 'public.tareas'::regclass and attname = 'recurrencia' and not attisdropped) then
    execute $migration$
      update public.tareas set
        repetir_cada = case recurrencia when 'daily' then 1 when 'weekly' then 1 when 'monthly' then 1 when 'yearly' then 12 else repetir_cada end,
        repetir_unidad = case recurrencia when 'daily' then 'days' when 'weekly' then 'weeks' when 'monthly' then 'months' when 'yearly' then 'months' else repetir_unidad end,
        recurrencia_id = coalesce(recurrencia_id, id)
      where recurrencia <> 'none' and repetir_cada is null
    $migration$;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_catalog.pg_constraint where conrelid = 'public.tareas'::regclass and conname = 'tareas_repeticion_valida') then
    alter table public.tareas add constraint tareas_repeticion_valida check (
      (repetir_cada is null and repetir_unidad is null) or
      (repetir_cada between 1 and 10000 and repetir_unidad in ('days', 'weeks', 'months'))
    );
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
      if accion in ('crear', 'importar', 'editar') and length(btrim(campos->>'nombre')) > 16 then
        -- Keep legacy imports compatible; only new names are limited.
        if accion <> 'importar' then raise exception 'El nombre de la lista admite hasta 16 caracteres'; end if;
      end if;
      if accion in ('crear', 'importar') then
        insert into public.listas(usuario_id, id, nombre, creada_en)
        values (propietario, registro, btrim(campos->>'nombre'), coalesce((campos->>'creada_en')::timestamptz, now()))
        on conflict (usuario_id, id) do nothing;
      elsif accion = 'editar' then
        update public.listas set nombre = btrim(campos->>'nombre') where usuario_id = propietario and id = registro;
      elsif accion = 'eliminar' then
        update public.tareas set lista_id = null, actualizada_en = now() where usuario_id = propietario and lista_id = registro;
        delete from public.listas where usuario_id = propietario and id = registro;
      else raise exception 'Acción inválida para listas'; end if;
    elsif entidad = 'tareas' then
      if accion in ('crear', 'importar') then
        insert into public.tareas(usuario_id, id, nombre, descripcion, fecha, hora, favorita, realizada, creada_en, lista_id, repetir_cada, repetir_unidad, recurrencia_id)
        values (propietario, registro, btrim(campos->>'nombre'), coalesce(campos->>'descripcion', ''),
          (campos->>'fecha')::date, (campos->>'hora')::time,
          coalesce((campos->>'favorita')::boolean, false), coalesce((campos->>'realizada')::boolean, false),
          coalesce((campos->>'creada_en')::timestamptz, now()), nullif(campos->>'lista_id', 'mis-tareas'),
          nullif(campos->>'repetir_cada', '')::integer, nullif(campos->>'repetir_unidad', ''), nullif(campos->>'recurrencia_id', ''))
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
          repetir_cada = case when campos ? 'repetir_cada' then nullif(campos->>'repetir_cada', '')::integer else repetir_cada end,
          repetir_unidad = case when campos ? 'repetir_unidad' then nullif(campos->>'repetir_unidad', '') else repetir_unidad end,
          recurrencia_id = case when campos ? 'recurrencia_id' then nullif(campos->>'recurrencia_id', '') else recurrencia_id end,
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
