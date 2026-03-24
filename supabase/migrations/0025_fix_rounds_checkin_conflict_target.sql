create or replace function public.rounds_upsert_checkin(
  _room_id uuid,
  _client_event_id uuid,
  _scanned_at_device timestamptz,
  _comment text default null,
  _photo_storage_path text default null,
  _photo_file_name text default null,
  _photo_mime_type text default null,
  _photo_size_bytes bigint default null,
  _source text default 'pwa'
)
returns table (
  id uuid,
  operational_date date,
  room_id uuid,
  object_id uuid,
  checked_in_by_user_id uuid,
  checked_in_by_display_name text,
  scanned_at_device timestamptz,
  received_at_server timestamptz,
  comment text,
  photo_storage_path text,
  photo_file_name text,
  photo_mime_type text,
  photo_size_bytes bigint,
  client_event_id uuid,
  source text,
  created_at timestamptz,
  updated_at timestamptz,
  was_applied boolean,
  was_deduped boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_uid uuid;
  current_role_name text;
  current_display_name text;
  room_row record;
  op_date date;
  existing_row public.rounds_checkins%rowtype;
  applied_row public.rounds_checkins%rowtype;
begin
  current_uid := auth.uid();
  current_role_name := public.current_role();

  if current_uid is null or current_role_name is null then
    raise exception 'Unauthorized';
  end if;

  if _room_id is null or _scanned_at_device is null then
    raise exception 'room_id и scanned_at_device обязательны';
  end if;

  select profile_row.full_name
  into current_display_name
  from public.profiles profile_row
  where profile_row.id = current_uid;

  if current_display_name is null then
    raise exception 'Профиль пользователя не найден';
  end if;

  if _client_event_id is not null then
    select *
    into existing_row
    from public.rounds_checkins checkin_row
    where checkin_row.client_event_id = _client_event_id
    limit 1;

    if found then
      return query
      select
        existing_row.id,
        existing_row.operational_date,
        existing_row.room_id,
        existing_row.object_id,
        existing_row.checked_in_by_user_id,
        existing_row.checked_in_by_display_name,
        existing_row.scanned_at_device,
        existing_row.received_at_server,
        existing_row.comment,
        existing_row.photo_storage_path,
        existing_row.photo_file_name,
        existing_row.photo_mime_type,
        existing_row.photo_size_bytes,
        existing_row.client_event_id,
        existing_row.source,
        existing_row.created_at,
        existing_row.updated_at,
        false,
        true;
      return;
    end if;
  end if;

  select
    room.id,
    room.object_id,
    room.name,
    room.is_active,
    room.rounds_enabled
  into room_row
  from public.object_rooms room
  where room.id = _room_id;

  if not found then
    raise exception 'Помещение не найдено';
  end if;

  if room_row.is_active is not true then
    raise exception 'Помещение недоступно для обхода';
  end if;

  if room_row.rounds_enabled is not true then
    raise exception 'Помещение не включено в обходы';
  end if;

  if not public.rounds_can_scan_object(room_row.object_id) then
    raise exception 'Нет доступа к объекту';
  end if;

  op_date := public.rounds_operational_date(_scanned_at_device);

  insert into public.rounds_checkins (
    operational_date,
    room_id,
    object_id,
    checked_in_by_user_id,
    checked_in_by_display_name,
    scanned_at_device,
    received_at_server,
    comment,
    photo_storage_path,
    photo_file_name,
    photo_mime_type,
    photo_size_bytes,
    client_event_id,
    source
  )
  values (
    op_date,
    _room_id,
    room_row.object_id,
    current_uid,
    current_display_name,
    _scanned_at_device,
    now(),
    nullif(btrim(coalesce(_comment, '')), ''),
    _photo_storage_path,
    _photo_file_name,
    _photo_mime_type,
    _photo_size_bytes,
    _client_event_id,
    coalesce(nullif(btrim(coalesce(_source, '')), ''), 'pwa')
  )
  on conflict on constraint rounds_checkins_room_day_key do update
  set
    object_id = excluded.object_id,
    checked_in_by_user_id = excluded.checked_in_by_user_id,
    checked_in_by_display_name = excluded.checked_in_by_display_name,
    scanned_at_device = excluded.scanned_at_device,
    received_at_server = now(),
    comment = excluded.comment,
    photo_storage_path = excluded.photo_storage_path,
    photo_file_name = excluded.photo_file_name,
    photo_mime_type = excluded.photo_mime_type,
    photo_size_bytes = excluded.photo_size_bytes,
    client_event_id = excluded.client_event_id,
    source = excluded.source
  where excluded.scanned_at_device >= public.rounds_checkins.scanned_at_device
  returning *
  into applied_row;

  if found then
    return query
    select
      applied_row.id,
      applied_row.operational_date,
      applied_row.room_id,
      applied_row.object_id,
      applied_row.checked_in_by_user_id,
      applied_row.checked_in_by_display_name,
      applied_row.scanned_at_device,
      applied_row.received_at_server,
      applied_row.comment,
      applied_row.photo_storage_path,
      applied_row.photo_file_name,
      applied_row.photo_mime_type,
      applied_row.photo_size_bytes,
      applied_row.client_event_id,
      applied_row.source,
      applied_row.created_at,
      applied_row.updated_at,
      true,
      false;
    return;
  end if;

  select *
  into existing_row
  from public.rounds_checkins checkin_row
  where checkin_row.room_id = _room_id
    and checkin_row.operational_date = op_date
  limit 1;

  return query
  select
    existing_row.id,
    existing_row.operational_date,
    existing_row.room_id,
    existing_row.object_id,
    existing_row.checked_in_by_user_id,
    existing_row.checked_in_by_display_name,
    existing_row.scanned_at_device,
    existing_row.received_at_server,
    existing_row.comment,
    existing_row.photo_storage_path,
    existing_row.photo_file_name,
    existing_row.photo_mime_type,
    existing_row.photo_size_bytes,
    existing_row.client_event_id,
    existing_row.source,
    existing_row.created_at,
    existing_row.updated_at,
    false,
    false;
end;
$$;

do $$
begin
  perform pg_notify('pgrst', 'reload schema');
  perform pg_notify('pgrst', 'reload config');
exception
  when others then
    null;
end;
$$;
