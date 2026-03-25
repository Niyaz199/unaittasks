create or replace function public.rounds_save_room_selection(
  _object_id uuid,
  _enabled_room_ids uuid[] default '{}'
)
returns table (
  object_id uuid,
  enabled_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_room_ids uuid[] := coalesce(_enabled_room_ids, '{}'::uuid[]);
  invalid_room_count integer;
begin
  if auth.uid() is null or not public.rounds_can_manage_object(_object_id) then
    raise exception 'Недостаточно прав для настройки обходов';
  end if;

  select count(*)
  into invalid_room_count
  from unnest(normalized_room_ids) as input_room_id
  left join public.object_rooms room
    on room.id = input_room_id
   and room.object_id = _object_id
  where room.id is null;

  if invalid_room_count > 0 then
    raise exception 'В payload сохранения попали помещения, которые не принадлежат выбранному объекту.';
  end if;

  update public.object_rooms
  set rounds_enabled = false
  where object_id = _object_id;

  if cardinality(normalized_room_ids) > 0 then
    update public.object_rooms
    set rounds_enabled = true
    where object_id = _object_id
      and id = any(normalized_room_ids);
  end if;

  return query
  select _object_id, cardinality(normalized_room_ids);
end;
$$;
