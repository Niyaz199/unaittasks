create table if not exists public.object_rooms (
  id uuid primary key default gen_random_uuid(),
  object_id uuid not null references public.objects (id) on delete cascade,
  name text not null,
  floor text,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint object_rooms_object_id_name_key unique (object_id, name)
);

create index if not exists idx_object_rooms_object_id on public.object_rooms (object_id);

create or replace function public.ppr_has_object_access(_object_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  role_name text;
  uid uuid;
begin
  uid := auth.uid();
  role_name := public.ppr_current_role();

  if uid is null or role_name is null then
    return false;
  end if;

  if role_name in ('admin', 'chief') then
    return true;
  end if;

  if role_name not in ('lead', 'engineer', 'object_engineer') then
    return false;
  end if;

  return public.has_object_access(_object_id, uid);
end;
$$;

create or replace function public.can_read_object_room(_object_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  role_name text;
  uid uuid;
begin
  uid := auth.uid();
  role_name := public.current_role();

  if uid is null or role_name is null then
    return false;
  end if;

  if role_name in ('admin', 'chief') then
    return true;
  end if;

  if role_name not in ('lead', 'engineer', 'object_engineer') then
    return false;
  end if;

  return public.has_object_access(_object_id, uid);
end;
$$;

create or replace function public.can_manage_object_room(_object_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  role_name text;
  uid uuid;
begin
  uid := auth.uid();
  role_name := public.current_role();

  if uid is null or role_name is null then
    return false;
  end if;

  if role_name in ('admin', 'chief') then
    return true;
  end if;

  if role_name not in ('lead', 'object_engineer') then
    return false;
  end if;

  return public.has_object_access(_object_id, uid);
end;
$$;

alter table public.object_rooms enable row level security;

drop policy if exists "object_rooms_select_by_access" on public.object_rooms;
drop policy if exists "object_rooms_manage_by_scope" on public.object_rooms;

create policy "object_rooms_select_by_access"
  on public.object_rooms for select
  using (public.can_read_object_room(object_id));

create policy "object_rooms_manage_by_scope"
  on public.object_rooms for all
  using (public.can_manage_object_room(object_id))
  with check (public.can_manage_object_room(object_id));

do $$
begin
  if to_regclass('public.ppr_rooms') is not null then
    insert into public.object_rooms (id, object_id, name, floor, description, is_active, created_at)
    select r.id, r.object_id, r.name, r.floor, r.description, r.is_active, r.created_at
    from public.ppr_rooms r
    on conflict (id) do update
    set object_id = excluded.object_id,
        name = excluded.name,
        floor = excluded.floor,
        description = excluded.description,
        is_active = excluded.is_active,
        created_at = excluded.created_at;
  end if;
end;
$$;

alter table public.ppr_work_templates
  add column if not exists system_id uuid references public.ppr_systems (id) on delete cascade;

do $$
begin
  if to_regclass('public.ppr_subsystems') is not null
     and exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'ppr_work_templates'
         and column_name = 'subsystem_id'
     ) then
    update public.ppr_work_templates wt
    set system_id = ss.system_id
    from public.ppr_subsystems ss
    where wt.system_id is null
      and wt.subsystem_id = ss.id;
  end if;
end;
$$;

alter table public.ppr_work_templates
  alter column system_id set not null;

alter table public.ppr_work_templates
  drop constraint if exists ppr_work_templates_object_subsystem_name_key;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ppr_work_templates_object_system_name_key'
      and conrelid = 'public.ppr_work_templates'::regclass
  ) then
    alter table public.ppr_work_templates
      add constraint ppr_work_templates_object_system_name_key unique (object_id, system_id, name);
  end if;
end;
$$;

create index if not exists idx_ppr_work_templates_system_id on public.ppr_work_templates (system_id);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'ppr_equipment'
      and column_name = 'subsystem_id'
  ) then
    alter table public.ppr_equipment
      alter column subsystem_id drop not null;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'ppr_month_plan_items'
      and column_name = 'subsystem_id'
  ) then
    alter table public.ppr_month_plan_items
      alter column subsystem_id drop not null;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'ppr_tasks'
      and column_name = 'subsystem_id'
  ) then
    alter table public.ppr_tasks
      alter column subsystem_id drop not null;
  end if;
end;
$$;

alter table public.ppr_equipment
  drop constraint if exists ppr_equipment_room_id_fkey;

alter table public.ppr_equipment
  add constraint ppr_equipment_room_id_fkey
  foreign key (room_id) references public.object_rooms (id) on delete restrict;

create or replace function public.ppr_validate_equipment_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  system_object_id uuid;
  room_object_id uuid;
begin
  if tg_op = 'INSERT' and coalesce(btrim(new.inventory_no), '') = '' then
    new.inventory_no := public.ppr_generate_inventory_no(new.object_id);
  elsif tg_op = 'UPDATE' and coalesce(btrim(new.inventory_no), '') = '' then
    raise exception 'inventory_no is required';
  else
    new.inventory_no := btrim(new.inventory_no);
  end if;

  select s.object_id
    into system_object_id
  from public.ppr_systems s
  where s.id = new.system_id;

  if system_object_id is null then
    raise exception 'invalid ppr system';
  end if;

  select r.object_id
    into room_object_id
  from public.object_rooms r
  where r.id = new.room_id;

  if room_object_id is null then
    raise exception 'invalid object room';
  end if;

  if system_object_id <> new.object_id then
    raise exception 'ppr system must belong to equipment object';
  end if;

  if room_object_id <> new.object_id then
    raise exception 'object room must belong to equipment object';
  end if;

  return new;
end;
$$;

create or replace function public.ppr_validate_work_template_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  system_object_id uuid;
begin
  select s.object_id
    into system_object_id
  from public.ppr_systems s
  where s.id = new.system_id;

  if system_object_id is null then
    raise exception 'invalid ppr system';
  end if;

  if system_object_id <> new.object_id then
    raise exception 'ppr template system must belong to template object';
  end if;

  return new;
end;
$$;

create or replace function public.ppr_validate_equipment_work_assignment_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  equipment_row record;
  template_row record;
begin
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

  if equipment_row.object_id <> new.object_id or template_row.object_id <> new.object_id then
    raise exception 'ppr assignment object mismatch';
  end if;

  if equipment_row.system_id <> template_row.system_id then
    raise exception 'ppr assignment system mismatch';
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
