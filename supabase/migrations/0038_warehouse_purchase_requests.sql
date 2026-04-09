-- Warehouse stock, equipment components and purchase requests MVP

create table if not exists public.stock_items (
  id uuid primary key default gen_random_uuid(),
  object_id uuid not null references public.objects (id) on delete cascade,
  name text not null,
  kind text not null default 'material',
  unit text not null default 'шт',
  sku text,
  min_qty numeric(12,3) not null default 0,
  current_qty numeric(12,3) not null default 0,
  comment text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint stock_items_kind_check check (kind in ('material', 'spare_part', 'consumable', 'component')),
  constraint stock_items_min_qty_check check (min_qty >= 0),
  constraint stock_items_current_qty_check check (current_qty >= 0),
  constraint stock_items_object_name_key unique (object_id, name)
);

create table if not exists public.stock_locations (
  id uuid primary key default gen_random_uuid(),
  object_id uuid not null references public.objects (id) on delete cascade,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint stock_locations_object_name_key unique (object_id, name)
);

create table if not exists public.stock_location_qr_codes (
  id uuid primary key default gen_random_uuid(),
  object_id uuid not null references public.objects (id) on delete cascade,
  location_id uuid not null references public.stock_locations (id) on delete cascade,
  qr_token text not null,
  is_active boolean not null default true,
  generated_at timestamptz not null default now(),
  constraint stock_location_qr_codes_qr_token_key unique (qr_token)
);

create table if not exists public.stock_balances (
  id uuid primary key default gen_random_uuid(),
  object_id uuid not null references public.objects (id) on delete cascade,
  item_id uuid not null references public.stock_items (id) on delete cascade,
  location_id uuid not null references public.stock_locations (id) on delete cascade,
  qty numeric(12,3) not null default 0,
  updated_at timestamptz not null default now(),
  constraint stock_balances_qty_check check (qty >= 0),
  constraint stock_balances_item_location_key unique (item_id, location_id)
);

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  object_id uuid not null references public.objects (id) on delete cascade,
  item_id uuid not null references public.stock_items (id) on delete restrict,
  location_id uuid not null references public.stock_locations (id) on delete restrict,
  movement_type text not null,
  quantity numeric(12,3) not null,
  note text,
  actor_id uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  constraint stock_movements_type_check check (movement_type in ('receipt', 'issue', 'adjustment_in', 'adjustment_out')),
  constraint stock_movements_quantity_check check (quantity > 0)
);

create table if not exists public.purchase_requests (
  id uuid primary key default gen_random_uuid(),
  object_id uuid not null references public.objects (id) on delete cascade,
  status text not null default 'new',
  source text not null default 'manual',
  description text,
  requested_by uuid not null references public.profiles (id),
  assigned_to uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  fulfilled_at timestamptz,
  cancelled_at timestamptz,
  constraint purchase_requests_status_check check (status in ('new', 'in_progress', 'fulfilled', 'cancelled')),
  constraint purchase_requests_source_check check (source in ('manual', 'low_stock'))
);

create table if not exists public.purchase_request_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.purchase_requests (id) on delete cascade,
  object_id uuid not null references public.objects (id) on delete cascade,
  stock_item_id uuid references public.stock_items (id) on delete set null,
  title text not null,
  unit text not null default 'шт',
  quantity_requested numeric(12,3) not null,
  note text,
  is_auto_generated boolean not null default false,
  created_at timestamptz not null default now(),
  constraint purchase_request_items_qty_check check (quantity_requested > 0),
  constraint purchase_request_items_request_stock_item_key unique (request_id, stock_item_id)
);

create table if not exists public.ppr_equipment_components (
  id uuid primary key default gen_random_uuid(),
  object_id uuid not null references public.objects (id) on delete cascade,
  equipment_id uuid not null references public.ppr_equipment (id) on delete cascade,
  stock_item_id uuid not null references public.stock_items (id) on delete restrict,
  quantity numeric(12,3) not null default 1,
  reserve_qty numeric(12,3) not null default 0,
  is_critical boolean not null default false,
  note text,
  created_at timestamptz not null default now(),
  constraint ppr_equipment_components_quantity_check check (quantity > 0),
  constraint ppr_equipment_components_reserve_qty_check check (reserve_qty >= 0),
  constraint ppr_equipment_components_equipment_item_key unique (equipment_id, stock_item_id)
);

