create or replace function public.ppr_can_manage_structure(_object_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.ppr_can_manage_object_scope(_object_id)
$$;

create or replace function public.ppr_can_read_system_groups()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and public.ppr_current_role() in ('admin', 'chief', 'lead', 'engineer', 'object_engineer')
$$;

create or replace function public.ppr_can_manage_system_groups()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and public.ppr_current_role() in ('admin', 'chief', 'lead')
$$;

create or replace function public.ppr_validate_system_responsible()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  responsible_role text;
begin
  if new.responsible_user_id is null then
    return new;
  end if;

  select p.role
    into responsible_role
  from public.profiles p
  where p.id = new.responsible_user_id;

  if responsible_role is null or responsible_role not in ('lead', 'engineer', 'object_engineer') then
    raise exception 'invalid ppr system responsible role';
  end if;

  if not exists (
    select 1
    from public.user_objects uo
    where uo.user_id = new.responsible_user_id
      and uo.object_id = new.object_id
  ) then
    raise exception 'ppr system responsible must have access to object';
  end if;

  return new;
end;
$$;

create or replace function public.ppr_can_execute_task(_task public.ppr_tasks)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid;
  role_name text;
begin
  uid := auth.uid();
  role_name := public.ppr_current_role();

  if uid is null or role_name is null then
    return false;
  end if;

  if role_name in ('admin', 'chief') then
    return true;
  end if;

  if role_name in ('lead', 'object_engineer') then
    return _task.assignee_id = uid and public.ppr_has_object_access(_task.object_id);
  end if;

  if role_name = 'engineer' then
    return _task.responsible_user_id = uid or _task.assignee_id = uid;
  end if;

  if role_name = 'tech' then
    return _task.assignee_id = uid;
  end if;

  return false;
end;
$$;

create or replace function public.ppr_can_insert_task_comment(
  _task_id uuid,
  _object_id uuid,
  _author_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() is not null
    and _author_id = auth.uid()
    and exists (
      select 1
      from public.ppr_tasks t
      where t.id = _task_id
        and t.object_id = _object_id
        and public.ppr_can_execute_task(t)
    )
$$;

create or replace function public.ppr_can_insert_task_attachment(
  _task_id uuid,
  _object_id uuid,
  _comment_id uuid,
  _uploaded_by uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() is not null
    and _uploaded_by = auth.uid()
    and exists (
      select 1
      from public.ppr_tasks t
      where t.id = _task_id
        and t.object_id = _object_id
        and public.ppr_can_execute_task(t)
        and (
          _comment_id is null
          or exists (
            select 1
            from public.ppr_task_comments c
            where c.id = _comment_id
              and c.task_id = _task_id
              and c.object_id = t.object_id
          )
        )
    )
$$;

create or replace function public.ppr_resolve_qr_token(_token text)
returns table (
  id uuid,
  object_id uuid,
  equipment_id uuid,
  qr_token text,
  is_active boolean,
  generated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select q.id, q.object_id, q.equipment_id, q.qr_token, q.is_active, q.generated_at
  from public.ppr_equipment_qr_codes q
  where auth.uid() is not null
    and public.ppr_current_role() in ('admin', 'chief', 'lead', 'engineer', 'object_engineer', 'tech')
    and q.qr_token = _token
    and q.is_active = true
  limit 1
$$;

drop policy if exists "ppr_system_groups_select_authenticated" on public.ppr_system_groups;
drop policy if exists "ppr_system_groups_manage_roles" on public.ppr_system_groups;

create policy "ppr_system_groups_select_authenticated"
  on public.ppr_system_groups for select
  using (public.ppr_can_read_system_groups());

create policy "ppr_system_groups_manage_roles"
  on public.ppr_system_groups for all
  using (public.ppr_can_manage_system_groups())
  with check (public.ppr_can_manage_system_groups());

drop policy if exists "ppr_systems_select_by_object_access" on public.ppr_systems;
drop policy if exists "ppr_systems_manage_by_object_scope" on public.ppr_systems;

create policy "ppr_systems_select_by_object_access"
  on public.ppr_systems for select
  using (public.ppr_has_object_access(object_id));

create policy "ppr_systems_manage_by_object_scope"
  on public.ppr_systems for all
  using (public.ppr_can_manage_structure(object_id))
  with check (public.ppr_can_manage_structure(object_id));

drop policy if exists "ppr_subsystems_select_by_object_access" on public.ppr_subsystems;
drop policy if exists "ppr_subsystems_manage_by_object_scope" on public.ppr_subsystems;

create policy "ppr_subsystems_select_by_object_access"
  on public.ppr_subsystems for select
  using (public.ppr_has_object_access(object_id));

create policy "ppr_subsystems_manage_by_object_scope"
  on public.ppr_subsystems for all
  using (public.ppr_can_manage_structure(object_id))
  with check (public.ppr_can_manage_structure(object_id));

drop policy if exists "ppr_rooms_select_by_object_access" on public.ppr_rooms;
drop policy if exists "ppr_rooms_manage_by_object_scope" on public.ppr_rooms;

create policy "ppr_rooms_select_by_object_access"
  on public.ppr_rooms for select
  using (public.ppr_has_object_access(object_id));

create policy "ppr_rooms_manage_by_object_scope"
  on public.ppr_rooms for all
  using (public.ppr_can_manage_structure(object_id))
  with check (public.ppr_can_manage_structure(object_id));

drop policy if exists "ppr_equipment_select_by_object_access" on public.ppr_equipment;
drop policy if exists "ppr_equipment_manage_by_object_scope" on public.ppr_equipment;

create policy "ppr_equipment_select_by_object_access"
  on public.ppr_equipment for select
  using (public.ppr_has_object_access(object_id));

create policy "ppr_equipment_manage_by_object_scope"
  on public.ppr_equipment for all
  using (public.ppr_can_manage_structure(object_id))
  with check (public.ppr_can_manage_structure(object_id));

drop policy if exists "ppr_equipment_qr_codes_select_by_object_access" on public.ppr_equipment_qr_codes;
drop policy if exists "ppr_equipment_qr_codes_manage_by_object_scope" on public.ppr_equipment_qr_codes;

create policy "ppr_equipment_qr_codes_select_by_object_access"
  on public.ppr_equipment_qr_codes for select
  using (public.ppr_has_object_access(object_id));

create policy "ppr_equipment_qr_codes_manage_by_object_scope"
  on public.ppr_equipment_qr_codes for all
  using (public.ppr_can_manage_structure(object_id))
  with check (public.ppr_can_manage_structure(object_id));

drop policy if exists "ppr_equipment_attachments_select_by_object_access" on public.ppr_equipment_attachments;
drop policy if exists "ppr_equipment_attachments_manage_by_object_scope" on public.ppr_equipment_attachments;

create policy "ppr_equipment_attachments_select_by_object_access"
  on public.ppr_equipment_attachments for select
  using (public.ppr_has_object_access(object_id));

create policy "ppr_equipment_attachments_manage_by_object_scope"
  on public.ppr_equipment_attachments for all
  using (public.ppr_can_manage_structure(object_id))
  with check (public.ppr_can_manage_structure(object_id));

drop policy if exists "ppr_work_templates_select_by_object_access" on public.ppr_work_templates;
drop policy if exists "ppr_work_templates_manage_by_object_scope" on public.ppr_work_templates;

create policy "ppr_work_templates_select_by_object_access"
  on public.ppr_work_templates for select
  using (public.ppr_has_object_access(object_id));

create policy "ppr_work_templates_manage_by_object_scope"
  on public.ppr_work_templates for all
  using (public.ppr_can_manage_templates(object_id))
  with check (public.ppr_can_manage_templates(object_id));

drop policy if exists "ppr_work_checklist_items_select_by_object_access" on public.ppr_work_checklist_items;
drop policy if exists "ppr_work_checklist_items_manage_by_object_scope" on public.ppr_work_checklist_items;

create policy "ppr_work_checklist_items_select_by_object_access"
  on public.ppr_work_checklist_items for select
  using (public.ppr_has_object_access(object_id));

create policy "ppr_work_checklist_items_manage_by_object_scope"
  on public.ppr_work_checklist_items for all
  using (public.ppr_can_manage_templates(object_id))
  with check (public.ppr_can_manage_templates(object_id));

drop policy if exists "ppr_work_template_attachments_select_by_object_access" on public.ppr_work_template_attachments;
drop policy if exists "ppr_work_template_attachments_manage_by_object_scope" on public.ppr_work_template_attachments;

create policy "ppr_work_template_attachments_select_by_object_access"
  on public.ppr_work_template_attachments for select
  using (public.ppr_has_object_access(object_id));

create policy "ppr_work_template_attachments_manage_by_object_scope"
  on public.ppr_work_template_attachments for all
  using (public.ppr_can_manage_templates(object_id))
  with check (public.ppr_can_manage_templates(object_id));

drop policy if exists "ppr_equipment_work_assignments_select_by_object_access" on public.ppr_equipment_work_assignments;
drop policy if exists "ppr_equipment_work_assignments_manage_by_object_scope" on public.ppr_equipment_work_assignments;

create policy "ppr_equipment_work_assignments_select_by_object_access"
  on public.ppr_equipment_work_assignments for select
  using (public.ppr_has_object_access(object_id));

create policy "ppr_equipment_work_assignments_manage_by_object_scope"
  on public.ppr_equipment_work_assignments for all
  using (public.ppr_can_manage_assignments(object_id))
  with check (public.ppr_can_manage_assignments(object_id));

drop policy if exists "ppr_month_plans_select_calendar_scope" on public.ppr_month_plans;
drop policy if exists "ppr_month_plans_manage_calendar_scope" on public.ppr_month_plans;

create policy "ppr_month_plans_select_calendar_scope"
  on public.ppr_month_plans for select
  using (public.ppr_can_manage_calendar(system_id));

create policy "ppr_month_plans_manage_calendar_scope"
  on public.ppr_month_plans for all
  using (public.ppr_can_manage_calendar(system_id))
  with check (public.ppr_can_manage_calendar(system_id));

drop policy if exists "ppr_month_plan_items_select_calendar_scope" on public.ppr_month_plan_items;
drop policy if exists "ppr_month_plan_items_manage_calendar_scope" on public.ppr_month_plan_items;

create policy "ppr_month_plan_items_select_calendar_scope"
  on public.ppr_month_plan_items for select
  using (public.ppr_can_manage_calendar(system_id));

create policy "ppr_month_plan_items_manage_calendar_scope"
  on public.ppr_month_plan_items for all
  using (public.ppr_can_manage_calendar(system_id))
  with check (public.ppr_can_manage_calendar(system_id));

drop policy if exists "ppr_tasks_select_readable" on public.ppr_tasks;
drop policy if exists "ppr_tasks_update_allowed" on public.ppr_tasks;

create policy "ppr_tasks_select_readable"
  on public.ppr_tasks for select
  using (public.ppr_can_read_task(ppr_tasks));

create policy "ppr_tasks_update_allowed"
  on public.ppr_tasks for update
  using (
    public.ppr_can_assign_executor(ppr_tasks)
    or public.ppr_can_close_task(ppr_tasks)
    or public.ppr_can_execute_task(ppr_tasks)
  )
  with check (
    public.ppr_can_assign_executor(ppr_tasks)
    or public.ppr_can_close_task(ppr_tasks)
    or public.ppr_can_execute_task(ppr_tasks)
  );

drop policy if exists "ppr_task_work_items_select_by_parent_task" on public.ppr_task_work_items;

create policy "ppr_task_work_items_select_by_parent_task"
  on public.ppr_task_work_items for select
  using (
    exists (
      select 1
      from public.ppr_tasks t
      where t.id = task_id
        and public.ppr_can_read_task(t)
    )
  );

drop policy if exists "ppr_task_comments_select_by_parent_task" on public.ppr_task_comments;
drop policy if exists "ppr_task_comments_insert_by_parent_task" on public.ppr_task_comments;

create policy "ppr_task_comments_select_by_parent_task"
  on public.ppr_task_comments for select
  using (
    exists (
      select 1
      from public.ppr_tasks t
      where t.id = task_id
        and public.ppr_can_read_task(t)
    )
  );

create policy "ppr_task_comments_insert_by_parent_task"
  on public.ppr_task_comments for insert
  with check (
    public.ppr_can_insert_task_comment(task_id, object_id, author_id)
  );

drop policy if exists "ppr_task_attachments_select_by_parent_task" on public.ppr_task_attachments;
drop policy if exists "ppr_task_attachments_insert_by_parent_task" on public.ppr_task_attachments;
drop policy if exists "ppr_task_attachments_delete_manage_roles" on public.ppr_task_attachments;

create policy "ppr_task_attachments_select_by_parent_task"
  on public.ppr_task_attachments for select
  using (
    exists (
      select 1
      from public.ppr_tasks t
      where t.id = task_id
        and public.ppr_can_read_task(t)
    )
  );

create policy "ppr_task_attachments_insert_by_parent_task"
  on public.ppr_task_attachments for insert
  with check (
    public.ppr_can_insert_task_attachment(task_id, object_id, comment_id, uploaded_by)
  );

create policy "ppr_task_attachments_delete_manage_roles"
  on public.ppr_task_attachments for delete
  using (
    uploaded_by = auth.uid()
    or exists (
      select 1
      from public.ppr_tasks t
      where t.id = task_id
        and (public.ppr_can_close_task(t) or public.ppr_can_assign_executor(t))
    )
  );
