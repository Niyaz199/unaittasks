-- PPR calendar and month plans

create table if not exists public.ppr_month_plans (
  id uuid primary key default gen_random_uuid(),
  object_id uuid not null references public.objects (id) on delete cascade,
  system_id uuid not null references public.ppr_systems (id) on delete cascade,
  plan_month date not null,
  generated_at timestamptz not null default now(),
  constraint ppr_month_plans_object_system_month_key unique (object_id, system_id, plan_month)
);

create table if not exists public.ppr_month_plan_items (
  id uuid primary key default gen_random_uuid(),
  object_id uuid not null references public.objects (id) on delete cascade,
  month_plan_id uuid not null references public.ppr_month_plans (id) on delete cascade,
  system_id uuid not null references public.ppr_systems (id) on delete cascade,
  subsystem_id uuid not null references public.ppr_subsystems (id) on delete cascade,
  equipment_id uuid not null references public.ppr_equipment (id) on delete cascade,
  assignment_id uuid not null references public.ppr_equipment_work_assignments (id) on delete cascade,
  template_id uuid not null references public.ppr_work_templates (id) on delete cascade,
  planned_for date not null,
  source_due_date date not null,
  is_overdue boolean not null default false,
  is_carried_over boolean not null default false,
  task_id uuid,
  status text not null default 'pending',
  constraint ppr_month_plan_items_month_plan_assignment_due_key unique (month_plan_id, assignment_id, source_due_date),
  constraint ppr_month_plan_items_status_check check (status in ('pending', 'materialized', 'carried_over', 'closed', 'cancelled'))
);

create index if not exists idx_ppr_month_plans_object_id on public.ppr_month_plans (object_id);
create index if not exists idx_ppr_month_plans_system_id on public.ppr_month_plans (system_id);
create index if not exists idx_ppr_month_plans_plan_month on public.ppr_month_plans (plan_month);

create index if not exists idx_ppr_month_plan_items_object_id on public.ppr_month_plan_items (object_id);
create index if not exists idx_ppr_month_plan_items_month_plan_id on public.ppr_month_plan_items (month_plan_id);
create index if not exists idx_ppr_month_plan_items_system_id on public.ppr_month_plan_items (system_id);
create index if not exists idx_ppr_month_plan_items_equipment_id on public.ppr_month_plan_items (equipment_id);
create index if not exists idx_ppr_month_plan_items_planned_for on public.ppr_month_plan_items (planned_for);
create index if not exists idx_ppr_month_plan_items_task_id on public.ppr_month_plan_items (task_id);

create or replace function public.ppr_plan_default_planned_for(_plan_month date)
returns date
language sql
immutable
as $$
  select date_trunc('month', _plan_month)::date
$$;

