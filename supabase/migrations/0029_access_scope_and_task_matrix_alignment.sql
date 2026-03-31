create or replace function public.has_object_access(_object_id uuid, _user_id uuid default auth.uid())
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  role_name text;
begin
  if _object_id is null or _user_id is null then
    return false;
  end if;

  select p.role
    into role_name
  from public.profiles p
  where p.id = _user_id;

  if role_name is null then
    return false;
  end if;

  if role_name in ('admin', 'chief', 'lead') then
    return true;
  end if;

  if role_name = 'object_engineer' then
    return exists (
      select 1
      from public.objects o
      where o.id = _object_id
        and o.object_engineer_id = _user_id
    );
  end if;

  if role_name in ('engineer', 'tech') then
    return exists (
      select 1
      from public.user_objects uo
      where uo.object_id = _object_id
        and uo.user_id = _user_id
    );
  end if;

  return false;
end;
$$;

create or replace function public.can_read_task(_task public.tasks)
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
  role_name := public.current_role();

  if uid is null or role_name is null then
    return false;
  end if;

  if role_name in ('admin', 'chief') then
    return true;
  end if;

  if role_name in ('lead', 'engineer') then
    return _task.created_by = uid or _task.assigned_to = uid or public.is_task_member(_task.id, uid);
  end if;

  if role_name = 'object_engineer' then
    return public.has_object_access(_task.object_id, uid)
      or _task.created_by = uid
      or _task.assigned_to = uid
      or public.is_task_member(_task.id, uid);
  end if;

  if role_name = 'tech' then
    return _task.assigned_to = uid or public.is_task_member(_task.id, uid);
  end if;

  return false;
end;
$$;

create or replace function public.can_work_on_task(_task public.tasks)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_read_task(_task)
$$;

create or replace function public.can_full_edit_task(_task public.tasks)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  role_name text;
begin
  role_name := public.current_role();

  if role_name is null then
    return false;
  end if;

  if role_name in ('admin', 'chief') then
    return true;
  end if;

  if role_name = 'lead' then
    return public.can_read_task(_task);
  end if;

  return false;
end;
$$;

create or replace function public.can_manage_task_team(_task public.tasks)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and public.current_role() in ('admin', 'chief', 'lead', 'engineer', 'object_engineer')
    and public.can_read_task(_task)
$$;

