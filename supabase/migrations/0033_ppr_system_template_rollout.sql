create index if not exists idx_ppr_work_templates_object_system_active
  on public.ppr_work_templates (object_id, system_id, is_active);

alter table public.ppr_month_plan_items
  drop constraint if exists ppr_month_plan_items_month_plan_assignment_due_key;

alter table public.ppr_month_plan_items
  drop column if exists assignment_id;

create index if not exists idx_ppr_month_plan_items_template_id
  on public.ppr_month_plan_items (template_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ppr_month_plan_items_month_plan_equipment_template_due_key'
      and conrelid = 'public.ppr_month_plan_items'::regclass
  ) then
    alter table public.ppr_month_plan_items
      add constraint ppr_month_plan_items_month_plan_equipment_template_due_key
      unique (month_plan_id, equipment_id, template_id, source_due_date);
  end if;
end;
$$;

alter table public.ppr_task_work_items
  drop constraint if exists ppr_task_work_items_task_assignment_key;

drop index if exists public.idx_ppr_task_work_items_assignment_id;

alter table public.ppr_task_work_items
  drop column if exists assignment_id;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ppr_task_work_items_task_template_key'
      and conrelid = 'public.ppr_task_work_items'::regclass
  ) then
    alter table public.ppr_task_work_items
      add constraint ppr_task_work_items_task_template_key
      unique (task_id, template_id);
  end if;
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
    group by mpi.object_id, mpi.system_id, mpi.equipment_id, mpi.planned_for, s.responsible_user_id
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
      order by mpi.template_id
    loop
      insert into public.ppr_task_work_items (
        object_id,
        task_id,
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
      on conflict (task_id, template_id) do nothing;

      get diagnostics affected_rows = row_count;
      if affected_rows > 0 then
        created_work_items := created_work_items + 1;
        next_sort_order := next_sort_order + 1;
      else
        update public.ppr_task_work_items twi
        set plan_item_id = item_row.id
        where twi.task_id = task_row.id
          and twi.template_id = item_row.template_id
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
