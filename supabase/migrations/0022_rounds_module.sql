alter table public.object_rooms
  add column if not exists rounds_enabled boolean not null default false;

alter table public.object_rooms
  add column if not exists rounds_qr_token text;

alter table public.object_rooms
  add column if not exists rounds_qr_generated_at timestamptz;

create index if not exists idx_object_rooms_rounds_enabled
  on public.object_rooms (object_id, rounds_enabled)
  where rounds_enabled;

create unique index if not exists idx_object_rooms_rounds_qr_token_unique
  on public.object_rooms (rounds_qr_token)
  where rounds_qr_token is not null;

create table if not exists public.rounds_checkins (
  id uuid primary key default gen_random_uuid(),
  operational_date date not null,
  room_id uuid not null references public.object_rooms (id) on delete cascade,
  object_id uuid not null references public.objects (id) on delete cascade,
  checked_in_by_user_id uuid not null references public.profiles (id) on delete restrict,
  checked_in_by_display_name text not null,
  scanned_at_device timestamptz not null,
  received_at_server timestamptz not null default now(),
  comment text,
  photo_storage_path text,
  photo_file_name text,
  photo_mime_type text,
  photo_size_bytes bigint,
  client_event_id uuid unique,
  source text not null default 'pwa',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rounds_checkins_room_day_key unique (room_id, operational_date)
);

create index if not exists idx_rounds_checkins_object_date
  on public.rounds_checkins (object_id, operational_date desc);

create index if not exists idx_rounds_checkins_user_date
  on public.rounds_checkins (checked_in_by_user_id, operational_date desc);

create index if not exists idx_rounds_checkins_scanned_at
  on public.rounds_checkins (scanned_at_device desc);

drop trigger if exists trg_rounds_checkins_set_updated_at on public.rounds_checkins;
create trigger trg_rounds_checkins_set_updated_at
before update on public.rounds_checkins
for each row
execute function public.set_updated_at();

create or replace function public.rounds_project_timezone()
returns text
language sql
stable
as $$
  select coalesce(nullif(current_setting('TIMEZONE', true), ''), 'UTC')
$$;

create or replace function public.rounds_operational_date(_scanned_at timestamptz)
returns date
language sql
stable
as $$
  select ((_scanned_at at time zone public.rounds_project_timezone())::date)
$$;

create or replace function public.rounds_generate_qr_token()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate text;
begin
  loop
    candidate := gen_random_uuid()::text;
    exit when not exists (
      select 1
      from public.object_rooms r
      where r.rounds_qr_token = candidate
    );
  end loop;

  return candidate;
end;
$$;

