-- Cron-функция archive_done_tasks работает без JWT (запускается по расписанию через service_role).
-- Триггер enforce_task_update_rules (миграция 0029) при null auth.uid() кидает 'forbidden',
-- из-за чего автоархив падает с P0001. Лечим через локальный GUC-флаг сессии: системная
-- функция выставляет app.bypass_task_rules='1' на свою транзакцию, триггер его уважает.

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
  -- Системные функции (cron, миграции) выставляют этот флаг локально в транзакции
  -- и пропускают всю проверку прав. На обычные запросы это не влияет.
  if coalesce(current_setting('app.bypass_task_rules', true), '0') = '1' then
    return new;
  end if;

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

-- Системная функция автоархива: выставляет флаг и проводит UPDATE.
create or replace function public.archive_done_tasks(hours_threshold int default 36)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  affected int;
  v_now timestamptz;
begin
  -- Локальный флаг — действует только в текущей транзакции, на параллельные сессии не влияет.
  perform set_config('app.bypass_task_rules', '1', true);

  v_now := now();

  with archived as (
    update public.tasks
    set archived_at = v_now
    where status = 'done'
      and archived_at is null
      and completed_at is not null
      and completed_at <= v_now - make_interval(hours => hours_threshold)
    returning id, completed_at
  ), logged as (
    insert into public.audit_log (actor_id, action, entity_type, entity_id, meta)
    select
      null,
      'task_archived_auto',
      'task',
      id,
      jsonb_build_object('completed_at', completed_at, 'archived_at', v_now)
    from archived
  )
  select count(*) into affected from archived;

  return affected;
end;
$$;