create index if not exists idx_stock_items_object_id on public.stock_items (object_id);
create index if not exists idx_stock_items_kind on public.stock_items (kind);
create index if not exists idx_stock_items_is_active on public.stock_items (is_active);
create index if not exists idx_stock_items_current_qty on public.stock_items (current_qty);
create index if not exists idx_stock_items_min_qty on public.stock_items (min_qty);

create index if not exists idx_stock_locations_object_id on public.stock_locations (object_id);
create index if not exists idx_stock_locations_is_active on public.stock_locations (is_active);

create index if not exists idx_stock_location_qr_codes_object_id on public.stock_location_qr_codes (object_id);
create unique index if not exists stock_location_qr_codes_active_location_uidx
  on public.stock_location_qr_codes (location_id)
  where is_active = true;

create index if not exists idx_stock_balances_object_id on public.stock_balances (object_id);
create index if not exists idx_stock_balances_item_id on public.stock_balances (item_id);
create index if not exists idx_stock_balances_location_id on public.stock_balances (location_id);

create index if not exists idx_stock_movements_object_id on public.stock_movements (object_id);
create index if not exists idx_stock_movements_item_id on public.stock_movements (item_id);
create index if not exists idx_stock_movements_location_id on public.stock_movements (location_id);
create index if not exists idx_stock_movements_actor_id on public.stock_movements (actor_id);
create index if not exists idx_stock_movements_created_at on public.stock_movements (created_at desc);

create index if not exists idx_purchase_requests_object_id on public.purchase_requests (object_id);
create index if not exists idx_purchase_requests_status on public.purchase_requests (status);
create index if not exists idx_purchase_requests_source on public.purchase_requests (source);
create index if not exists idx_purchase_requests_assigned_to on public.purchase_requests (assigned_to);
create index if not exists idx_purchase_requests_requested_by on public.purchase_requests (requested_by);
create index if not exists idx_purchase_request_items_request_id on public.purchase_request_items (request_id);
create index if not exists idx_purchase_request_items_object_id on public.purchase_request_items (object_id);
create index if not exists idx_purchase_request_items_stock_item_id on public.purchase_request_items (stock_item_id);

create index if not exists idx_ppr_equipment_components_object_id on public.ppr_equipment_components (object_id);
create index if not exists idx_ppr_equipment_components_equipment_id on public.ppr_equipment_components (equipment_id);
create index if not exists idx_ppr_equipment_components_stock_item_id on public.ppr_equipment_components (stock_item_id);
create index if not exists idx_ppr_equipment_components_is_critical on public.ppr_equipment_components (is_critical);

