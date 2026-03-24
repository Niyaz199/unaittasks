create table if not exists public.object_room_qr_codes (
  id uuid primary key default gen_random_uuid(),
  object_id uuid not null references public.objects (id) on delete cascade,
  room_id uuid not null references public.object_rooms (id) on delete cascade,
  qr_token text not null,
  is_active boolean not null default true,
  generated_at timestamptz not null default now(),
  constraint object_room_qr_codes_qr_token_key unique (qr_token)
);

create index if not exists idx_object_room_qr_codes_object_id
  on public.object_room_qr_codes (object_id);

create unique index if not exists object_room_qr_codes_active_room_uidx
  on public.object_room_qr_codes (room_id)
  where is_active = true;

create or replace function public.object_room_generate_qr_token()
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
      from public.object_room_qr_codes q
      where q.qr_token = candidate
    );
  end loop;

  return candidate;
end;
$$;

create or replace function public.object_room_create_qr_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.object_room_qr_codes (
    object_id,
    room_id,
    qr_token,
    is_active
  )
  values (
    new.object_id,
    new.id,
    public.object_room_generate_qr_token(),
    true
  );

  return new;
end;
$$;

create or replace function public.object_room_sync_qr_object_refs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.object_id = old.object_id then
    return new;
  end if;

  update public.object_room_qr_codes
  set object_id = new.object_id
  where room_id = new.id;

  return new;
end;
$$;

create or replace function public.object_room_resolve_qr_token(_token text)
returns table (
  id uuid,
  object_id uuid,
  room_id uuid,
  qr_token text,
  is_active boolean,
  generated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select q.id, q.object_id, q.room_id, q.qr_token, q.is_active, q.generated_at
  from public.object_room_qr_codes q
  where auth.uid() is not null
    and q.qr_token = btrim(coalesce(_token, ''))
    and q.is_active = true
    and public.can_read_object_room(q.object_id)
  limit 1
$$;

create or replace function public.object_room_regenerate_qr(_room_id uuid)
returns table (
  id uuid,
  object_id uuid,
  room_id uuid,
  qr_token text,
  is_active boolean,
  generated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  room_row public.object_rooms%rowtype;
begin
  select *
  into room_row
  from public.object_rooms room
  where room.id = _room_id;

  if not found then
    raise exception 'Помещение не найдено';
  end if;

  if not public.can_manage_object_room(room_row.object_id) then
    raise exception 'Нет доступа к регенерации QR помещения';
  end if;

  update public.object_room_qr_codes qr
  set is_active = false
  where qr.room_id = room_row.id
    and qr.is_active = true;

  return query
  insert into public.object_room_qr_codes (
    object_id,
    room_id,
    qr_token,
    is_active
  )
  values (
    room_row.object_id,
    room_row.id,
    public.object_room_generate_qr_token(),
    true
  )
  returning
    object_room_qr_codes.id,
    object_room_qr_codes.object_id,
    object_room_qr_codes.room_id,
    object_room_qr_codes.qr_token,
    object_room_qr_codes.is_active,
    object_room_qr_codes.generated_at;
end;
$$;

drop trigger if exists trg_object_room_create_qr_code on public.object_rooms;
create trigger trg_object_room_create_qr_code
after insert on public.object_rooms
for each row
execute function public.object_room_create_qr_code();

drop trigger if exists trg_object_room_sync_qr_object_refs on public.object_rooms;
create trigger trg_object_room_sync_qr_object_refs
after update of object_id on public.object_rooms
for each row
execute function public.object_room_sync_qr_object_refs();

alter table public.object_room_qr_codes enable row level security;

drop policy if exists "object_room_qr_codes_select_by_access" on public.object_room_qr_codes;
drop policy if exists "object_room_qr_codes_manage_by_scope" on public.object_room_qr_codes;

create policy "object_room_qr_codes_select_by_access"
  on public.object_room_qr_codes for select
  using (public.can_read_object_room(object_id));

create policy "object_room_qr_codes_manage_by_scope"
  on public.object_room_qr_codes for all
  using (public.can_manage_object_room(object_id))
  with check (public.can_manage_object_room(object_id));

insert into public.object_room_qr_codes (object_id, room_id, qr_token, is_active, generated_at)
select
  room.object_id,
  room.id,
  room.rounds_qr_token,
  true,
  coalesce(room.rounds_qr_generated_at, room.created_at, now())
from public.object_rooms room
where room.rounds_qr_token is not null
  and not exists (
    select 1
    from public.object_room_qr_codes q
    where q.room_id = room.id
      and q.is_active = true
  )
on conflict (qr_token) do nothing;

insert into public.object_room_qr_codes (object_id, room_id, qr_token, is_active)
select
  room.object_id,
  room.id,
  public.object_room_generate_qr_token(),
  true
from public.object_rooms room
where not exists (
  select 1
  from public.object_room_qr_codes q
  where q.room_id = room.id
    and q.is_active = true
);

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
    q.qr_token
  from public.object_rooms room
  join public.objects object_ref on object_ref.id = room.object_id
  left join public.floors floor_ref on floor_ref.id = room.floor_id
  join public.object_room_qr_codes q on q.room_id = room.id and q.is_active = true
  where auth.uid() is not null
    and room.is_active = true
    and room.rounds_enabled = true
    and q.qr_token = btrim(coalesce(_token, ''))
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
    q.qr_token
  from public.object_rooms room
  join public.objects object_ref on object_ref.id = room.object_id
  left join public.floors floor_ref on floor_ref.id = room.floor_id
  join public.object_room_qr_codes q on q.room_id = room.id and q.is_active = true
  where auth.uid() is not null
    and room.is_active = true
    and room.rounds_enabled = true
    and public.rounds_can_scan_object(room.object_id)
  order by object_ref.name, floor_name, room.name
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
