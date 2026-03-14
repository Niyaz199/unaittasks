create or replace function public.ppr_ensure_month_plan(
  _object_id uuid,
  _system_id uuid,
  _plan_month date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  month_plan_id uuid;
begin
  insert into public.ppr_month_plans (object_id, system_id, plan_month)
  values (_object_id, _system_id, date_trunc('month', _plan_month)::date)
  on conflict (object_id, system_id, plan_month) do update
    set plan_month = excluded.plan_month
  returning id into month_plan_id;

  return month_plan_id;
end;
$$;

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
  moved_pending_items integer := 0;
  moved_task_items integer := 0;
  moved_tasks integer := 0;
  skipped_task_conflicts integer := 0;
  target_month_plan_id uuid;
  affected_rows integer := 0;
  item_row record;
  task_row record;
begin
  if _date_from is null or _date_to is null then
    raise exception 'date range is required';
  end if;

  if _date_from > _date_to then
    raise exception 'date_from must be <= date_to';
  end if;

  target_date := _date_from;

  for item_row in
    select mpi.id, mpi.object_id, mpi.system_id
    from public.ppr_month_plan_items mpi
    where mpi.task_id is null
      and mpi.status in ('pending', 'carried_over')
      and mpi.planned_for < target_date
  loop
    target_month_plan_id := public.ppr_ensure_month_plan(item_row.object_id, item_row.system_id, target_date);

    update public.ppr_month_plan_items mpi
    set month_plan_id = target_month_plan_id,
        planned_for = target_date,
        status = 'carried_over',
        is_carried_over = true,
        is_overdue = true
    where mpi.id = item_row.id
      and mpi.task_id is null
      and mpi.status in ('pending', 'carried_over')
      and mpi.planned_for < target_date;

    get diagnostics affected_rows = row_count;
    moved_pending_items := moved_pending_items + affected_rows;
  end loop;

  for task_row in
    select t.id, t.object_id, t.system_id, t.equipment_id
    from public.ppr_tasks t
    where public.ppr_is_active_task_status(t.status)
      and t.planned_for < target_date
      and exists (
        select 1
        from public.ppr_month_plan_items mpi
        where mpi.task_id = t.id
          and mpi.status in ('materialized', 'carried_over')
      )
  loop
    if exists (
      select 1
      from public.ppr_tasks tx
      where tx.id <> task_row.id
        and tx.equipment_id = task_row.equipment_id
        and tx.planned_for = target_date
        and public.ppr_is_active_task_status(tx.status)
    ) then
      skipped_task_conflicts := skipped_task_conflicts + 1;
      continue;
    end if;

    update public.ppr_tasks t
    set planned_for = target_date,
        is_rescheduled = true,
        is_overdue = true
    where t.id = task_row.id
      and public.ppr_is_active_task_status(t.status)
      and t.planned_for < target_date;

    get diagnostics affected_rows = row_count;
    if affected_rows = 0 then
      continue;
    end if;

    moved_tasks := moved_tasks + 1;
    target_month_plan_id := public.ppr_ensure_month_plan(task_row.object_id, task_row.system_id, target_date);

    update public.ppr_month_plan_items mpi
    set month_plan_id = target_month_plan_id,
        planned_for = target_date,
        status = 'carried_over',
        is_carried_over = true,
        is_overdue = true
    where mpi.task_id = task_row.id
      and mpi.status in ('materialized', 'carried_over')
      and mpi.planned_for < target_date;

    get diagnostics affected_rows = row_count;
    moved_task_items := moved_task_items + affected_rows;
  end loop;

  return jsonb_build_object(
    'run_id', _run_id,
    'date_from', _date_from,
    'date_to', _date_to,
    'target_date', target_date,
    'moved_pending_items', moved_pending_items,
    'moved_task_items', moved_task_items,
    'moved_tasks', moved_tasks,
    'skipped_task_conflicts', skipped_task_conflicts
  );
end;
$$;

create or replace function public.ppr_materialize_plan_items(
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
  group_row record;
  item_row record;
  task_row public.ppr_tasks%rowtype;
  created_tasks integer := 0;
  linked_plan_items integer := 0;
  created_work_items integer := 0;
  affected_rows integer := 0;
  next_sort_order integer := 0;
begin
  if _date_from is null or _date_to is null then
    raise exception 'date range is required';
  end if;

  if _date_from > _date_to then
    raise exception 'date_from must be <= date_to';
  end if;

  for group_row in
    select
      mpi.object_id,
      mpi.system_id,
      mpi.subsystem_id,
      mpi.equipment_id,
      mpi.planned_for,
      s.responsible_user_id,
      bool_or(mpi.is_overdue) as has_overdue,
      bool_or(mpi.is_carried_over) as has_carried_over
    from public.ppr_month_plan_items mpi
    join public.ppr_systems s on s.id = mpi.system_id
    where mpi.status in ('pending', 'carried_over')
      and mpi.task_id is null
      and mpi.planned_for >= _date_from
      and mpi.planned_for <= _date_to
    group by mpi.object_id, mpi.system_id, mpi.subsystem_id, mpi.equipment_id, mpi.planned_for, s.responsible_user_id
    order by mpi.planned_for, mpi.equipment_id
  loop
    if group_row.responsible_user_id is null then
      raise exception 'ppr system % has no responsible_user_id for materialization', group_row.system_id;
    end if;

    select *
      into task_row
    from public.ppr_tasks t
    where t.equipment_id = group_row.equipment_id
      and t.planned_for = group_row.planned_for
      and public.ppr_is_active_task_status(t.status)
    limit 1;

    if task_row.id is null then
      begin
        insert into public.ppr_tasks (
          object_id,
          system_id,
          subsystem_id,
          equipment_id,
          responsible_user_id,
          planned_for,
          status,
          is_overdue,
          is_rescheduled
        )
        values (
          group_row.object_id,
          group_row.system_id,
          group_row.subsystem_id,
          group_row.equipment_id,
          group_row.responsible_user_id,
          group_row.planned_for,
          'new',
          group_row.has_overdue,
          group_row.has_carried_over
        )
        returning * into task_row;

        created_tasks := created_tasks + 1;
      exception
        when unique_violation then
          select *
            into task_row
          from public.ppr_tasks t
          where t.equipment_id = group_row.equipment_id
            and t.planned_for = group_row.planned_for
            and public.ppr_is_active_task_status(t.status)
          limit 1;
      end;
    end if;

    select coalesce(max(twi.sort_order), 0)
      into next_sort_order
    from public.ppr_task_work_items twi
    where twi.task_id = task_row.id;

    for item_row in
      select
        mpi.id,
        mpi.object_id,
        mpi.assignment_id,
        mpi.template_id,
        wt.name as template_name,
        wt.description as template_description,
        wt.methodology as template_methodology,
        wt.norm_hours as template_norm_hours
      from public.ppr_month_plan_items mpi
      join public.ppr_work_templates wt on wt.id = mpi.template_id
      where mpi.object_id = group_row.object_id
        and mpi.equipment_id = group_row.equipment_id
        and mpi.planned_for = group_row.planned_for
        and mpi.status in ('pending', 'carried_over')
        and mpi.task_id is null
      order by mpi.assignment_id
    loop
      insert into public.ppr_task_work_items (
        object_id,
        task_id,
        assignment_id,
        template_id,
        plan_item_id,
        title_snapshot,
        description_snapshot,
        methodology_snapshot,
        checklist_snapshot,
        norm_hours_snapshot,
        sort_order
      )
      values (
        item_row.object_id,
        task_row.id,
        item_row.assignment_id,
        item_row.template_id,
        item_row.id,
        item_row.template_name,
        item_row.template_description,
        item_row.template_methodology,
        coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'sort_order', ci.sort_order,
                'title', ci.title,
                'description', ci.description
              )
              order by ci.sort_order
            )
            from public.ppr_work_checklist_items ci
            where ci.template_id = item_row.template_id
          ),
          '[]'::jsonb
        ),
        item_row.template_norm_hours,
        next_sort_order + 1
      )
      on conflict (task_id, assignment_id) do nothing;

      get diagnostics affected_rows = row_count;
      if affected_rows > 0 then
        created_work_items := created_work_items + 1;
        next_sort_order := next_sort_order + 1;
      else
        update public.ppr_task_work_items twi
        set plan_item_id = item_row.id
        where twi.task_id = task_row.id
          and twi.assignment_id = item_row.assignment_id
          and twi.plan_item_id is null;
      end if;

      update public.ppr_month_plan_items mpi
      set task_id = task_row.id,
          status = 'materialized'
      where mpi.id = item_row.id
        and mpi.task_id is null;

      get diagnostics affected_rows = row_count;
      linked_plan_items := linked_plan_items + affected_rows;
    end loop;
  end loop;

  return jsonb_build_object(
    'run_id', _run_id,
    'date_from', _date_from,
    'date_to', _date_to,
    'created_tasks', created_tasks,
    'linked_plan_items', linked_plan_items,
    'created_work_items', created_work_items
  );
