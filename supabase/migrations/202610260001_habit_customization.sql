-- Habit icon, color, kind, reminder, goal and streak settings.
-- Replaces mejordia_sync with the extended habit field set. Safe to rerun.
begin;

alter table public.habitos add column if not exists simbolo_tipo text not null default 'icon';
alter table public.habitos add column if not exists simbolo_valor text not null default 'favorite';
alter table public.habitos add column if not exists color text not null default '#E57373';
alter table public.habitos add column if not exists tipo text not null default 'build';
alter table public.habitos add column if not exists recordatorio_hora time without time zone;
alter table public.habitos add column if not exists meta_cantidad integer;
alter table public.habitos add column if not exists meta_periodo text;
alter table public.habitos add column if not exists racha boolean not null default true;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'habitos_simbolo_tipo_check') then
    alter table public.habitos add constraint habitos_simbolo_tipo_check check (simbolo_tipo in ('icon', 'emoji'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'habitos_tipo_check') then
    alter table public.habitos add constraint habitos_tipo_check check (tipo in ('build', 'quit'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'habitos_meta_periodo_check') then
    alter table public.habitos add constraint habitos_meta_periodo_check
      check (meta_periodo is null or meta_periodo in ('day', 'week', 'month'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'habitos_meta_pair_check') then
    alter table public.habitos add constraint habitos_meta_pair_check
      check ((meta_cantidad is null and meta_periodo is null)
        or (meta_cantidad is not null and meta_cantidad between 1 and 999 and meta_periodo is not null));
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
  weekdays integer[];
  done_days date[];
  skip_days date[];
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
      select coalesce(array_agg(value::integer), '{}'::integer[]) into weekdays
        from jsonb_array_elements_text(coalesce(campos->'repetir_dias', '[]'::jsonb)) as value;
      select coalesce(array_agg(value::date), '{}'::date[]) into done_days
        from jsonb_array_elements_text(coalesce(campos->'ocurrencias_completadas', '[]'::jsonb)) as value;
      select coalesce(array_agg(value::date), '{}'::date[]) into skip_days
        from jsonb_array_elements_text(coalesce(campos->'ocurrencias_excluidas', '[]'::jsonb)) as value;
      if accion in ('crear', 'importar') then
        insert into public.tareas(
          usuario_id, id, nombre, descripcion, fecha, hora, favorita, realizada, creada_en, lista_id,
          repetir_cada, repetir_unidad, recurrencia_id, recordatorio_minutos,
          repetir_dias, repetir_hasta, ocurrencias_completadas, ocurrencias_excluidas
        )
        values (
          propietario, registro, btrim(campos->>'nombre'), coalesce(campos->>'descripcion', ''),
          (campos->>'fecha')::date, (campos->>'hora')::time,
          coalesce((campos->>'favorita')::boolean, false), coalesce((campos->>'realizada')::boolean, false),
          coalesce((campos->>'creada_en')::timestamptz, now()), nullif(campos->>'lista_id', 'mis-tareas'),
          nullif(campos->>'repetir_cada', '')::integer, nullif(campos->>'repetir_unidad', ''), nullif(campos->>'recurrencia_id', ''),
          coalesce(nullif(campos->>'recordatorio_minutos', '')::integer, 30),
          weekdays, nullif(campos->>'repetir_hasta', '')::date, done_days, skip_days
        )
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
          recordatorio_minutos = case when campos ? 'recordatorio_minutos' then nullif(campos->>'recordatorio_minutos', '')::integer else recordatorio_minutos end,
          repetir_dias = case when campos ? 'repetir_dias' then weekdays else repetir_dias end,
          repetir_hasta = case when campos ? 'repetir_hasta' then nullif(campos->>'repetir_hasta', '')::date else repetir_hasta end,
          ocurrencias_completadas = case when campos ? 'ocurrencias_completadas' then done_days else ocurrencias_completadas end,
          ocurrencias_excluidas = case when campos ? 'ocurrencias_excluidas' then skip_days else ocurrencias_excluidas end,
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
        insert into public.habitos(
          usuario_id, id, nombre, descripcion, dias, dias_completados, creado_el,
          simbolo_tipo, simbolo_valor, color, tipo, recordatorio_hora, meta_cantidad, meta_periodo, racha
        )
        values (
          propietario, registro, btrim(campos->>'nombre'), coalesce(campos->>'descripcion', ''),
          coalesce((campos->>'dias')::bigint, 1), completados, coalesce((campos->>'creado_el')::date, current_date),
          coalesce(nullif(campos->>'simbolo_tipo', ''), 'icon'),
          coalesce(nullif(campos->>'simbolo_valor', ''), 'favorite'),
          coalesce(nullif(campos->>'color', ''), '#E57373'),
          coalesce(nullif(campos->>'tipo', ''), 'build'),
          nullif(campos->>'recordatorio_hora', '')::time,
          nullif(campos->>'meta_cantidad', '')::integer,
          nullif(campos->>'meta_periodo', ''),
          coalesce((campos->>'racha')::boolean, true)
        )
        on conflict (usuario_id, id) do nothing;
      elsif accion = 'editar' then
        update public.habitos set
          nombre = case when campos ? 'nombre' then btrim(campos->>'nombre') else nombre end,
          descripcion = case when campos ? 'descripcion' then campos->>'descripcion' else descripcion end,
          dias = case when campos ? 'dias' then (campos->>'dias')::bigint else dias end,
          simbolo_tipo = case when campos ? 'simbolo_tipo' then coalesce(nullif(campos->>'simbolo_tipo', ''), simbolo_tipo) else simbolo_tipo end,
          simbolo_valor = case when campos ? 'simbolo_valor' then coalesce(nullif(campos->>'simbolo_valor', ''), simbolo_valor) else simbolo_valor end,
          color = case when campos ? 'color' then coalesce(nullif(campos->>'color', ''), color) else color end,
          tipo = case when campos ? 'tipo' then coalesce(nullif(campos->>'tipo', ''), tipo) else tipo end,
          recordatorio_hora = case when campos ? 'recordatorio_hora' then nullif(campos->>'recordatorio_hora', '')::time else recordatorio_hora end,
          meta_cantidad = case when campos ? 'meta_cantidad' then nullif(campos->>'meta_cantidad', '')::integer else meta_cantidad end,
          meta_periodo = case when campos ? 'meta_periodo' then nullif(campos->>'meta_periodo', '') else meta_periodo end,
          racha = case when campos ? 'racha' then coalesce((campos->>'racha')::boolean, racha) else racha end,
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