create or replace function public.ppr_can_manage_calendar(_system_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  role_name text;
  uid uuid;
  system_object_id uuid;
  system_responsible_user_id uuid;
begin
  uid := auth.uid();
  role_name := public.ppr_current_role();

  if uid is null or role_name is null then
    return false;
  end if;

  select s.object_id, s.responsible_user_id
    into system_object_id, system_responsible_user_id
  from public.ppr_systems s
  where s.id = _system_id;

  if system_object_id is null then
    return false;
  end if;

  if role_name in ('admin', 'chief') then
    return true;
  end if;

  if role_name in ('lead', 'object_engineer') then
    return public.ppr_has_object_access(system_object_id);
  end if;

  if role_name = 'engineer' then
    return system_responsible_user_id = uid;
  end if;

  return false;
end;
$$;

create or replace function public.ppr_validate_month_plan_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  system_object_id uuid;
begin
  new.plan_month := public.ppr_plan_default_planned_for(new.plan_month);

  select s.object_id
    into system_object_id
  from public.ppr_systems s
  where s.id = new.system_id;

  if system_object_id is null then
    raise exception 'invalid ppr system';
  end if;

  if system_object_id <> new.object_id then
    raise exception 'ppr month plan system must belong to plan object';
  end if;

  return new;
end;
$$;

create or replace function public.ppr_validate_month_plan_item_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  plan_row record;
  assignment_row record;
  equipment_row record;
  template_row record;
begin
  select mp.object_id, mp.system_id, mp.plan_month
    into plan_row
  from public.ppr_month_plans mp
  where mp.id = new.month_plan_id;

  if plan_row.object_id is null then
    raise exception 'invalid ppr month plan';
  end if;

  select a.object_id, a.equipment_id, a.template_id
    into assignment_row
  from public.ppr_equipment_work_assignments a
  where a.id = new.assignment_id;

  if assignment_row.object_id is null then
    raise exception 'invalid ppr assignment';
  end if;

  select e.object_id, e.system_id, e.subsystem_id
    into equipment_row
  from public.ppr_equipment e
  where e.id = new.equipment_id;

  if equipment_row.object_id is null then
    raise exception 'invalid ppr equipment';
  end if;

  select wt.object_id, wt.subsystem_id
    into template_row
  from public.ppr_work_templates wt
  where wt.id = new.template_id;

  if template_row.object_id is null then
    raise exception 'invalid ppr work template';
  end if;

  if new.object_id <> plan_row.object_id
     or new.system_id <> plan_row.system_id
     or new.object_id <> assignment_row.object_id
     or new.object_id <> equipment_row.object_id
     or new.object_id <> template_row.object_id then
    raise exception 'ppr month plan item object or system mismatch';
  end if;

  if assignment_row.equipment_id <> new.equipment_id then
    raise exception 'ppr month plan item equipment mismatch';
  end if;

  if assignment_row.template_id <> new.template_id then
    raise exception 'ppr month plan item template mismatch';
  end if;

  if equipment_row.system_id <> new.system_id then
    raise exception 'ppr month plan item system mismatch';
  end if;

  if equipment_row.subsystem_id <> new.subsystem_id then
    raise exception 'ppr month plan item subsystem mismatch';
  end if;

  if template_row.subsystem_id <> new.subsystem_id then
    raise exception 'ppr month plan item template subsystem mismatch';
  end if;

  if new.planned_for is null then
    new.planned_for := public.ppr_plan_default_planned_for(plan_row.plan_month);
  end if;

  new.is_carried_over := new.status = 'carried_over';

  return new;
end;
$$;

drop trigger if exists trg_ppr_validate_month_plan_scope on public.ppr_month_plans;
create trigger trg_ppr_validate_month_plan_scope
before insert or update on public.ppr_month_plans
for each row execute function public.ppr_validate_month_plan_scope();

drop trigger if exists trg_ppr_validate_month_plan_item_scope on public.ppr_month_plan_items;
create trigger trg_ppr_validate_month_plan_item_scope
before insert or update on public.ppr_month_plan_items
for each row execute function public.ppr_validate_month_plan_item_scope();

alter table public.ppr_month_plans enable row level security;
alter table public.ppr_month_plan_items enable row level security;

drop policy if exists "ppr_month_plans_select_calendar_scope" on public.ppr_month_plans;
drop policy if exists "ppr_month_plans_manage_calendar_scope" on public.ppr_month_plans;

create policy "ppr_month_plans_select_calendar_scope"
  on public.ppr_month_plans for select
  using (
    public.ppr_has_object_access(object_id)
    or public.ppr_can_manage_calendar(system_id)
  );

create policy "ppr_month_plans_manage_calendar_scope"
  on public.ppr_month_plans for all
  using (public.ppr_can_manage_calendar(system_id))
  with check (public.ppr_can_manage_calendar(system_id));

drop policy if exists "ppr_month_plan_items_select_calendar_scope" on public.ppr_month_plan_items;
drop policy if exists "ppr_month_plan_items_manage_calendar_scope" on public.ppr_month_plan_items;

create policy "ppr_month_plan_items_select_calendar_scope"
  on public.ppr_month_plan_items for select
  using (
    public.ppr_has_object_access(object_id)
    or public.ppr_can_manage_calendar(system_id)
  );

create policy "ppr_month_plan_items_manage_calendar_scope"
  on public.ppr_month_plan_items for all
  using (public.ppr_can_manage_calendar(system_id))
  with check (public.ppr_can_manage_calendar(system_id));
