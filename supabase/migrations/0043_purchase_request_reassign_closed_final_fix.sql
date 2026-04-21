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

  if request_row.status in ('fulfilled', 'cancelled') then
    raise exception 'closed final request cannot be changed';
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
    and pr.status in ('new', 'in_progress')
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
