begin;
insert into auth.users(id) values ('11111111-1111-4111-8111-111111111111'), ('22222222-2222-4222-8222-222222222222') on conflict do nothing;
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select public.mejordia_sync('[
 {"cambio_id":"list-create","entidad":"listas","accion":"crear","id":"work","campos":{"nombre":"Trabajo"}},
 {"cambio_id":"list-task","entidad":"tareas","accion":"crear","id":"report","campos":{"nombre":"Informe","lista_id":"work","favorita":true}},
 {"cambio_id":"default-task","entidad":"tareas","accion":"crear","id":"old","campos":{"nombre":"Anterior"}}
]');
do $$ begin
  if not exists (select 1 from public.tareas where id='report' and lista_id='work' and favorita) then raise exception 'List assignment lost'; end if;
  if not exists (select 1 from public.tareas where id='old' and lista_id='mis-tareas') then raise exception 'Legacy default assignment failed'; end if;
  if jsonb_array_length(public.mejordia_sync()->'listas') <> 2 then raise exception 'List snapshot incomplete'; end if;
end $$;
select public.mejordia_sync('[{"cambio_id":"task-move","entidad":"tareas","accion":"editar","id":"report","campos":{"lista_id":"mis-tareas"}}]');
select public.mejordia_sync('[{"cambio_id":"list-create","entidad":"listas","accion":"crear","id":"work","campos":{"nombre":"Trabajo"}}]');
do $$ begin
  if not exists (select 1 from public.tareas where id='report' and lista_id='mis-tareas' and favorita) then raise exception 'Move changed unrelated fields'; end if;
  if (select count(*) from public.listas where id='work') <> 1 then raise exception 'Retry duplicated list'; end if;
end $$;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
do $$ begin
  if exists (select 1 from public.listas) then raise exception 'RLS leaked lists'; end if;
  begin
    perform public.mejordia_sync('[{"cambio_id":"foreign-list","entidad":"tareas","accion":"crear","id":"bad","campos":{"nombre":"No","lista_id":"work"}}]');
    raise exception 'Allowed another user list';
  exception when foreign_key_violation then null; end;
  begin
    insert into public.listas(usuario_id,id,nombre) values ('11111111-1111-4111-8111-111111111111','bad','No');
    raise exception 'Allowed another owner';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
