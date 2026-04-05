create or replace function public.ppr_carryover_plan_items(
  _date_from date,
  _date_to date,
  _run_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_date date;
  flagged_pending_items integer := 0;
  flagged_task_items integer := 0;
  flagged_tasks integer := 0;
begin
  if _date_from is null or _date_to is null then
    raise exception 'date range is required';
  end if;

  if _date_from > _date_to then
    raise exception 'date_from must be <= date_to';
  end if;

  target_date := _date_from;

  update public.ppr_month_plan_items mpi
  set status = 'carried_over',
      is_overdue = true
  where mpi.task_id is null
    and mpi.status in ('pending', 'carried_over')
    and mpi.planned_for < target_date
    and (mpi.status <> 'carried_over' or mpi.is_overdue is not true);

  get diagnostics flagged_pending_items = row_count;

  update public.ppr_tasks t
  set is_overdue = true
  where public.ppr_is_active_task_status(t.status)
    and t.planned_for < target_date
    and t.is_overdue is not true;

  get diagnostics flagged_tasks = row_count;

  update public.ppr_month_plan_items mpi
  set is_overdue = true
  from public.ppr_tasks t
  where t.id = mpi.task_id
    and public.ppr_is_active_task_status(t.status)
    and t.planned_for < target_date
    and mpi.status in ('materialized', 'carried_over')
    and mpi.is_overdue is not true;

  get diagnostics flagged_task_items = row_count;

  return jsonb_build_object(
    'run_id', _run_id,
    'date_from', _date_from,
    'date_to', _date_to,
    'target_date', target_date,
    'flagged_pending_items', flagged_pending_items,
    'flagged_task_items', flagged_task_items,
    'flagged_tasks', flagged_tasks
  );
end;
$$;
