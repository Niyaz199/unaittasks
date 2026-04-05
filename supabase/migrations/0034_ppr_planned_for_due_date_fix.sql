create or replace function public.ppr_validate_month_plan_item_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  plan_row record;
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

  select e.object_id, e.system_id
    into equipment_row
  from public.ppr_equipment e
  where e.id = new.equipment_id;

  if equipment_row.object_id is null then
    raise exception 'invalid ppr equipment';
  end if;

  select wt.object_id, wt.system_id
    into template_row
  from public.ppr_work_templates wt
  where wt.id = new.template_id;

  if template_row.object_id is null then
    raise exception 'invalid ppr work template';
  end if;

  if new.object_id <> plan_row.object_id
     or new.system_id <> plan_row.system_id
     or new.object_id <> equipment_row.object_id
     or new.object_id <> template_row.object_id then
    raise exception 'ppr month plan item object or system mismatch';
  end if;

  if equipment_row.system_id <> new.system_id then
    raise exception 'ppr month plan item system mismatch';
  end if;

  if template_row.system_id <> new.system_id then
    raise exception 'ppr month plan item template system mismatch';
  end if;

  if new.planned_for is null then
    new.planned_for := public.ppr_plan_default_planned_for(plan_row.plan_month);
  end if;

  new.is_carried_over := new.status = 'carried_over';

  return new;
end;
$$;

update public.ppr_month_plan_items mpi
set planned_for = public.ppr_plan_default_planned_for(mp.plan_month),
    is_overdue = public.ppr_plan_default_planned_for(mp.plan_month) < current_date
from public.ppr_month_plans mp
where mp.id = mpi.month_plan_id
  and mpi.task_id is null
  and mpi.status in ('pending', 'carried_over')
  and mpi.source_due_date is not null
  and mpi.planned_for = mpi.source_due_date
  and mpi.planned_for <> public.ppr_plan_default_planned_for(mp.plan_month);
