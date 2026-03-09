-- Keep pause transition strict: only from in_progress
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

  if v_task.status <> 'in_progress' then
    raise exception 'only in_progress tasks can be paused';
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
