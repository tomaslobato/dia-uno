begin;
insert into auth.users(id) values ('11111111-1111-4111-8111-111111111111') on conflict do nothing;
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select public.mejordia_sync('[{"cambio_id":"unassigned","entidad":"tareas","accion":"crear","id":"loose","campos":{"nombre":"Sin lista"}}]');
do $$ begin
  if exists (select 1 from public.listas) then raise exception 'Created an automatic list'; end if;
  if not exists (select 1 from public.tareas where id='loose' and lista_id is null) then raise exception 'Unassigned task missing'; end if;
end $$;
select public.mejordia_sync('[{"cambio_id":"work-create","entidad":"listas","accion":"crear","id":"work","campos":{"nombre":"Trabajo"}},{"cambio_id":"assign","entidad":"tareas","accion":"editar","id":"loose","campos":{"lista_id":"work"}}]');
select public.mejordia_sync('[{"cambio_id":"unassign","entidad":"tareas","accion":"editar","id":"loose","campos":{"lista_id":null}}]');
do $$ begin
  if not exists(select 1 from public.tareas where id='loose' and lista_id is null) then raise exception 'Removing list failed'; end if;
  if not exists(select 1 from public.listas where id='work') then raise exception 'Custom list lost'; end if;
end $$;
rollback;
