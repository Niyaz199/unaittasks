-- PPR structure and early RLS

-- 1) Tables
create table if not exists public.ppr_system_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint ppr_system_groups_name_key unique (name),
  constraint ppr_system_groups_code_key unique (code)
);

create table if not exists public.ppr_systems (
  id uuid primary key default gen_random_uuid(),
  object_id uuid not null references public.objects (id) on delete cascade,
  system_group_id uuid not null references public.ppr_system_groups (id),
  name text not null,
  description text,
  responsible_user_id uuid references public.profiles (id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint ppr_systems_object_id_name_key unique (object_id, name)
);

create table if not exists public.ppr_subsystems (
  id uuid primary key default gen_random_uuid(),
  object_id uuid not null references public.objects (id) on delete cascade,
  system_id uuid not null references public.ppr_systems (id) on delete cascade,
  parent_id uuid references public.ppr_subsystems (id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.ppr_rooms (
  id uuid primary key default gen_random_uuid(),
  object_id uuid not null references public.objects (id) on delete cascade,
  name text not null,
  floor text,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint ppr_rooms_object_id_name_key unique (object_id, name)
);

-- Subsystem uniqueness must work both for root and nested nodes.
create unique index if not exists ppr_subsystems_root_name_uidx
  on public.ppr_subsystems (system_id, name)
  where parent_id is null;

create unique index if not exists ppr_subsystems_parent_name_uidx
  on public.ppr_subsystems (system_id, parent_id, name)
  where parent_id is not null;

-- 2) Indexes
create index if not exists idx_ppr_systems_object_id on public.ppr_systems (object_id);
create index if not exists idx_ppr_systems_responsible_user_id on public.ppr_systems (responsible_user_id);
create index if not exists idx_ppr_systems_system_group_id on public.ppr_systems (system_group_id);

create index if not exists idx_ppr_subsystems_object_id on public.ppr_subsystems (object_id);
create index if not exists idx_ppr_subsystems_system_id on public.ppr_subsystems (system_id);
create index if not exists idx_ppr_subsystems_parent_id on public.ppr_subsystems (parent_id);

create index if not exists idx_ppr_rooms_object_id on public.ppr_rooms (object_id);

-- 3) Helper functions
create or replace function public.ppr_current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid()
$$;

create or replace function public.ppr_has_object_access(_object_id uuid)
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
  role_name := public.ppr_current_role();

  if uid is null or role_name is null then
    return false;
  end if;

  if role_name in ('admin', 'chief') then
    return true;
  end if;

  if role_name not in ('lead', 'engineer', 'object_engineer') then
    return false;
  end if;

  return exists (
    select 1
    from public.user_objects uo
    where uo.user_id = uid
      and uo.object_id = _object_id
  );
end;
$$;

create or replace function public.ppr_can_manage_object_scope(_object_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  role_name text;
begin
  role_name := public.ppr_current_role();

  if role_name is null then
    return false;
  end if;

  if role_name in ('admin', 'chief') then
    return true;
  end if;

  if role_name not in ('lead', 'object_engineer') then
    return false;
  end if;

  return public.ppr_has_object_access(_object_id);
end;
$$;

create or replace function public.ppr_can_be_system_responsible(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = _user_id
      and p.role in ('lead', 'engineer', 'object_engineer')
  )
$$;

-- 4) Trigger validation
create or replace function public.ppr_validate_system_responsible()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.responsible_user_id is null then
    return new;
  end if;

  if not public.ppr_can_be_system_responsible(new.responsible_user_id) then
    raise exception 'invalid ppr system responsible role';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_ppr_validate_system_responsible on public.ppr_systems;
create trigger trg_ppr_validate_system_responsible
before insert or update on public.ppr_systems
for each row execute function public.ppr_validate_system_responsible();

-- 5) RLS
alter table public.ppr_system_groups enable row level security;
alter table public.ppr_systems enable row level security;
alter table public.ppr_subsystems enable row level security;
alter table public.ppr_rooms enable row level security;

-- ppr_system_groups
drop policy if exists "ppr_system_groups_select_authenticated" on public.ppr_system_groups;
drop policy if exists "ppr_system_groups_manage_roles" on public.ppr_system_groups;

create policy "ppr_system_groups_select_authenticated"
  on public.ppr_system_groups for select
  using (auth.uid() is not null and public.ppr_current_role() is not null);

create policy "ppr_system_groups_manage_roles"
  on public.ppr_system_groups for all
  using (public.ppr_current_role() in ('admin', 'chief', 'lead'))
  with check (public.ppr_current_role() in ('admin', 'chief', 'lead'));

-- ppr_systems
drop policy if exists "ppr_systems_select_by_object_access" on public.ppr_systems;
drop policy if exists "ppr_systems_manage_by_object_scope" on public.ppr_systems;

create policy "ppr_systems_select_by_object_access"
  on public.ppr_systems for select
  using (public.ppr_has_object_access(object_id));

create policy "ppr_systems_manage_by_object_scope"
  on public.ppr_systems for all
  using (public.ppr_can_manage_object_scope(object_id))
  with check (public.ppr_can_manage_object_scope(object_id));

-- ppr_subsystems
drop policy if exists "ppr_subsystems_select_by_object_access" on public.ppr_subsystems;
drop policy if exists "ppr_subsystems_manage_by_object_scope" on public.ppr_subsystems;

create policy "ppr_subsystems_select_by_object_access"
  on public.ppr_subsystems for select
  using (public.ppr_has_object_access(object_id));

create policy "ppr_subsystems_manage_by_object_scope"
  on public.ppr_subsystems for all
  using (public.ppr_can_manage_object_scope(object_id))
  with check (public.ppr_can_manage_object_scope(object_id));

-- ppr_rooms
drop policy if exists "ppr_rooms_select_by_object_access" on public.ppr_rooms;
drop policy if exists "ppr_rooms_manage_by_object_scope" on public.ppr_rooms;

create policy "ppr_rooms_select_by_object_access"
  on public.ppr_rooms for select
  using (public.ppr_has_object_access(object_id));

create policy "ppr_rooms_manage_by_object_scope"
  on public.ppr_rooms for all
  using (public.ppr_can_manage_object_scope(object_id))
  with check (public.ppr_can_manage_object_scope(object_id));
