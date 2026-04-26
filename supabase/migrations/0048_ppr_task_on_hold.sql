-- PPR task pause (on_hold) lifecycle + optional link to a purchase request
-- that triggered the pause.

alter table public.ppr_tasks
  add column if not exists hold_reason text,
  add column if not exists held_at timestamptz,
  add column if not exists held_by uuid references public.profiles (id),
  add column if not exists hold_purchase_request_id uuid references public.purchase_requests (id) on delete set null;

-- Extend allowed statuses with 'on_hold'.
alter table public.ppr_tasks
  drop constraint if exists ppr_tasks_status_check;

alter table public.ppr_tasks
  add constraint ppr_tasks_status_check
  check (status in ('new', 'in_progress', 'on_hold', 'done', 'closed', 'cancelled'));

-- Guard rails for hold state coherence.
alter table public.ppr_tasks
  drop constraint if exists ppr_tasks_on_hold_fields_check;

alter table public.ppr_tasks
  add constraint ppr_tasks_on_hold_fields_check check (
    (status = 'on_hold' and held_at is not null and held_by is not null and hold_reason is not null and btrim(hold_reason) <> '')
    or (status <> 'on_hold' and held_at is null and held_by is null and hold_reason is null and hold_purchase_request_id is null)
  );

-- Make 'on_hold' count as an active status so the uniqueness index still
-- blocks duplicate tasks per (equipment_id, planned_for) and calendar views
-- keep the task visible.
create or replace function public.ppr_is_active_task_status(_status text)
returns boolean
language sql
immutable
as $$
  select _status in ('new', 'in_progress', 'on_hold', 'done')
$$;

drop index if exists public.ppr_tasks_active_equipment_planned_for_uidx;
create unique index if not exists ppr_tasks_active_equipment_planned_for_uidx
  on public.ppr_tasks (equipment_id, planned_for)
  where status in ('new', 'in_progress', 'on_hold', 'done');

-- Keep prepare trigger in sync: clear hold_* when leaving on_hold,
-- fill held_at when entering on_hold, and keep existing cancellation rules.
create or replace function public.ppr_prepare_task_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.ppr_validate_task_aggregation(new.equipment_id, new.planned_for, case when tg_op = 'UPDATE' then new.id else null end) then
    raise exception 'duplicate active ppr task for equipment and planned_for';
  end if;

  if new.cancelled_by is not null and new.cancelled_at is null then
    new.cancelled_at := now();
  end if;

  if new.status = 'cancelled' and new.cancelled_at is null then
    raise exception 'cancelled_at is required for cancelled ppr task';
  end if;

  if new.status = 'done' and new.completed_at is null then
    new.completed_at := now();
  end if;

  if new.status = 'closed' and new.closed_at is null then
    new.closed_at := now();
  end if;

  if new.status <> 'cancelled' then
    new.cancelled_at := null;
    new.cancelled_by := null;
  end if;

  if new.status = 'on_hold' then
    if new.held_at is null then
      new.held_at := now();
    end if;
  else
    new.held_at := null;
    new.held_by := null;
    new.hold_reason := null;
    new.hold_purchase_request_id := null;
  end if;

  return new;
end;
$$;

create index if not exists idx_ppr_tasks_hold_purchase_request
  on public.ppr_tasks (hold_purchase_request_id)
  where hold_purchase_request_id is not null;
