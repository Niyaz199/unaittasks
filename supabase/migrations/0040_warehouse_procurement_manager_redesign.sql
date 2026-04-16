-- Procurement manager role, warehouse item redesign and daily purchase drafts

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('admin', 'chief', 'lead', 'engineer', 'object_engineer', 'tech', 'procurement_manager'));

create or replace function public.can_manage_user_role(_actor_role text, _target_role text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if _actor_role is null or _target_role is null then
    return false;
  end if;

  if _actor_role in ('admin', 'chief', 'lead') then
    return _target_role in ('admin', 'chief', 'lead', 'engineer', 'object_engineer', 'tech', 'procurement_manager');
  end if;

  if _actor_role = 'engineer' then
    return _target_role = 'tech';
  end if;

  if _actor_role = 'object_engineer' then
    return _target_role in ('engineer', 'tech');
  end if;

  return false;
end;
$$;

alter table public.stock_locations
  add column if not exists system_id uuid references public.ppr_systems (id) on delete restrict,
  add column if not exists room_id uuid references public.object_rooms (id) on delete restrict;

create index if not exists idx_stock_locations_system_id
  on public.stock_locations (system_id);

create index if not exists idx_stock_locations_room_id
  on public.stock_locations (room_id);

alter table public.stock_items
  add column if not exists is_spare_part boolean not null default false,
  add column if not exists procurement_method text not null default 'engineer';

alter table public.stock_items
  drop constraint if exists stock_items_kind_check;

update public.stock_items
set
  is_spare_part = case
    when kind = 'component' and storage_location_id is not null then true
    else false
  end,
  procurement_method = coalesce(procurement_method, 'engineer'),
  kind = case
    when kind = 'component' then 'component'
    else 'zip'
  end
where kind in ('material', 'spare_part', 'consumable', 'component');

alter table public.stock_items
  add constraint stock_items_kind_check
  check (kind in ('zip', 'component'));

alter table public.stock_items
  drop constraint if exists stock_items_procurement_method_check;

alter table public.stock_items
  add constraint stock_items_procurement_method_check
  check (procurement_method in ('engineer', 'procurement'));

create index if not exists idx_stock_items_procurement_method
  on public.stock_items (procurement_method);

create or replace function public.stock_prepare_location_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  system_object_id uuid;
  room_object_id uuid;
begin
  new.name := regexp_replace(btrim(new.name), '\s+', ' ', 'g');
  new.description := nullif(btrim(coalesce(new.description, '')), '');

  if new.system_id is null then
    raise exception 'storage location system is required';
  end if;

  if new.room_id is null then
    raise exception 'storage location room is required';
  end if;

  select s.object_id
    into system_object_id
  from public.ppr_systems s
  where s.id = new.system_id;

  if system_object_id is null then
    raise exception 'invalid storage location system';
  end if;

  select r.object_id
    into room_object_id
  from public.object_rooms r
  where r.id = new.room_id;

  if room_object_id is null then
    raise exception 'invalid storage location room';
  end if;

  if system_object_id <> new.object_id or room_object_id <> new.object_id then
    raise exception 'storage location must stay inside one object';
  end if;

  return new;
end;
$$;

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

  if new.procurement_method is null then
    new.procurement_method := 'engineer';
  end if;

  if new.kind = 'zip' and new.storage_location_id is null then
    raise exception 'zip item requires storage location';
  end if;

  if new.kind = 'component' and coalesce(new.is_spare_part, false) = true and new.storage_location_id is null then
    raise exception 'component marked as spare part requires storage location';
  end if;

  if new.kind = 'component' and coalesce(new.is_spare_part, false) = false then
    new.storage_location_id := null;
  end if;

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

alter table public.purchase_requests
  alter column requested_by drop not null;

alter table public.purchase_requests
  add column if not exists request_kind text not null default 'final',
  add column if not exists executor_role text,
  add column if not exists draft_date date,
  add column if not exists origin_request_id uuid references public.purchase_requests (id) on delete set null,
  add column if not exists processed_at timestamptz,
  add column if not exists approved_by uuid references public.profiles (id) on delete set null;

alter table public.purchase_requests
  drop constraint if exists purchase_requests_source_check;

update public.purchase_requests
set source = 'warehouse_daily'
where source = 'low_stock';

alter table public.purchase_requests
  add constraint purchase_requests_source_check
  check (source in ('manual', 'warehouse_daily'));

alter table public.purchase_requests
  drop constraint if exists purchase_requests_request_kind_check;

alter table public.purchase_requests
  add constraint purchase_requests_request_kind_check
  check (request_kind in ('draft', 'final'));

alter table public.purchase_requests
  drop constraint if exists purchase_requests_executor_role_check;

alter table public.purchase_requests
  add constraint purchase_requests_executor_role_check
  check (executor_role in ('engineer', 'procurement_manager') or executor_role is null);

create index if not exists idx_purchase_requests_request_kind
  on public.purchase_requests (request_kind);

create index if not exists idx_purchase_requests_executor_role
  on public.purchase_requests (executor_role);

create index if not exists idx_purchase_requests_draft_date
  on public.purchase_requests (draft_date);

create unique index if not exists idx_purchase_requests_open_daily_draft
  on public.purchase_requests (object_id, draft_date)
  where request_kind = 'draft'
    and source = 'warehouse_daily'
    and processed_at is null;

alter table public.purchase_request_items
  add column if not exists assigned_role text,
  add column if not exists current_qty_snapshot numeric(12,3),
  add column if not exists min_qty_snapshot numeric(12,3),
  add column if not exists storage_location_id uuid references public.stock_locations (id) on delete set null,
  add column if not exists location_name_snapshot text,
  add column if not exists characteristics text,
  add column if not exists in_cart boolean not null default false,
  add column if not exists cart_marked_at timestamptz;

alter table public.purchase_request_items
  drop constraint if exists purchase_request_items_assigned_role_check;

alter table public.purchase_request_items
  add constraint purchase_request_items_assigned_role_check
  check (assigned_role in ('engineer', 'procurement_manager') or assigned_role is null);

create index if not exists idx_purchase_request_items_assigned_role
  on public.purchase_request_items (assigned_role);

create or replace function public.purchase_request_can_create(_object_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return false;
  end if;

  if public.current_role() = 'procurement_manager' then
    return false;
  end if;

  return public.warehouse_can_record_movement(_object_id);
end;
$$;

create or replace function public.purchase_request_can_read(_request public.purchase_requests)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return false;
  end if;

  if public.current_role() = 'procurement_manager' then
    return true;
  end if;

  return public.warehouse_can_read(_request.object_id);
end;
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

  if role_name = 'procurement_manager' then
    return true;
  end if;

  if role_name not in ('admin', 'chief', 'lead', 'object_engineer') then
    return false;
  end if;

  return public.has_object_access(_request.object_id);
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
  new.location_name_snapshot := nullif(btrim(coalesce(new.location_name_snapshot, '')), '');
  new.characteristics := nullif(btrim(coalesce(new.characteristics, '')), '');

  if new.in_cart = true then
    new.cart_marked_at := coalesce(new.cart_marked_at, now());
  else
    new.cart_marked_at := null;
  end if;

  return new;
end;
$$;

create or replace function public.stock_build_daily_purchase_drafts(_draft_date date default current_date)
returns table (
  created_drafts integer,
  touched_items integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_drafts integer := 0;
  upserted_items integer := 0;
begin
  insert into public.purchase_requests (
    object_id,
    status,
    source,
    request_kind,
    description,
    requested_by,
    assigned_to,
    draft_date
  )
  select
    candidate.object_id,
    'new',
    'warehouse_daily',
    'draft',
    'Ежедневная черновая подборка дефицита ТМЦ.',
    null,
    candidate.object_engineer_id,
    _draft_date
  from (
    select distinct
      si.object_id,
      o.object_engineer_id
    from public.stock_items si
    left join public.objects o on o.id = si.object_id
    where si.is_active = true
      and (si.kind = 'zip' or coalesce(si.is_spare_part, false) = true)
      and si.current_qty <= si.min_qty
  ) candidate
  on conflict (object_id, draft_date)
    where request_kind = 'draft'
      and source = 'warehouse_daily'
      and processed_at is null
  do nothing;

  get diagnostics inserted_drafts = row_count;

  insert into public.purchase_request_items (
    request_id,
    object_id,
    stock_item_id,
    title,
    unit,
    quantity_requested,
    note,
    is_auto_generated,
    assigned_role,
    current_qty_snapshot,
    min_qty_snapshot,
    storage_location_id,
    location_name_snapshot,
    characteristics
  )
  select
    pr.id,
    si.object_id,
    si.id,
    si.name,
    si.unit,
    greatest(si.min_qty - si.current_qty, 1),
    si.comment,
    true,
    case
      when si.procurement_method = 'procurement' then 'procurement_manager'
      else 'engineer'
    end,
    si.current_qty,
    si.min_qty,
    si.storage_location_id,
    sl.name,
    nullif(concat_ws(' • ', nullif(si.sku, ''), case when si.kind = 'zip' then 'ЗИП' else 'Компонент' end), '')
  from public.stock_items si
  join public.purchase_requests pr
    on pr.object_id = si.object_id
   and pr.request_kind = 'draft'
   and pr.source = 'warehouse_daily'
   and pr.draft_date = _draft_date
   and pr.processed_at is null
  left join public.stock_locations sl on sl.id = si.storage_location_id
  where si.is_active = true
    and (si.kind = 'zip' or coalesce(si.is_spare_part, false) = true)
    and si.current_qty <= si.min_qty
  on conflict (request_id, stock_item_id)
  do update
    set title = excluded.title,
        unit = excluded.unit,
        quantity_requested = excluded.quantity_requested,
        note = excluded.note,
        assigned_role = excluded.assigned_role,
        current_qty_snapshot = excluded.current_qty_snapshot,
        min_qty_snapshot = excluded.min_qty_snapshot,
        storage_location_id = excluded.storage_location_id,
        location_name_snapshot = excluded.location_name_snapshot,
        characteristics = excluded.characteristics;

  get diagnostics upserted_items = row_count;

  return query select inserted_drafts, upserted_items;
end;
$$;

create or replace function public.purchase_request_finalize_draft(
  _request_id uuid,
  _actor_id uuid default auth.uid()
)
returns table (
  engineer_request_id uuid,
  procurement_request_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  draft_row public.purchase_requests%rowtype;
  object_engineer_id uuid;
  next_engineer_request_id uuid;
  next_procurement_request_id uuid;
begin
  select *
    into draft_row
  from public.purchase_requests pr
  where pr.id = _request_id
    and pr.request_kind = 'draft';

  if not found then
    raise exception 'draft request not found';
  end if;

  if draft_row.processed_at is not null then
    return query
    select
      max(case when pr.executor_role = 'engineer' then pr.id end),
      max(case when pr.executor_role = 'procurement_manager' then pr.id end)
    from public.purchase_requests pr
    where pr.origin_request_id = draft_row.id;
    return;
  end if;

  if not public.purchase_request_can_manage(draft_row) then
    raise exception 'access denied to finalize draft';
  end if;

  select o.object_engineer_id
    into object_engineer_id
  from public.objects o
  where o.id = draft_row.object_id;

  if exists (
    select 1
    from public.purchase_request_items pri
    where pri.request_id = draft_row.id
      and pri.assigned_role = 'engineer'
  ) then
    insert into public.purchase_requests (
      object_id,
      status,
      source,
      request_kind,
      description,
      requested_by,
      assigned_to,
      executor_role,
      origin_request_id
    )
    values (
      draft_row.object_id,
      'new',
      'warehouse_daily',
      'final',
      'Итоговая заявка инженеру объекта после разбора ежедневного черновика.',
      _actor_id,
      object_engineer_id,
      'engineer',
      draft_row.id
    )
    returning id into next_engineer_request_id;

    insert into public.purchase_request_items (
      request_id,
      object_id,
      stock_item_id,
      title,
      unit,
      quantity_requested,
      note,
      is_auto_generated,
      assigned_role,
      current_qty_snapshot,
      min_qty_snapshot,
      storage_location_id,
      location_name_snapshot,
      characteristics,
      in_cart
    )
    select
      next_engineer_request_id,
      pri.object_id,
      pri.stock_item_id,
      pri.title,
      pri.unit,
      pri.quantity_requested,
      pri.note,
      pri.is_auto_generated,
      'engineer',
      pri.current_qty_snapshot,
      pri.min_qty_snapshot,
      pri.storage_location_id,
      pri.location_name_snapshot,
      pri.characteristics,
      false
    from public.purchase_request_items pri
    where pri.request_id = draft_row.id
      and pri.assigned_role = 'engineer';
  end if;

  if exists (
    select 1
    from public.purchase_request_items pri
    where pri.request_id = draft_row.id
      and pri.assigned_role = 'procurement_manager'
  ) then
    insert into public.purchase_requests (
      object_id,
      status,
      source,
      request_kind,
      description,
      requested_by,
      assigned_to,
      executor_role,
      origin_request_id
    )
    values (
      draft_row.object_id,
      'new',
      'warehouse_daily',
      'final',
      'Итоговая заявка менеджеру по закупкам после разбора ежедневного черновика.',
      _actor_id,
      null,
      'procurement_manager',
      draft_row.id
    )
    returning id into next_procurement_request_id;

    insert into public.purchase_request_items (
      request_id,
      object_id,
      stock_item_id,
      title,
      unit,
      quantity_requested,
      note,
      is_auto_generated,
      assigned_role,
      current_qty_snapshot,
      min_qty_snapshot,
      storage_location_id,
      location_name_snapshot,
      characteristics,
      in_cart
    )
    select
      next_procurement_request_id,
      pri.object_id,
      pri.stock_item_id,
      pri.title,
      pri.unit,
      pri.quantity_requested,
      pri.note,
      pri.is_auto_generated,
      'procurement_manager',
      pri.current_qty_snapshot,
      pri.min_qty_snapshot,
      pri.storage_location_id,
      pri.location_name_snapshot,
      pri.characteristics,
      false
    from public.purchase_request_items pri
    where pri.request_id = draft_row.id
      and pri.assigned_role = 'procurement_manager';
  end if;

  update public.purchase_requests pr
  set processed_at = now(),
      approved_by = _actor_id,
      status = 'fulfilled'
  where pr.id = draft_row.id;

  return query select next_engineer_request_id, next_procurement_request_id;
end;
$$;

create or replace function public.purchase_request_reassign_item(
  _item_id uuid,
  _target_role text,
  _actor_id uuid default auth.uid()
)
returns table (
  source_request_id uuid,
  target_request_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  item_row public.purchase_request_items%rowtype;
  request_row public.purchase_requests%rowtype;
  object_engineer_id uuid;
  sibling_request_id uuid;
begin
  if _target_role not in ('engineer', 'procurement_manager') then
    raise exception 'invalid target role';
  end if;

  select *
    into item_row
  from public.purchase_request_items pri
  where pri.id = _item_id;

  if not found then
    raise exception 'purchase request item not found';
  end if;

  select *
    into request_row
  from public.purchase_requests pr
  where pr.id = item_row.request_id;

  if not found then
    raise exception 'purchase request not found';
  end if;

  if not public.purchase_request_can_manage(request_row) then
    raise exception 'access denied to reassign item';
  end if;

  if request_row.request_kind = 'draft' then
    update public.purchase_request_items
    set assigned_role = _target_role
    where id = item_row.id;

    return query select request_row.id, request_row.id;
    return;
  end if;

  if request_row.request_kind <> 'final' or request_row.source <> 'warehouse_daily' or request_row.origin_request_id is null then
    raise exception 'item reassignment is supported only for final daily warehouse requests';
  end if;

  if coalesce(item_row.assigned_role, request_row.executor_role) = _target_role then
    return query select request_row.id, request_row.id;
    return;
  end if;

  select o.object_engineer_id
    into object_engineer_id
  from public.objects o
  where o.id = request_row.object_id;

  select pr.id
    into sibling_request_id
  from public.purchase_requests pr
  where pr.origin_request_id = request_row.origin_request_id
    and pr.request_kind = 'final'
    and pr.executor_role = _target_role
  order by pr.created_at desc
  limit 1;

  if sibling_request_id is null then
    insert into public.purchase_requests (
      object_id,
      status,
      source,
      request_kind,
      description,
      requested_by,
      assigned_to,
      executor_role,
      origin_request_id
    )
    values (
      request_row.object_id,
      'new',
      'warehouse_daily',
      'final',
      case
        when _target_role = 'engineer'
          then 'Итоговая заявка инженеру объекта после перераспределения позиции.'
        else 'Итоговая заявка менеджеру по закупкам после перераспределения позиции.'
      end,
      _actor_id,
      case when _target_role = 'engineer' then object_engineer_id else null end,
      _target_role,
      request_row.origin_request_id
    )
    returning id into sibling_request_id;
  end if;

  update public.purchase_request_items
  set request_id = sibling_request_id,
      assigned_role = _target_role,
      in_cart = false,
      cart_marked_at = null
  where id = item_row.id;

  if not exists (
    select 1
    from public.purchase_request_items pri
    where pri.request_id = request_row.id
  ) then
    update public.purchase_requests pr
    set status = 'cancelled'
    where pr.id = request_row.id;
  end if;

  return query select request_row.id, sibling_request_id;
end;
$$;

create or replace function public.purchase_request_toggle_item_cart(
  _item_id uuid,
  _in_cart boolean
)
returns public.purchase_request_items
language plpgsql
security definer
set search_path = public
as $$
declare
  item_row public.purchase_request_items%rowtype;
  request_row public.purchase_requests%rowtype;
begin
  select *
    into item_row
  from public.purchase_request_items pri
  where pri.id = _item_id;

  if not found then
    raise exception 'purchase request item not found';
  end if;

  select *
    into request_row
  from public.purchase_requests pr
  where pr.id = item_row.request_id;

  if not found then
    raise exception 'purchase request not found';
  end if;

  if not public.purchase_request_can_manage(request_row) then
    raise exception 'access denied to toggle item cart state';
  end if;

  update public.purchase_request_items pri
  set in_cart = _in_cart,
      cart_marked_at = case when _in_cart then now() else null end
  where pri.id = _item_id
  returning * into item_row;

  return item_row;
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
