-- Pause workflow and timeline support

alter table public.tasks
  add column if not exists resume_at timestamptz;

create index if not exists tasks_resume_at_idx on public.tasks (resume_at);

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
  restricted_fields_changed boolean;
  pause_payload_changed boolean;
begin
  role_name := public.current_role();

  if role_name is null then
    raise exception 'forbidden';
  end if;

  status_changed := new.status is distinct from old.status;
  assignee_changed := new.assigned_to is distinct from old.assigned_to;
  restricted_fields_changed :=
    new.title is distinct from old.title
    or coalesce(new.description, '') is distinct from coalesce(old.description, '')
    or new.object_id is distinct from old.object_id
    or new.priority is distinct from old.priority
    or new.created_by is distinct from old.created_by
    or coalesce(new.archived_at, 'epoch'::timestamptz) is distinct from coalesce(old.archived_at, 'epoch'::timestamptz);
  pause_payload_changed :=
    new.due_at is distinct from old.due_at
    or new.resume_at is distinct from old.resume_at;

  if public.is_superuser() then
    if status_changed and new.status = 'in_progress' and old.accepted_at is null and new.accepted_at is null then
      new.accepted_at := now();
    end if;
    if status_changed and new.status = 'done' and old.completed_at is null and new.completed_at is null then
      new.completed_at := now();
    end if;
    if status_changed and new.status <> 'paused' then
      new.resume_at := null;
    end if;
    return new;
  end if;

  if role_name = 'tech' then
    if restricted_fields_changed or assignee_changed then
      raise exception 'tech cannot modify task fields';
    end if;

    if status_changed and not public.can_change_status(old) then
      raise exception 'forbidden status change';
    end if;

    if pause_payload_changed then
      if not status_changed or new.status <> 'paused' or not public.can_change_status(old) then
        raise exception 'tech can change due/resume only during pause action';
      end if;
    end if;
  elsif role_name in ('chief', 'lead', 'engineer', 'object_engineer') then
    if role_name = 'object_engineer' and not public.is_object_engineer_for_object(new.object_id, auth.uid()) then
      raise exception 'object_engineer can update only tasks of own object';
    end if;

    if assignee_changed and not public.can_assign_task(new.assigned_to, new.object_id) then
      raise exception 'forbidden assignment';
    end if;

    if status_changed and not public.can_change_status(old) then
      raise exception 'forbidden status change';
    end if;
  else
    raise exception 'forbidden';
  end if;

  if status_changed and new.status = 'in_progress' and old.accepted_at is null and new.accepted_at is null then
    new.accepted_at := now();
  end if;

  if status_changed and new.status = 'done' and old.completed_at is null and new.completed_at is null then
    new.completed_at := now();
  end if;

  if status_changed and new.status <> 'paused' then
    new.resume_at := null;
  end if;

  return new;
end;
$$;

create or replace function public.pause_task(p_task_id uuid, p_reason text, p_resume_at timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task public.tasks%rowtype;
  v_reason text;
  v_now timestamptz;
  v_old_due_at timestamptz;
  v_new_due_at timestamptz;
  v_comment text;
begin
  if auth.uid() is null then
    raise exception 'unauthorized';
  end if;

  v_reason := btrim(coalesce(p_reason, ''));
  if char_length(v_reason) < 5 then
    raise exception 'pause reason must be at least 5 chars';
  end if;

  if p_resume_at is null or p_resume_at <= now() then
    raise exception 'resume_at must be in the future';
  end if;

  select *
  into v_task
  from public.tasks t
  where t.id = p_task_id
  for update;

  if not found then
    raise exception 'task not found';
  end if;

  if not (public.is_superuser() or public.can_change_status(v_task)) then
    raise exception 'forbidden';
  end if;

  v_now := now();
  v_old_due_at := v_task.due_at;
  v_new_due_at := v_task.due_at;

  if v_old_due_at is not null and v_old_due_at >= v_now then
    v_new_due_at := v_old_due_at + (p_resume_at - v_now);
  end if;

  update public.tasks
  set
    status = 'paused',
    resume_at = p_resume_at,
    due_at = v_new_due_at
  where id = p_task_id;

  v_comment := format(
    'Поставил задачу на паузу до %s. Причина: %s',
    to_char(p_resume_at, 'DD.MM.YYYY HH24:MI'),
    v_reason
  );

  insert into public.task_comments (task_id, author_id, body, client_msg_id)
  values (p_task_id, auth.uid(), v_comment, null);

  insert into public.audit_log (actor_id, action, entity_type, entity_id, meta)
  values (
    auth.uid(),
    'pause_task',
    'task',
    p_task_id,
    jsonb_build_object(
      'old_status', v_task.status,
      'new_status', 'paused',
      'old_due_at', v_old_due_at,
      'new_due_at', v_new_due_at,
      'resume_at', p_resume_at,
      'reason', v_reason
    )
  );

  return jsonb_build_object(
    'ok', true,
    'old_due_at', v_old_due_at,
    'new_due_at', v_new_due_at,
    'resume_at', p_resume_at
  );
end;
$$;
