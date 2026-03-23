create or replace function public.directory_floor_default_sort_order(_name text)
returns integer
language plpgsql
immutable
as $$
declare
  normalized text;
begin
  normalized := lower(btrim(coalesce(_name, '')));

  if normalized = '' then
    return 0;
  end if;

  if normalized ~ '^-?\d+$' then
    return normalized::integer * 100;
  end if;

  if normalized in ('подвал', 'цоколь') then
    return -1000;
  end if;

  if normalized in ('антресоль', 'мезонин') then
    return 50000;
  end if;

  if normalized in ('техэтаж', 'технический этаж') then
    return 900000;
  end if;

  if normalized in ('кровля', 'крыша') then
    return 1000000;
  end if;

  return 2000000;
end;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table if not exists public.object_rooms (
  id uuid primary key default gen_random_uuid(),
  object_id uuid not null references public.objects (id) on delete cascade,
  name text not null,
  floor text,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint object_rooms_object_id_name_key unique (object_id, name)
);

create index if not exists idx_object_rooms_object_id on public.object_rooms (object_id);

create table if not exists public.room_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  sort_order integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint room_types_name_not_blank check (btrim(name) <> '')
);

create unique index if not exists idx_room_types_name_active_unique
  on public.room_types (lower(btrim(name)))
  where is_active;

create index if not exists idx_room_types_sort
  on public.room_types (coalesce(sort_order, 2147483647), lower(btrim(name)));

drop trigger if exists trg_room_types_set_updated_at on public.room_types;
create trigger trg_room_types_set_updated_at
before update on public.room_types
for each row
execute function public.set_updated_at();

create table if not exists public.floors (
  id uuid primary key default gen_random_uuid(),
  object_id uuid not null references public.objects (id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint floors_name_not_blank check (btrim(name) <> '')
);

create unique index if not exists idx_floors_object_name_unique
  on public.floors (object_id, lower(btrim(name)));

create index if not exists idx_floors_object_sort
  on public.floors (object_id, sort_order, lower(btrim(name)));

drop trigger if exists trg_floors_set_updated_at on public.floors;
create trigger trg_floors_set_updated_at
before update on public.floors
for each row
execute function public.set_updated_at();

alter table public.object_rooms
  add column if not exists floor_id uuid references public.floors (id) on delete restrict;

alter table public.object_rooms
  add column if not exists room_type_id uuid references public.room_types (id) on delete restrict;

create index if not exists idx_object_rooms_floor_id on public.object_rooms (floor_id);
create index if not exists idx_object_rooms_room_type_id on public.object_rooms (room_type_id);

insert into public.floors (object_id, name, sort_order, is_active)
select
  room.object_id,
  btrim(room.floor) as name,
  public.directory_floor_default_sort_order(btrim(room.floor)) as sort_order,
  true
from public.object_rooms room
where coalesce(btrim(room.floor), '') <> ''
  and not exists (
    select 1
    from public.floors floor_ref
    where floor_ref.object_id = room.object_id
      and lower(btrim(floor_ref.name)) = lower(btrim(room.floor))
  )
group by room.object_id, btrim(room.floor);

update public.floors floor_ref
set sort_order = public.directory_floor_default_sort_order(floor_ref.name)
where exists (
  select 1
  from public.object_rooms room
  where room.object_id = floor_ref.object_id
    and lower(btrim(room.floor)) = lower(btrim(floor_ref.name))
);

update public.object_rooms room
set floor_id = floor_ref.id
from public.floors floor_ref
where room.floor_id is null
  and floor_ref.object_id = room.object_id
  and lower(btrim(floor_ref.name)) = lower(btrim(room.floor));

create or replace function public.can_read_floor(_object_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and (
      public.current_role() in ('admin', 'chief')
      or (
        public.current_role() in ('lead', 'engineer', 'object_engineer')
        and public.has_object_access(_object_id, auth.uid())
      )
    )
$$;

create or replace function public.can_manage_floor(_object_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and (
      public.current_role() in ('admin', 'chief')
      or (
        public.current_role() in ('lead', 'object_engineer')
        and public.has_object_access(_object_id, auth.uid())
      )
    )
$$;

create or replace function public.can_read_room_type()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and public.current_role() in ('admin', 'chief', 'lead', 'engineer', 'object_engineer')
$$;

create or replace function public.can_manage_room_type()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and public.current_role() in ('admin', 'chief')
$$;

alter table public.floors enable row level security;
alter table public.room_types enable row level security;

drop policy if exists "floors_select_by_scope" on public.floors;
drop policy if exists "floors_manage_by_scope" on public.floors;
drop policy if exists "room_types_select_by_role" on public.room_types;
drop policy if exists "room_types_manage_by_role" on public.room_types;

create policy "floors_select_by_scope"
  on public.floors for select
  using (public.can_read_floor(object_id));

create policy "floors_manage_by_scope"
  on public.floors for all
  using (public.can_manage_floor(object_id))
  with check (public.can_manage_floor(object_id));

create policy "room_types_select_by_role"
  on public.room_types for select
  using (public.can_read_room_type());

create policy "room_types_manage_by_role"
  on public.room_types for all
  using (public.can_manage_room_type())
  with check (public.can_manage_room_type());

do $$
begin
  perform pg_notify('pgrst', 'reload schema');
  perform pg_notify('pgrst', 'reload config');
exception
  when others then
    null;
end;
$$;
