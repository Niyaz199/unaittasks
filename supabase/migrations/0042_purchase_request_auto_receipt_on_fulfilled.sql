create or replace function public.purchase_request_mark_fulfilled_and_receive(
  _request_id uuid,
  _actor_id uuid default auth.uid()
)
returns table (
  received_items integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  request_row public.purchase_requests%rowtype;
  item_row record;
  resolved_location_id uuid;
  receipt_count integer := 0;
begin
  select *
    into request_row
  from public.purchase_requests pr
  where pr.id = _request_id;

  if not found then
    raise exception 'purchase request not found';
  end if;

  if request_row.request_kind = 'draft' then
    raise exception 'draft request cannot be fulfilled';
  end if;

  if not public.purchase_request_can_manage(request_row) then
    raise exception 'access denied to fulfill request';
  end if;

  if exists (
    select 1
    from public.stock_movements sm
    where sm.note = format('Автооприходование по заявке на закупку %s', request_row.id)
  ) then
    return query select 0;
    return;
  end if;

  for item_row in
    select
      pri.id,
      pri.object_id,
      pri.stock_item_id,
      pri.title,
      pri.quantity_requested,
      pri.storage_location_id as snapshot_location_id,
      si.storage_location_id as current_location_id
    from public.purchase_request_items pri
    left join public.stock_items si on si.id = pri.stock_item_id
    where pri.request_id = request_row.id
      and pri.stock_item_id is not null
  loop
    if item_row.quantity_requested is null or item_row.quantity_requested <= 0 then
      raise exception 'invalid quantity_requested for purchase request item %', item_row.id;
    end if;

    resolved_location_id := coalesce(item_row.snapshot_location_id, item_row.current_location_id);
    if resolved_location_id is null then
      raise exception 'Не удалось оприходовать позицию "%" — у ТМЦ не указано место хранения', item_row.title;
    end if;

    insert into public.stock_movements (
      object_id,
      item_id,
      location_id,
      movement_type,
      quantity,
      note,
      actor_id
    )
    values (
      item_row.object_id,
      item_row.stock_item_id,
      resolved_location_id,
      'receipt',
      item_row.quantity_requested,
      format('Автооприходование по заявке на закупку %s', request_row.id),
      _actor_id
    );

    receipt_count := receipt_count + 1;
  end loop;

  update public.purchase_requests pr
  set status = 'fulfilled'
  where pr.id = request_row.id;

  return query select receipt_count;
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
