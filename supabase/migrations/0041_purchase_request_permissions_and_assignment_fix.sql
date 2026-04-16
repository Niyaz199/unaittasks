-- Fix purchase request permissions for procurement manager
-- and assign daily warehouse requests to a real manager user.

create or replace function public.default_procurement_manager_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.id
  from public.profiles p
  where p.role = 'procurement_manager'
  order by p.created_at asc, p.id asc
  limit 1
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
    return _request.request_kind = 'final'
      and _request.executor_role = 'procurement_manager'
      and _request.assigned_to = auth.uid();
  end if;

  if role_name not in ('admin', 'chief', 'lead', 'object_engineer') then
    return false;
  end if;

  return public.has_object_access(_request.object_id);
end;
$$;

update public.purchase_requests pr
set assigned_to = public.default_procurement_manager_id()
where pr.request_kind = 'final'
  and pr.executor_role = 'procurement_manager'
  and pr.assigned_to is null
  and public.default_procurement_manager_id() is not null;

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
      and si.current_qty < si.min_qty
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
    si.min_qty - si.current_qty,
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
    and si.current_qty < si.min_qty
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
  procurement_manager_id uuid;
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
      and pri.assigned_role = 'procurement_manager'
  ) then
    procurement_manager_id := public.default_procurement_manager_id();
    if procurement_manager_id is null then
      raise exception 'procurement manager is not configured';
    end if;
  end if;

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
      procurement_manager_id,
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
  procurement_manager_id uuid;
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

  if _target_role = 'procurement_manager' then
    procurement_manager_id := public.default_procurement_manager_id();
    if procurement_manager_id is null then
      raise exception 'procurement manager is not configured';
    end if;
  end if;

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
      case
        when _target_role = 'engineer' then object_engineer_id
        else procurement_manager_id
      end,
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

do $$
begin
  perform pg_notify('pgrst', 'reload schema');
  perform pg_notify('pgrst', 'reload config');
exception
  when others then
    null;
end;
$$;
