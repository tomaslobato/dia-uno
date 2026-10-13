-- Run against a development database after the migration. Everything rolls back.
begin;
insert into auth.users(id) values ('11111111-1111-4111-8111-111111111111'), ('22222222-2222-4222-8222-222222222222') on conflict do nothing;
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select public.mejordia_sync('[
 {"cambio_id":"test-t1","entidad":"tareas","accion":"crear","id":"test-task","campos":{"nombre":"Leer","descripcion":"Diez páginas","fecha":"2026-10-10","hora":"18:30","favorita":true,"realizada":false}},
 {"cambio_id":"test-h1","entidad":"habitos","accion":"crear","id":"test-habit","campos":{"nombre":"Caminar","descripcion":"En el parque","dias":3,"dias_completados":["2026-10-08"]}}
]');
select public.mejordia_sync('[{"cambio_id":"test-d1","entidad":"habitos","accion":"dia","id":"test-habit","dia":"2026-10-09","completado":true}]');
select public.mejordia_sync('[{"cambio_id":"test-d2","entidad":"habitos","accion":"dia","id":"test-habit","dia":"2026-10-10","completado":true}]');
select public.mejordia_sync('[{"cambio_id":"test-d3","entidad":"habitos","accion":"dia","id":"test-habit","dia":"2026-10-09","completado":false}]');
-- A retry after a later uncheck must NOT mark the day again.
select public.mejordia_sync('[{"cambio_id":"test-d1","entidad":"habitos","accion":"dia","id":"test-habit","dia":"2026-10-09","completado":true}]');
do $$ begin
  if not exists (select 1 from public.habitos where id = 'test-habit' and dias_completados = array['2026-10-08'::date, '2026-10-10'::date] and descripcion = 'En el parque') then raise exception 'Habit history or description lost'; end if;
  if not exists (select 1 from public.tareas where id = 'test-task' and favorita and not realizada and fecha = '2026-10-10' and hora = '18:30') then raise exception 'Task fields lost'; end if;
end $$;
select public.mejordia_sync('[{"cambio_id":"test-edit","entidad":"tareas","accion":"editar","id":"test-task","campos":{"realizada":true}}]');
select public.mejordia_sync('[{"cambio_id":"test-import","entidad":"tareas","accion":"importar","id":"test-task","campos":{"nombre":"Old name","realizada":false}}]');
do $$ begin
  if not exists(select 1 from public.tareas where id='test-task' and nombre='Leer' and realizada and favorita) then raise exception 'Import overwrote existing task'; end if;
end $$;
-- Same task id is safe for another account, and snapshots cannot leak.
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
do $$ begin
  if exists (select 1 from public.tareas) or exists (select 1 from public.habitos) or exists(select 1 from public.cambios_aplicados) then raise exception 'RLS leaked another user'; end if;
  begin
    insert into public.tareas(usuario_id,id,nombre) values('11111111-1111-4111-8111-111111111111','malicious','No');
    raise exception 'RLS allowed insert for another user';
  exception when insufficient_privilege then null; end;
  update public.tareas set nombre='No' where usuario_id='11111111-1111-4111-8111-111111111111';
  if found then raise exception 'RLS allowed editing another user'; end if;
end $$;
select public.mejordia_sync('[{"cambio_id":"test-t1","entidad":"tareas","accion":"crear","id":"test-task","campos":{"nombre":"Other account"}}]');
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select public.mejordia_sync('[{"cambio_id":"test-delete","entidad":"tareas","accion":"eliminar","id":"test-task"}]');
select public.mejordia_sync('[{"cambio_id":"test-old-edit","entidad":"tareas","accion":"editar","id":"test-task","campos":{"nombre":"Resurrect"}}]');
do $$ begin
  if public.mejordia_sync()->'tareas' <> '[]'::jsonb then raise exception 'Deleted task resurrected'; end if;
  begin
    perform public.mejordia_sync('[{"cambio_id":"test-valid","entidad":"tareas","accion":"crear","id":"test-atomic","campos":{"nombre":"Atomic"}},{"cambio_id":"test-invalid","entidad":"habitos","accion":"crear","id":"test-invalid","campos":{"nombre":"Invalid","dias":0}}]');
    raise exception 'Invalid interval accepted';
  exception when check_violation then null; end;
  if exists(select 1 from public.tareas where id='test-atomic') or exists(select 1 from public.cambios_aplicados where id='test-valid') then raise exception 'Batch was not atomic'; end if;
end $$;
reset role;
set local role anon;
do $$ begin
  begin perform public.mejordia_sync(); raise exception 'Anonymous RPC access allowed'; exception when insufficient_privilege then null; end;
  begin perform * from public.tareas; raise exception 'Anonymous data access allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