create or replace function public.warehouse_can_read(_object_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and public.has_object_access(_object_id)
$$;

create or replace function public.warehouse_can_manage_catalog(_object_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  role_name text;
begin
  role_name := public.current_role();

  if role_name is null then
    return false;
  end if;

  if role_name not in ('admin', 'chief', 'lead', 'engineer', 'object_engineer') then
    return false;
  end if;

  return public.has_object_access(_object_id);
end;
$$;

create or replace function public.warehouse_can_record_movement(_object_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  role_name text;
begin
  role_name := public.current_role();

  if role_name is null then
    return false;
  end if;

  if role_name not in ('admin', 'chief', 'lead', 'engineer', 'object_engineer', 'tech') then
    return false;
  end if;

  return public.has_object_access(_object_id);
end;
$$;

create or replace function public.purchase_request_can_create(_object_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.warehouse_can_record_movement(_object_id)
$$;

create or replace function public.purchase_request_can_read(_request public.purchase_requests)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.warehouse_can_read(_request.object_id)
$$;

create or replace function public.purchase_request_can_manage(_request public.purchase_requests)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  role_name text;
begin
  role_name := public.current_role();

  if role_name is null then
    return false;
  end if;

  if role_name not in ('admin', 'chief', 'lead', 'object_engineer') then
    return false;
  end if;

  return public.has_object_access(_request.object_id);
end;
$$;

create or replace function public.stock_location_generate_qr_token()
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
      from public.stock_location_qr_codes q
      where q.qr_token = candidate
    );
  end loop;

  return candidate;
end;
$$;

create or replace function public.stock_prepare_item_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.name := regexp_replace(btrim(new.name), '\s+', ' ', 'g');
  new.unit := regexp_replace(btrim(new.unit), '\s+', ' ', 'g');
  new.sku := nullif(regexp_replace(btrim(coalesce(new.sku, '')), '\s+', ' ', 'g'), '');
  new.comment := nullif(btrim(coalesce(new.comment, '')), '');
  return new;
end;
$$;

create or replace function public.stock_prepare_location_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.name := regexp_replace(btrim(new.name), '\s+', ' ', 'g');
  new.description := nullif(btrim(coalesce(new.description, '')), '');
  return new;
end;
$$;

create or replace function public.stock_validate_component_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  equipment_object_id uuid;
  item_object_id uuid;
begin
  select e.object_id
    into equipment_object_id
  from public.ppr_equipment e
  where e.id = new.equipment_id;

  if equipment_object_id is null then
    raise exception 'invalid equipment';
  end if;

  select si.object_id
    into item_object_id
  from public.stock_items si
  where si.id = new.stock_item_id;

  if item_object_id is null then
    raise exception 'invalid stock item';
  end if;

  if equipment_object_id <> new.object_id or item_object_id <> new.object_id then
    raise exception 'equipment component must stay inside one object';
  end if;

  new.note := nullif(btrim(coalesce(new.note, '')), '');
  return new;
end;
$$;

create or replace function public.stock_create_location_qr_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.stock_location_qr_codes (
    object_id,
    location_id,
    qr_token,
    is_active
  )
  values (
    new.object_id,
    new.id,
    public.stock_location_generate_qr_token(),
    true
  );

  return new;
end;
$$;

create or replace function public.stock_sync_location_qr_object_refs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.object_id = old.object_id then
    return new;
  end if;

  update public.stock_location_qr_codes
  set object_id = new.object_id
  where location_id = new.id;

  update public.stock_balances
  set object_id = new.object_id
  where location_id = new.id;

  update public.stock_movements
  set object_id = new.object_id
  where location_id = new.id;

  return new;
end;
$$;

create or replace function public.stock_validate_movement_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  item_object_id uuid;
  location_object_id uuid;
begin
  select si.object_id
    into item_object_id
  from public.stock_items si
  where si.id = new.item_id;

  if item_object_id is null then
    raise exception 'invalid stock item';
  end if;

  select sl.object_id
    into location_object_id
  from public.stock_locations sl
  where sl.id = new.location_id;

  if location_object_id is null then
    raise exception 'invalid stock location';
  end if;

  if item_object_id <> new.object_id or location_object_id <> new.object_id then
    raise exception 'stock movement must stay inside one object';
  end if;

  new.note := nullif(btrim(coalesce(new.note, '')), '');
  return new;
end;
$$;

create or replace function public.stock_apply_movement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  delta numeric(12,3);
  next_location_qty numeric(12,3);
  next_item_qty numeric(12,3);
begin
  if new.movement_type in ('receipt', 'adjustment_in') then
    delta := new.quantity;
  else
    delta := new.quantity * -1;
  end if;

  insert into public.stock_balances (object_id, item_id, location_id, qty, updated_at)
  values (new.object_id, new.item_id, new.location_id, greatest(delta, 0), now())
  on conflict (item_id, location_id)
  do update
    set qty = public.stock_balances.qty + delta,
        updated_at = now()
  returning qty into next_location_qty;

  if next_location_qty < 0 then
    raise exception 'Недостаточно остатка по выбранному месту хранения';
  end if;

  update public.stock_items si
  set current_qty = si.current_qty + delta
  where si.id = new.item_id
  returning si.current_qty into next_item_qty;

  if next_item_qty < 0 then
    raise exception 'Недостаточно общего остатка ТМЦ';
  end if;

  return new;
end;
$$;

create or replace function public.stock_location_resolve_qr_token(_token text)
returns table (
  id uuid,
  object_id uuid,
  location_id uuid,
  qr_token text,
  is_active boolean,
  generated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select q.id, q.object_id, q.location_id, q.qr_token, q.is_active, q.generated_at
  from public.stock_location_qr_codes q
  where auth.uid() is not null
    and q.qr_token = btrim(coalesce(_token, ''))
    and q.is_active = true
    and public.warehouse_can_read(q.object_id)
  limit 1
$$;

create or replace function public.stock_location_regenerate_qr(_location_id uuid)
returns table (
  id uuid,
  object_id uuid,
  location_id uuid,
  qr_token text,
  is_active boolean,
  generated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  location_row public.stock_locations%rowtype;
begin
  select *
    into location_row
  from public.stock_locations sl
  where sl.id = _location_id;

  if not found then
    raise exception 'Место хранения не найдено';
  end if;

  if not public.warehouse_can_manage_catalog(location_row.object_id) then
    raise exception 'Нет доступа к регенерации QR места хранения';
  end if;

  update public.stock_location_qr_codes q
  set is_active = false
  where q.location_id = location_row.id
    and q.is_active = true;

  return query
  insert into public.stock_location_qr_codes (
    object_id,
    location_id,
    qr_token,
    is_active
  )
  values (
    location_row.object_id,
    location_row.id,
    public.stock_location_generate_qr_token(),
    true
  )
  returning
    stock_location_qr_codes.id,
    stock_location_qr_codes.object_id,
    stock_location_qr_codes.location_id,
    stock_location_qr_codes.qr_token,
    stock_location_qr_codes.is_active,
    stock_location_qr_codes.generated_at;
end;
$$;

create or replace function public.purchase_request_prepare_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();

  if new.status = 'fulfilled' and new.fulfilled_at is null then
    new.fulfilled_at := now();
  end if;

  if new.status = 'cancelled' and new.cancelled_at is null then
    new.cancelled_at := now();
  end if;

  if new.status <> 'fulfilled' then
    new.fulfilled_at := null;
  end if;

  if new.status <> 'cancelled' then
    new.cancelled_at := null;
  end if;

  new.description := nullif(btrim(coalesce(new.description, '')), '');
  return new;
end;
$$;

create or replace function public.purchase_request_item_prepare_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.title := regexp_replace(btrim(new.title), '\s+', ' ', 'g');
  new.unit := regexp_replace(btrim(new.unit), '\s+', ' ', 'g');
  new.note := nullif(btrim(coalesce(new.note, '')), '');
  return new;
end;
$$;

create or replace function public.stock_check_low_stock(
  _item_id uuid,
  _actor_id uuid default auth.uid()
)
returns table (
  request_id uuid,
  created_request boolean,
  assigned_to uuid,
  object_id uuid,
  stock_item_id uuid,
  item_name text,
  requested_qty numeric(12,3)
)
language plpgsql
security definer
set search_path = public
as $$
declare
  item_row public.stock_items%rowtype;
  object_engineer_id uuid;
  open_request_id uuid;
  created_new_request boolean := false;
  purchase_qty numeric(12,3);
begin
  select *
    into item_row
  from public.stock_items si
  where si.id = _item_id;

  if not found then
    return;
  end if;

  if item_row.current_qty > item_row.min_qty then
    return;
  end if;

  purchase_qty := greatest(item_row.min_qty - item_row.current_qty, 1);

  select o.object_engineer_id
    into object_engineer_id
  from public.objects o
  where o.id = item_row.object_id;

  select pr.id
    into open_request_id
  from public.purchase_requests pr
  join public.purchase_request_items pri on pri.request_id = pr.id
  where pr.object_id = item_row.object_id
    and pr.source = 'low_stock'
    and pr.status in ('new', 'in_progress')
    and pri.stock_item_id = item_row.id
  order by pr.created_at desc
  limit 1;

  if open_request_id is null then
    select pr.id
      into open_request_id
    from public.purchase_requests pr
    where pr.object_id = item_row.object_id
      and pr.source = 'low_stock'
      and pr.status in ('new', 'in_progress')
    order by pr.created_at desc
    limit 1;
  end if;

  if open_request_id is null then
    insert into public.purchase_requests (
      object_id,
      status,
      source,
      description,
      requested_by,
      assigned_to
    )
    values (
      item_row.object_id,
      'new',
      'low_stock',
      'Автоматически создана по критическому остатку на складе.',
      coalesce(_actor_id, auth.uid()),
      object_engineer_id
    )
    returning id into open_request_id;

    created_new_request := true;
  end if;

  insert into public.purchase_request_items (
    request_id,
    object_id,
    stock_item_id,
    title,
    unit,
    quantity_requested,
    note,
    is_auto_generated
  )
  values (
    open_request_id,
    item_row.object_id,
    item_row.id,
    item_row.name,
    item_row.unit,
    purchase_qty,
    format(
      'Критический остаток: %.3s %s, минимум: %.3s %s.',
      trim(to_char(item_row.current_qty, 'FM999999990.###')),
      item_row.unit,
      trim(to_char(item_row.min_qty, 'FM999999990.###')),
      item_row.unit
    ),
    true
  )
  on conflict (request_id, stock_item_id)
  do update
    set title = excluded.title,
        unit = excluded.unit,
        quantity_requested = greatest(public.purchase_request_items.quantity_requested, excluded.quantity_requested),
        note = excluded.note;

  return query
  select
    open_request_id,
    created_new_request,
    object_engineer_id,
    item_row.object_id,
    item_row.id,
    item_row.name,
    purchase_qty;
end;
$$;

drop trigger if exists trg_stock_prepare_item_row on public.stock_items;
create trigger trg_stock_prepare_item_row
before insert or update on public.stock_items
for each row execute function public.stock_prepare_item_row();

drop trigger if exists trg_stock_prepare_location_row on public.stock_locations;
create trigger trg_stock_prepare_location_row
before insert or update on public.stock_locations
for each row execute function public.stock_prepare_location_row();

drop trigger if exists trg_stock_create_location_qr_code on public.stock_locations;
create trigger trg_stock_create_location_qr_code
after insert on public.stock_locations
for each row execute function public.stock_create_location_qr_code();

drop trigger if exists trg_stock_sync_location_qr_object_refs on public.stock_locations;
create trigger trg_stock_sync_location_qr_object_refs
after update of object_id on public.stock_locations
for each row execute function public.stock_sync_location_qr_object_refs();

drop trigger if exists trg_stock_validate_component_scope on public.ppr_equipment_components;
create trigger trg_stock_validate_component_scope
before insert or update on public.ppr_equipment_components
for each row execute function public.stock_validate_component_scope();

drop trigger if exists trg_stock_validate_movement_scope on public.stock_movements;
create trigger trg_stock_validate_movement_scope
before insert on public.stock_movements
for each row execute function public.stock_validate_movement_scope();

drop trigger if exists trg_stock_apply_movement on public.stock_movements;
create trigger trg_stock_apply_movement
after insert on public.stock_movements
for each row execute function public.stock_apply_movement();

drop trigger if exists trg_purchase_request_prepare_row on public.purchase_requests;
create trigger trg_purchase_request_prepare_row
before insert or update on public.purchase_requests
for each row execute function public.purchase_request_prepare_row();

drop trigger if exists trg_purchase_request_item_prepare_row on public.purchase_request_items;
create trigger trg_purchase_request_item_prepare_row
before insert or update on public.purchase_request_items
for each row execute function public.purchase_request_item_prepare_row();

alter table public.stock_items enable row level security;
alter table public.stock_locations enable row level security;
alter table public.stock_location_qr_codes enable row level security;
alter table public.stock_balances enable row level security;
alter table public.stock_movements enable row level security;
alter table public.purchase_requests enable row level security;
alter table public.purchase_request_items enable row level security;
alter table public.ppr_equipment_components enable row level security;

drop policy if exists "stock_items_select_by_object_access" on public.stock_items;
drop policy if exists "stock_items_manage_by_object_scope" on public.stock_items;
create policy "stock_items_select_by_object_access"
  on public.stock_items for select
  using (public.warehouse_can_read(object_id));
create policy "stock_items_manage_by_object_scope"
  on public.stock_items for all
  using (public.warehouse_can_manage_catalog(object_id))
  with check (public.warehouse_can_manage_catalog(object_id));

drop policy if exists "stock_locations_select_by_object_access" on public.stock_locations;
drop policy if exists "stock_locations_manage_by_object_scope" on public.stock_locations;
create policy "stock_locations_select_by_object_access"
  on public.stock_locations for select
  using (public.warehouse_can_read(object_id));
create policy "stock_locations_manage_by_object_scope"
  on public.stock_locations for all
  using (public.warehouse_can_manage_catalog(object_id))
  with check (public.warehouse_can_manage_catalog(object_id));

drop policy if exists "stock_location_qr_codes_select_by_object_access" on public.stock_location_qr_codes;
drop policy if exists "stock_location_qr_codes_manage_by_object_scope" on public.stock_location_qr_codes;
create policy "stock_location_qr_codes_select_by_object_access"
  on public.stock_location_qr_codes for select
  using (public.warehouse_can_read(object_id));
create policy "stock_location_qr_codes_manage_by_object_scope"
  on public.stock_location_qr_codes for all
  using (public.warehouse_can_manage_catalog(object_id))
  with check (public.warehouse_can_manage_catalog(object_id));

drop policy if exists "stock_balances_select_by_object_access" on public.stock_balances;
create policy "stock_balances_select_by_object_access"
  on public.stock_balances for select
  using (public.warehouse_can_read(object_id));

drop policy if exists "stock_movements_select_by_object_access" on public.stock_movements;
drop policy if exists "stock_movements_insert_by_object_access" on public.stock_movements;
create policy "stock_movements_select_by_object_access"
  on public.stock_movements for select
  using (public.warehouse_can_read(object_id));
create policy "stock_movements_insert_by_object_access"
  on public.stock_movements for insert
  with check (
    actor_id = auth.uid()
    and public.warehouse_can_record_movement(object_id)
  );

drop policy if exists "purchase_requests_select_by_object_access" on public.purchase_requests;
drop policy if exists "purchase_requests_insert_by_object_access" on public.purchase_requests;
drop policy if exists "purchase_requests_update_by_management_scope" on public.purchase_requests;
create policy "purchase_requests_select_by_object_access"
  on public.purchase_requests for select
  using (public.purchase_request_can_read(purchase_requests));
create policy "purchase_requests_insert_by_object_access"
  on public.purchase_requests for insert
  with check (
    requested_by = auth.uid()
    and public.purchase_request_can_create(object_id)
  );
create policy "purchase_requests_update_by_management_scope"
  on public.purchase_requests for update
  using (public.purchase_request_can_manage(purchase_requests))
  with check (public.purchase_request_can_manage(purchase_requests));

drop policy if exists "purchase_request_items_select_by_parent_request" on public.purchase_request_items;
drop policy if exists "purchase_request_items_insert_by_parent_request" on public.purchase_request_items;
drop policy if exists "purchase_request_items_update_by_parent_request" on public.purchase_request_items;
create policy "purchase_request_items_select_by_parent_request"
  on public.purchase_request_items for select
  using (
    exists (
      select 1
      from public.purchase_requests pr
      where pr.id = purchase_request_items.request_id
        and public.purchase_request_can_read(pr)
    )
  );
create policy "purchase_request_items_insert_by_parent_request"
  on public.purchase_request_items for insert
  with check (
    exists (
      select 1
      from public.purchase_requests pr
      where pr.id = purchase_request_items.request_id
        and public.purchase_request_can_create(pr.object_id)
    )
  );
create policy "purchase_request_items_update_by_parent_request"
  on public.purchase_request_items for update
  using (
    exists (
      select 1
      from public.purchase_requests pr
      where pr.id = purchase_request_items.request_id
        and public.purchase_request_can_manage(pr)
    )
  )
  with check (
    exists (
      select 1
      from public.purchase_requests pr
      where pr.id = purchase_request_items.request_id
        and public.purchase_request_can_manage(pr)
    )
  );

drop policy if exists "ppr_equipment_components_select_by_object_access" on public.ppr_equipment_components;
drop policy if exists "ppr_equipment_components_manage_by_object_scope" on public.ppr_equipment_components;
create policy "ppr_equipment_components_select_by_object_access"
  on public.ppr_equipment_components for select
  using (public.warehouse_can_read(object_id));
create policy "ppr_equipment_components_manage_by_object_scope"
  on public.ppr_equipment_components for all
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
