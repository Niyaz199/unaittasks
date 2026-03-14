-- PPR equipment, QR and early RLS

create table if not exists public.ppr_equipment (
  id uuid primary key default gen_random_uuid(),
  object_id uuid not null references public.objects (id) on delete cascade,
  system_id uuid not null references public.ppr_systems (id) on delete restrict,
  subsystem_id uuid not null references public.ppr_subsystems (id) on delete restrict,
  room_id uuid not null references public.ppr_rooms (id) on delete restrict,
  inventory_no text not null,
  name text not null,
  dispatch_name text not null,
  service_start_date date not null,
  status text not null default 'active',
  serial_no text,
  manufacturer text,
  model text,
  description text,
  comment text,
  created_at timestamptz not null default now(),
  constraint ppr_equipment_inventory_no_key unique (inventory_no),
  constraint ppr_equipment_status_check check (status in ('active', 'repair', 'out_of_service', 'archived'))
);

create table if not exists public.ppr_equipment_qr_codes (
  id uuid primary key default gen_random_uuid(),
  object_id uuid not null references public.objects (id) on delete cascade,
  equipment_id uuid not null references public.ppr_equipment (id) on delete cascade,
  qr_token text not null,
  is_active boolean not null default true,
  generated_at timestamptz not null default now(),
  constraint ppr_equipment_qr_codes_qr_token_key unique (qr_token)
);