end;
$$;

create or replace function public.ppr_sync_plan_item_statuses(
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
  closed_count integer := 0;
  cancelled_count integer := 0;
begin
  if _date_from is null or _date_to is null then
    raise exception 'date range is required';
  end if;

  if _date_from > _date_to then
    raise exception 'date_from must be <= date_to';
  end if;

  update public.ppr_month_plan_items mpi
  set status = 'closed'
  from public.ppr_tasks t
  where t.id = mpi.task_id
    and t.status = 'closed'
    and mpi.status <> 'closed'
    and (
      mpi.planned_for between _date_from and _date_to
      or t.planned_for between _date_from and _date_to
    );

  get diagnostics closed_count = row_count;

  update public.ppr_month_plan_items mpi
  set status = 'cancelled'
  from public.ppr_tasks t
  where t.id = mpi.task_id
    and t.status = 'cancelled'
    and mpi.status <> 'cancelled'
    and (
      mpi.planned_for between _date_from and _date_to
      or t.planned_for between _date_from and _date_to
    );

  get diagnostics cancelled_count = row_count;

  return jsonb_build_object(
    'run_id', _run_id,
    'date_from', _date_from,
    'date_to', _date_to,
    'closed_count', closed_count,
    'cancelled_count', cancelled_count
  );
end;
$$;
