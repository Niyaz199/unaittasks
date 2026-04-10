-- Stock items: primary storage location and system group links

alter table public.stock_items
  add column if not exists storage_location_id uuid references public.stock_locations (id) on delete set null;

create index if not exists idx_stock_items_storage_location_id
  on public.stock_items (storage_location_id);

create table if not exists public.stock_item_system_groups (
  id uuid primary key default gen_random_uuid(),
  object_id uuid not null references public.objects (id) on delete cascade,
  stock_item_id uuid not null references public.stock_items (id) on delete cascade,
  system_group_id uuid not null references public.ppr_system_groups (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint stock_item_system_groups_item_group_key unique (stock_item_id, system_group_id)
);

create index if not exists idx_stock_item_system_groups_object_id
  on public.stock_item_system_groups (object_id);

create index if not exists idx_stock_item_system_groups_stock_item_id
  on public.stock_item_system_groups (stock_item_id);

create index if not exists idx_stock_item_system_groups_system_group_id
  on public.stock_item_system_groups (system_group_id);

create or replace function public.stock_prepare_item_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  location_object_id uuid;
begin
  new.name := regexp_replace(btrim(new.name), '\s+', ' ', 'g');
  new.unit := regexp_replace(btrim(coalesce(new.unit, '')), '\s+', ' ', 'g');
  new.sku := nullif(regexp_replace(btrim(coalesce(new.sku, '')), '\s+', ' ', 'g'), '');
  new.comment := nullif(btrim(coalesce(new.comment, '')), '');

  if new.storage_location_id is not null then
    select sl.object_id
      into location_object_id
    from public.stock_locations sl
    where sl.id = new.storage_location_id;

    if location_object_id is null then
      raise exception 'invalid storage location';
    end if;

    if location_object_id <> new.object_id then
      raise exception 'stock item storage location must stay inside one object';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.stock_validate_item_system_group_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  item_object_id uuid;
begin
  select si.object_id
    into item_object_id
  from public.stock_items si
  where si.id = new.stock_item_id;

  if item_object_id is null then
    raise exception 'invalid stock item';
  end if;

  if item_object_id <> new.object_id then
    raise exception 'stock item system group link must stay inside one object';
  end if;

  return new;
end;
$$;

create or replace function public.stock_sync_item_system_group_object_refs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.object_id = old.object_id then
    return new;
  end if;

  update public.stock_item_system_groups
  set object_id = new.object_id
  where stock_item_id = new.id;

  return new;
end;
$$;

create or replace function public.stock_sync_item_storage_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.object_id = old.object_id then
    return new;
  end if;

  update public.stock_items
  set storage_location_id = null
  where storage_location_id = new.id
    and object_id <> new.object_id;

  return new;
end;
$$;

drop trigger if exists trg_stock_validate_item_system_group_scope on public.stock_item_system_groups;
create trigger trg_stock_validate_item_system_group_scope
before insert or update on public.stock_item_system_groups
for each row execute function public.stock_validate_item_system_group_scope();

drop trigger if exists trg_stock_sync_item_system_group_object_refs on public.stock_items;
create trigger trg_stock_sync_item_system_group_object_refs
after update of object_id on public.stock_items
for each row execute function public.stock_sync_item_system_group_object_refs();

drop trigger if exists trg_stock_sync_item_storage_scope on public.stock_locations;
create trigger trg_stock_sync_item_storage_scope
after update of object_id on public.stock_locations
for each row execute function public.stock_sync_item_storage_scope();

alter table public.stock_item_system_groups enable row level security;

drop policy if exists "stock_item_system_groups_select_by_object_access" on public.stock_item_system_groups;
drop policy if exists "stock_item_system_groups_manage_by_object_scope" on public.stock_item_system_groups;

create policy "stock_item_system_groups_select_by_object_access"
  on public.stock_item_system_groups for select
  using (public.warehouse_can_read(object_id));

create policy "stock_item_system_groups_manage_by_object_scope"
  on public.stock_item_system_groups for all
  using (public.warehouse_can_manage_catalog(object_id))
  with check (public.warehouse_can_manage_catalog(object_id));

do $$
begin
  perform pg_notify('pgrst', 'reload schema');
  perform pg_notify('pgrst', 'reload config');
exception
  when others then
    null;
end;
$$;
