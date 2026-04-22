-- Stock item ↔ PPR template links and monthly PPR procurement request support

-- ────────────────────────────────────────────────────────────────────────────
-- 1. stock_item_ppr_templates: связь ТМЦ с шаблонами ППР
-- ────────────────────────────────────────────────────────────────────────────

create table if not exists public.stock_item_ppr_templates (
  id uuid primary key default gen_random_uuid(),
  object_id uuid not null references public.objects (id) on delete cascade,
  stock_item_id uuid not null references public.stock_items (id) on delete cascade,
  template_id uuid not null references public.ppr_work_templates (id) on delete cascade,
  required_qty numeric(12,3) not null default 1,
  created_at timestamptz not null default now(),
  constraint stock_item_ppr_templates_item_template_key unique (stock_item_id, template_id),
  constraint stock_item_ppr_templates_required_qty_check check (required_qty > 0)
);

create index if not exists idx_stock_item_ppr_templates_object_id
  on public.stock_item_ppr_templates (object_id);

create index if not exists idx_stock_item_ppr_templates_stock_item_id
  on public.stock_item_ppr_templates (stock_item_id);

create index if not exists idx_stock_item_ppr_templates_template_id
  on public.stock_item_ppr_templates (template_id);

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Триггеры scope-валидации и синхронизации
-- ────────────────────────────────────────────────────────────────────────────

create or replace function public.stock_validate_item_ppr_template_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  item_object_id uuid;
  template_object_id uuid;
begin
  select si.object_id
    into item_object_id
  from public.stock_items si
  where si.id = new.stock_item_id;

  if item_object_id is null then
    raise exception 'invalid stock item';
  end if;

  if item_object_id <> new.object_id then
    raise exception 'stock item ppr template link must stay inside one object';
  end if;

  select ps.object_id
    into template_object_id
  from public.ppr_work_templates wt
  join public.ppr_systems ps on ps.id = wt.system_id
  where wt.id = new.template_id;

  if template_object_id is null then
    raise exception 'invalid ppr work template';
  end if;

  if template_object_id <> new.object_id then
    raise exception 'ppr template must belong to the same object as the stock item';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_stock_validate_item_ppr_template_scope on public.stock_item_ppr_templates;
create trigger trg_stock_validate_item_ppr_template_scope
before insert or update on public.stock_item_ppr_templates
for each row execute function public.stock_validate_item_ppr_template_scope();

-- Sync object_id when stock item moves to a different object (rare but safe)
create or replace function public.stock_sync_item_ppr_template_object_refs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.object_id = old.object_id then
    return new;
  end if;

  update public.stock_item_ppr_templates
  set object_id = new.object_id
  where stock_item_id = new.id;

  return new;
end;
$$;

drop trigger if exists trg_stock_sync_item_ppr_template_object_refs on public.stock_items;
create trigger trg_stock_sync_item_ppr_template_object_refs
after update of object_id on public.stock_items
for each row execute function public.stock_sync_item_ppr_template_object_refs();

-- ────────────────────────────────────────────────────────────────────────────
-- 3. RLS для stock_item_ppr_templates
-- ────────────────────────────────────────────────────────────────────────────

alter table public.stock_item_ppr_templates enable row level security;

drop policy if exists "stock_item_ppr_templates_select_by_object_access" on public.stock_item_ppr_templates;
drop policy if exists "stock_item_ppr_templates_manage_by_object_scope" on public.stock_item_ppr_templates;

create policy "stock_item_ppr_templates_select_by_object_access"
  on public.stock_item_ppr_templates for select
  using (public.warehouse_can_read(object_id));

create policy "stock_item_ppr_templates_manage_by_object_scope"
  on public.stock_item_ppr_templates for all
  using (public.warehouse_can_manage_catalog(object_id))
  with check (public.warehouse_can_manage_catalog(object_id));

-- ────────────────────────────────────────────────────────────────────────────
-- 4. purchase_requests: добавить источник ppr
-- ────────────────────────────────────────────────────────────────────────────

alter table public.purchase_requests
  drop constraint if exists purchase_requests_source_check;

alter table public.purchase_requests
  add constraint purchase_requests_source_check
  check (source in ('manual', 'warehouse_daily', 'ppr'));

-- Колонка для хранения месяца ППР (для идемпотентности)
alter table public.purchase_requests
  add column if not exists ppr_plan_month date;

create index if not exists idx_purchase_requests_ppr_plan_month
  on public.purchase_requests (ppr_plan_month)
  where ppr_plan_month is not null;

-- ────────────────────────────────────────────────────────────────────────────
-- 5. purchase_request_items: ppr_system_id для группировки в UI
-- ────────────────────────────────────────────────────────────────────────────

alter table public.purchase_request_items
  add column if not exists ppr_system_id uuid references public.ppr_systems (id) on delete set null;

create index if not exists idx_purchase_request_items_ppr_system_id
  on public.purchase_request_items (ppr_system_id)
  where ppr_system_id is not null;

-- ────────────────────────────────────────────────────────────────────────────
-- 6. Обновить purchase_request_can_read: закупщик видит ppr-заявки
-- ────────────────────────────────────────────────────────────────────────────

-- (Функция уже возвращает true для procurement_manager, нет изменений нужно)

do $$
begin
  perform pg_notify('pgrst', 'reload schema');
  perform pg_notify('pgrst', 'reload config');
exception
  when others then
    null;
end;
$$;
