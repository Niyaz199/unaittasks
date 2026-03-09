-- Auto-archive done tasks and write audit log
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