create table if not exists public.ppr_equipment_attachments (
  id uuid primary key default gen_random_uuid(),
  object_id uuid not null references public.objects (id) on delete cascade,
  equipment_id uuid not null references public.ppr_equipment (id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  uploaded_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  constraint ppr_equipment_attachments_storage_path_key unique (storage_path)
);

create index if not exists idx_ppr_equipment_object_id on public.ppr_equipment (object_id);
create index if not exists idx_ppr_equipment_system_id on public.ppr_equipment (system_id);
create index if not exists idx_ppr_equipment_subsystem_id on public.ppr_equipment (subsystem_id);
create index if not exists idx_ppr_equipment_room_id on public.ppr_equipment (room_id);
create index if not exists idx_ppr_equipment_status on public.ppr_equipment (status);

create index if not exists idx_ppr_equipment_qr_codes_object_id on public.ppr_equipment_qr_codes (object_id);
create unique index if not exists ppr_equipment_qr_codes_active_equipment_uidx
  on public.ppr_equipment_qr_codes (equipment_id)
  where is_active = true;

create index if not exists idx_ppr_equipment_attachments_object_id on public.ppr_equipment_attachments (object_id);
create index if not exists idx_ppr_equipment_attachments_equipment_id on public.ppr_equipment_attachments (equipment_id);
create index if not exists idx_ppr_equipment_attachments_uploaded_by on public.ppr_equipment_attachments (uploaded_by);

create or replace function public.ppr_generate_inventory_no(_object_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate text;
begin
  loop
    candidate :=
      'PPR-' ||
      upper(replace(left(_object_id::text, 8), '-', '')) ||
      '-' ||
      to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS') ||
      '-' ||
      upper(substring(encode(extensions.gen_random_bytes(2), 'hex') from 1 for 4));

    exit when not exists (
      select 1
      from public.ppr_equipment e
      where e.inventory_no = candidate
    );
  end loop;

  return candidate;
end;
$$;

create or replace function public.ppr_generate_qr_token()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate text;
begin
  loop
    candidate := encode(extensions.gen_random_bytes(16), 'hex');

    exit when not exists (
      select 1
      from public.ppr_equipment_qr_codes q
      where q.qr_token = candidate
    );
  end loop;

  return candidate;
end;
$$;

create or replace function public.ppr_validate_equipment_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  system_object_id uuid;
  subsystem_object_id uuid;
  subsystem_system_id uuid;
  room_object_id uuid;
begin
  if tg_op = 'INSERT' and coalesce(btrim(new.inventory_no), '') = '' then
    new.inventory_no := public.ppr_generate_inventory_no(new.object_id);
  elsif tg_op = 'UPDATE' and coalesce(btrim(new.inventory_no), '') = '' then
    raise exception 'inventory_no is required';
  else
    new.inventory_no := btrim(new.inventory_no);
  end if;

  select s.object_id
    into system_object_id
  from public.ppr_systems s
  where s.id = new.system_id;

  if system_object_id is null then
    raise exception 'invalid ppr system';
  end if;

  select ss.object_id, ss.system_id
    into subsystem_object_id, subsystem_system_id
  from public.ppr_subsystems ss
  where ss.id = new.subsystem_id;

  if subsystem_object_id is null then
    raise exception 'invalid ppr subsystem';
  end if;

  select r.object_id
    into room_object_id
  from public.ppr_rooms r
  where r.id = new.room_id;

  if room_object_id is null then
    raise exception 'invalid ppr room';
  end if;

  if system_object_id <> new.object_id then
    raise exception 'ppr system must belong to equipment object';
  end if;

  if subsystem_object_id <> new.object_id then
    raise exception 'ppr subsystem must belong to equipment object';
  end if;

  if subsystem_system_id <> new.system_id then
    raise exception 'ppr subsystem must belong to equipment system';
  end if;

  if room_object_id <> new.object_id then
    raise exception 'ppr room must belong to equipment object';
  end if;

  return new;
end;
$$;

create or replace function public.ppr_create_equipment_qr_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.ppr_equipment_qr_codes (
    object_id,
    equipment_id,
    qr_token,
    is_active
  )
  values (
    new.object_id,
    new.id,
    public.ppr_generate_qr_token(),
    true
  );

  return new;
end;
$$;

create or replace function public.ppr_sync_equipment_object_refs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.object_id = old.object_id then
    return new;
  end if;

  update public.ppr_equipment_qr_codes
  set object_id = new.object_id
  where equipment_id = new.id;

  update public.ppr_equipment_attachments
  set object_id = new.object_id
  where equipment_id = new.id;

  return new;
end;
$$;

drop trigger if exists trg_ppr_validate_equipment_scope on public.ppr_equipment;
create trigger trg_ppr_validate_equipment_scope
before insert or update on public.ppr_equipment
for each row execute function public.ppr_validate_equipment_scope();

drop trigger if exists trg_ppr_create_equipment_qr_code on public.ppr_equipment;
create trigger trg_ppr_create_equipment_qr_code
after insert on public.ppr_equipment
for each row execute function public.ppr_create_equipment_qr_code();

drop trigger if exists trg_ppr_sync_equipment_object_refs on public.ppr_equipment;
create trigger trg_ppr_sync_equipment_object_refs
after update of object_id on public.ppr_equipment
for each row execute function public.ppr_sync_equipment_object_refs();

alter table public.ppr_equipment enable row level security;
alter table public.ppr_equipment_qr_codes enable row level security;
alter table public.ppr_equipment_attachments enable row level security;

drop policy if exists "ppr_equipment_select_by_object_access" on public.ppr_equipment;
drop policy if exists "ppr_equipment_manage_by_object_scope" on public.ppr_equipment;

create policy "ppr_equipment_select_by_object_access"
  on public.ppr_equipment for select
  using (public.ppr_has_object_access(object_id));

create policy "ppr_equipment_manage_by_object_scope"
  on public.ppr_equipment for all
  using (public.ppr_can_manage_object_scope(object_id))
  with check (public.ppr_can_manage_object_scope(object_id));

drop policy if exists "ppr_equipment_qr_codes_select_by_object_access" on public.ppr_equipment_qr_codes;
drop policy if exists "ppr_equipment_qr_codes_manage_by_object_scope" on public.ppr_equipment_qr_codes;

create policy "ppr_equipment_qr_codes_select_by_object_access"
  on public.ppr_equipment_qr_codes for select
  using (public.ppr_has_object_access(object_id));

create policy "ppr_equipment_qr_codes_manage_by_object_scope"
  on public.ppr_equipment_qr_codes for all
  using (public.ppr_can_manage_object_scope(object_id))
  with check (public.ppr_can_manage_object_scope(object_id));

drop policy if exists "ppr_equipment_attachments_select_by_object_access" on public.ppr_equipment_attachments;
drop policy if exists "ppr_equipment_attachments_manage_by_object_scope" on public.ppr_equipment_attachments;

create policy "ppr_equipment_attachments_select_by_object_access"
  on public.ppr_equipment_attachments for select
  using (public.ppr_has_object_access(object_id));

create policy "ppr_equipment_attachments_manage_by_object_scope"
  on public.ppr_equipment_attachments for all
  using (public.ppr_can_manage_object_scope(object_id))
  with check (public.ppr_can_manage_object_scope(object_id));
