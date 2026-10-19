-- Adds optional local-notification lead time to task records. Safe to rerun.
begin;

alter table public.tareas add column if not exists recordatorio_minutos integer default 30;

do $$ begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.tareas'::regclass and conname = 'tareas_recordatorio_valido'
  ) then
    alter table public.tareas add constraint tareas_recordatorio_valido check (
      recordatorio_minutos is null or recordatorio_minutos between 1 and 10080
    );
  end if;
end $$;

-- Extend the existing sync RPC while retaining all of its current behavior.
do $$
declare
  definition text;
  old_insert text := 'repetir_cada, repetir_unidad, recurrencia_id)';
  new_insert text := 'repetir_cada, repetir_unidad, recurrencia_id, recordatorio_minutos)';
  old_values text := 'nullif(campos->>''repetir_cada'', '''')::integer, nullif(campos->>''repetir_unidad'', ''''), nullif(campos->>''recurrencia_id'', ''''))';
  new_values text := 'nullif(campos->>''repetir_cada'', '''')::integer, nullif(campos->>''repetir_unidad'', ''''), nullif(campos->>''recurrencia_id'', ''''), coalesce(nullif(campos->>''recordatorio_minutos'', '''')::integer, 30))';
  old_update text := 'recurrencia_id = case when campos ? ''recurrencia_id'' then nullif(campos->>''recurrencia_id'', '''') else recurrencia_id end,';
  new_update text := 'recurrencia_id = case when campos ? ''recurrencia_id'' then nullif(campos->>''recurrencia_id'', '''') else recurrencia_id end,
          recordatorio_minutos = case when campos ? ''recordatorio_minutos'' then nullif(campos->>''recordatorio_minutos'', '''')::integer else recordatorio_minutos end,';
begin
  select pg_catalog.pg_get_functiondef('public.mejordia_sync(jsonb)'::regprocedure) into definition;
  if position(new_insert in definition) = 0 then
    if position(old_insert in definition) = 0 then raise exception 'No se encontró la inserción de tareas para migrar'; end if;
    definition := replace(definition, old_insert, new_insert);
  end if;
  if position(new_values in definition) = 0 then
    if position(old_values in definition) = 0 then raise exception 'No se encontraron los valores de tareas para migrar'; end if;
    definition := replace(definition, old_values, new_values);
  end if;
  if position('recordatorio_minutos = case' in definition) = 0 then
    if position(old_update in definition) = 0 then raise exception 'No se encontró la edición de tareas para migrar'; end if;
    definition := replace(definition, old_update, new_update);
  end if;
  execute definition;
end $$;

notify pgrst, 'reload schema';
commit;