create or replace function public.can_link_task_member(_task public.tasks, _user_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  role_name text;
  target_role_name text;
begin
  role_name := public.current_role();
  target_role_name := public.target_role(_user_id);

  if role_name is null or target_role_name is null then
    return false;
  end if;

  if not public.can_manage_task_team(_task) then
    return false;
  end if;

  if not public.can_assign_to_role(role_name, target_role_name) then
    return false;
  end if;

  return public.has_object_access(_task.object_id, _user_id);
end;
$$;

create or replace function public.can_change_status(_task public.tasks)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_work_on_task(_task)
$$;

create or replace function public.can_update_task(_task public.tasks)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_full_edit_task(_task) or public.can_work_on_task(_task)
$$;

create or replace function public.can_delete_task(_task public.tasks)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_full_edit_task(_task)
$$;

create or replace function public.enforce_task_update_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  role_name text;
  status_changed boolean;
  assignee_changed boolean;
  object_changed boolean;
  restricted_fields_changed boolean;
  archive_changed boolean;
begin
  role_name := public.current_role();

  if role_name is null then
    raise exception 'forbidden';
  end if;

  status_changed := new.status is distinct from old.status;
  assignee_changed := new.assigned_to is distinct from old.assigned_to;
  object_changed := new.object_id is distinct from old.object_id;
  archive_changed := coalesce(new.archived_at, 'epoch'::timestamptz) is distinct from coalesce(old.archived_at, 'epoch'::timestamptz);
  restricted_fields_changed :=
    new.title is distinct from old.title
    or coalesce(new.description, '') is distinct from coalesce(old.description, '')
    or object_changed
    or new.priority is distinct from old.priority
    or coalesce(new.due_at, 'epoch'::timestamptz) is distinct from coalesce(old.due_at, 'epoch'::timestamptz)
    or new.created_by is distinct from old.created_by;

  if not public.can_update_task(old) then
    raise exception 'forbidden';
  end if;

  if not public.can_full_edit_task(old) then
    if restricted_fields_changed or assignee_changed or archive_changed then
      raise exception 'work edit only';
    end if;
  else
    if (assignee_changed or object_changed) and not public.can_assign_task(new.assigned_to, new.object_id) then
      raise exception 'forbidden assignment';
    end if;

    if archive_changed and role_name not in ('admin', 'chief') then
      raise exception 'forbidden archive';
    end if;
  end if;

  if status_changed and not public.can_change_status(old) then
    raise exception 'forbidden status change';
  end if;

  if status_changed and new.status = 'in_progress' and old.accepted_at is null and new.accepted_at is null then
    new.accepted_at := now();
  end if;

  if status_changed and new.status = 'done' and old.completed_at is null and new.completed_at is null then
    new.completed_at := now();
  end if;

  return new;
end;
$$;

drop policy if exists "tasks_update_by_matrix" on public.tasks;
create policy "tasks_update_by_matrix"
  on public.tasks for update
  using (public.can_update_task(tasks))
  with check (public.can_update_task(tasks));

drop policy if exists "tasks_delete_manage_roles" on public.tasks;
create policy "tasks_delete_manage_roles"
  on public.tasks for delete
  using (public.can_delete_task(tasks));

drop policy if exists "task_comments_insert_if_task_visible" on public.task_comments;
create policy "task_comments_insert_if_task_visible"
  on public.task_comments for insert
  with check (
    author_id = auth.uid()
    and exists (
      select 1
      from public.tasks t
      where t.id = task_comments.task_id
        and public.can_work_on_task(t)
    )
  );

drop policy if exists "task_team_members_insert_if_manage_task" on public.task_team_members;
create policy "task_team_members_insert_if_manage_task"
  on public.task_team_members for insert
  with check (
    exists (
      select 1
      from public.tasks t
      where t.id = task_team_members.task_id
        and public.can_link_task_member(t, task_team_members.user_id)
    )
  );

drop policy if exists "attachments_insert" on public.task_attachments;
create policy "attachments_insert" on public.task_attachments
  for insert with check (
    auth.uid() = uploaded_by
    and exists (
      select 1
      from public.tasks t
      where t.id = task_attachments.task_id
        and public.can_work_on_task(t)
    )
  );

drop policy if exists "audit_log_select_timeline_access" on public.audit_log;
create policy "audit_log_select_timeline_access"
  on public.audit_log for select
  using (
    public.is_superuser()
    or public.current_role() = 'chief'
    or (
      public.current_role() in ('lead', 'engineer', 'object_engineer', 'tech')
      and entity_type = 'task'
      and exists (
        select 1
        from public.tasks t
        where t.id = audit_log.entity_id
          and public.can_read_task(t)
      )
    )
  );

create or replace function public.ppr_can_manage_object_scope(_object_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  role_name text;
begin
  role_name := public.ppr_current_role();

  if role_name is null then
    return false;
  end if;

  if role_name in ('admin', 'chief') then
    return true;
  end if;

  if role_name not in ('lead', 'engineer', 'object_engineer') then
    return false;
  end if;

  return public.ppr_has_object_access(_object_id);
end;
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
begin
  uid := auth.uid();
  role_name := public.ppr_current_role();

  if uid is null or role_name is null then
    return false;
  end if;

  select s.object_id
    into system_object_id
  from public.ppr_systems s
  where s.id = _system_id;

  if system_object_id is null then
    return false;
  end if;

  if role_name in ('admin', 'chief') then
    return true;
  end if;

  if role_name not in ('lead', 'engineer', 'object_engineer') then
    return false;
  end if;

  return public.ppr_has_object_access(system_object_id);
end;
$$;

create or replace function public.ppr_can_read_task(_task public.ppr_tasks)
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

  if role_name in ('lead', 'engineer', 'object_engineer') then
    return public.ppr_has_object_access(_task.object_id);
  end if;

  if role_name = 'tech' then
    return _task.assignee_id = uid;
  end if;

  return false;
end;
$$;

create or replace function public.ppr_can_assign_executor(_task public.ppr_tasks)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  role_name text;
begin
  role_name := public.ppr_current_role();

  if role_name is null then
    return false;
  end if;

  if role_name in ('admin', 'chief') then
    return true;
  end if;

  if role_name not in ('lead', 'engineer', 'object_engineer') then
    return false;
  end if;

  return public.ppr_has_object_access(_task.object_id);
end;
$$;

create or replace function public.ppr_can_close_task(_task public.ppr_tasks)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  role_name text;
begin
  role_name := public.ppr_current_role();

  if role_name is null then
    return false;
  end if;

  if role_name in ('admin', 'chief') then
    return true;
  end if;

  if role_name not in ('lead', 'engineer', 'object_engineer') then
    return false;
  end if;

  return public.ppr_has_object_access(_task.object_id);
end;
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

  if not public.has_object_access(new.object_id, new.responsible_user_id) then
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

drop policy if exists "objects_manage_admin_chief" on public.objects;
drop policy if exists "objects_manage_by_management_roles" on public.objects;
create policy "objects_manage_by_management_roles"
  on public.objects for all
  using (public.current_role() in ('admin', 'chief', 'lead'))
  with check (public.current_role() in ('admin', 'chief', 'lead'));

create or replace function public.can_manage_user_role(_actor_role text, _target_role text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if _actor_role is null or _target_role is null then
    return false;
  end if;

  if _actor_role in ('admin', 'chief', 'lead') then
    return _target_role in ('admin', 'chief', 'lead', 'engineer', 'object_engineer', 'tech');
  end if;

  if _actor_role = 'engineer' then
    return _target_role = 'tech';
  end if;

  if _actor_role = 'object_engineer' then
    return _target_role in ('engineer', 'tech');
  end if;

  return false;
end;
$$;

create or replace function public.user_role_can_have_object_links(_target_role text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select _target_role in ('engineer', 'tech')
$$;

create or replace function public.can_manage_user_target(_target_user_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  actor_role text;
  target_role_name text;
begin
  actor_role := public.current_role();
  target_role_name := public.target_role(_target_user_id);

  if auth.uid() is null or _target_user_id is null or actor_role is null or target_role_name is null then
    return false;
  end if;

  if _target_user_id = auth.uid() then
    return false;
  end if;

  return public.can_manage_user_role(actor_role, target_role_name);
end;
$$;

create or replace function public.can_insert_user_profile(_target_role text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and public.can_manage_user_role(public.current_role(), _target_role)
$$;

create or replace function public.can_update_user_profile(_target_user_id uuid, _target_role text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_manage_user_target(_target_user_id)
    and public.can_manage_user_role(public.current_role(), _target_role)
$$;

create or replace function public.can_read_user_object_link(_target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and (_target_user_id = auth.uid() or public.can_manage_user_target(_target_user_id))
$$;

create or replace function public.can_write_user_object_link(_target_user_id uuid, _object_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  target_role_name text;
begin
  target_role_name := public.target_role(_target_user_id);

  if target_role_name is null then
    return false;
  end if;

  if not public.can_manage_user_target(_target_user_id) then
    return false;
  end if;

  if not public.user_role_can_have_object_links(target_role_name) then
    return false;
  end if;

  return public.has_object_access(_object_id, auth.uid());
end;
$$;

create or replace function public.can_delete_user_object_link(_target_user_id uuid, _object_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_manage_user_target(_target_user_id)
    and public.has_object_access(_object_id, auth.uid())
$$;

drop policy if exists "profiles_insert_manage_roles" on public.profiles;
drop policy if exists "profiles_update_manage_roles" on public.profiles;
drop policy if exists "profiles_delete_manage_roles" on public.profiles;

create policy "profiles_insert_manage_roles"
  on public.profiles for insert
  with check (public.can_insert_user_profile(role));

create policy "profiles_update_manage_roles"
  on public.profiles for update
  using (public.can_manage_user_target(id))
  with check (public.can_update_user_profile(id, role));

create policy "profiles_delete_manage_roles"
  on public.profiles for delete
  using (public.can_manage_user_target(id));

drop policy if exists "user_objects_select_admin_or_self" on public.user_objects;
drop policy if exists "user_objects_manage_admin_chief" on public.user_objects;
drop policy if exists "user_objects_select_by_management_scope" on public.user_objects;
drop policy if exists "user_objects_insert_by_management_scope" on public.user_objects;
drop policy if exists "user_objects_delete_by_management_scope" on public.user_objects;

create policy "user_objects_select_by_management_scope"
  on public.user_objects for select
  using (public.can_read_user_object_link(user_id));

create policy "user_objects_insert_by_management_scope"
  on public.user_objects for insert
  with check (public.can_write_user_object_link(user_id, object_id));

create policy "user_objects_delete_by_management_scope"
  on public.user_objects for delete
  using (public.can_delete_user_object_link(user_id, object_id));