create or replace function public.rounds_can_read_object(_object_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  role_name text;
  uid uuid;
begin
  uid := auth.uid();
  role_name := public.current_role();

  if uid is null or role_name is null then
    return false;
  end if;

  if role_name in ('admin', 'chief') then
    return true;
  end if;

  if role_name not in ('lead', 'engineer', 'object_engineer') then
    return false;
  end if;

  return public.has_object_access(_object_id, uid);
end;
$$;

create or replace function public.rounds_can_manage_object(_object_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  role_name text;
  uid uuid;
begin
  uid := auth.uid();
  role_name := public.current_role();

  if uid is null or role_name is null then
    return false;
  end if;

  if role_name in ('admin', 'chief') then
    return true;
  end if;

  if role_name not in ('lead', 'engineer', 'object_engineer') then
    return false;
  end if;

  return public.has_object_access(_object_id, uid);
end;
$$;

create or replace function public.rounds_can_scan_object(_object_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  role_name text;
  uid uuid;
begin
  uid := auth.uid();
  role_name := public.current_role();

  if uid is null or role_name is null then
    return false;
  end if;

  if role_name in ('admin', 'chief') then
    return true;
  end if;

  if role_name not in ('lead', 'engineer', 'object_engineer', 'tech') then
    return false;
  end if;

  return public.has_object_access(_object_id, uid);
end;
$$;

create or replace function public.rounds_resolve_room_qr_token(_token text)
returns table (
  room_id uuid,
  object_id uuid,
  object_name text,
  room_name text,
  floor_name text,
  qr_token text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    room.id,
    room.object_id,
    object_ref.name,
    room.name,
    coalesce(floor_ref.name, room.floor, '—') as floor_name,
    room.rounds_qr_token
  from public.object_rooms room
  join public.objects object_ref on object_ref.id = room.object_id
  left join public.floors floor_ref on floor_ref.id = room.floor_id
  where auth.uid() is not null
    and room.is_active = true
    and room.rounds_enabled = true
    and room.rounds_qr_token = btrim(coalesce(_token, ''))
    and public.rounds_can_scan_object(room.object_id)
  limit 1
$$;

create or replace function public.rounds_list_scanner_config()
returns table (
  room_id uuid,
  object_id uuid,
  object_name text,
  room_name text,
  floor_name text,
  qr_token text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    room.id,
    room.object_id,
    object_ref.name,
    room.name,
    coalesce(floor_ref.name, room.floor, '—') as floor_name,
    room.rounds_qr_token
  from public.object_rooms room
  join public.objects object_ref on object_ref.id = room.object_id
  left join public.floors floor_ref on floor_ref.id = room.floor_id
  where auth.uid() is not null
    and room.is_active = true
    and room.rounds_enabled = true
    and room.rounds_qr_token is not null
    and public.rounds_can_scan_object(room.object_id)
  order by object_ref.name, floor_name, room.name
$$;

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
    from public.rounds_checkins
    where client_event_id = _client_event_id
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

alter table public.rounds_checkins enable row level security;

drop policy if exists "rounds_checkins_select" on public.rounds_checkins;
drop policy if exists "rounds_checkins_insert" on public.rounds_checkins;
drop policy if exists "rounds_checkins_update" on public.rounds_checkins;

create policy "rounds_checkins_select"
  on public.rounds_checkins for select
  using (
    checked_in_by_user_id = auth.uid()
    or public.rounds_can_read_object(object_id)
  );

create policy "rounds_checkins_insert"
  on public.rounds_checkins for insert
  with check (
    checked_in_by_user_id = auth.uid()
    and public.rounds_can_scan_object(object_id)
  );

create policy "rounds_checkins_update"
  on public.rounds_checkins for update
  using (
    checked_in_by_user_id = auth.uid()
    or public.rounds_can_scan_object(object_id)
  )
  with check (
    checked_in_by_user_id = auth.uid()
    and public.rounds_can_scan_object(object_id)
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'rounds-files',
  'rounds-files',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "rounds_files_select" on storage.objects;
drop policy if exists "rounds_files_insert" on storage.objects;
drop policy if exists "rounds_files_delete" on storage.objects;

create policy "rounds_files_select" on storage.objects
  for select using (
    bucket_id = 'rounds-files'
    and auth.role() = 'authenticated'
    and exists (
      select 1
      from public.rounds_checkins checkin_row
      where checkin_row.photo_storage_path = name
        and (
          checkin_row.checked_in_by_user_id = auth.uid()
          or public.rounds_can_read_object(checkin_row.object_id)
        )
    )
  );

create policy "rounds_files_insert" on storage.objects
  for insert with check (
    bucket_id = 'rounds-files'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = 'checkins'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy "rounds_files_delete" on storage.objects
  for delete using (
    bucket_id = 'rounds-files'
    and auth.role() = 'authenticated'
    and exists (
      select 1
      from public.rounds_checkins checkin_row
      where checkin_row.photo_storage_path = name
        and (
          checkin_row.checked_in_by_user_id = auth.uid()
          or public.rounds_can_manage_object(checkin_row.object_id)
        )
    )
  );

do $$
begin
  perform pg_notify('pgrst', 'reload schema');
  perform pg_notify('pgrst', 'reload config');
exception
  when others then
    null;
end;
$$;
