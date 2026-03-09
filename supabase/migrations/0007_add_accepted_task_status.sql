-- Add accepted task status without changing existing rows
alter table public.tasks
  drop constraint if exists tasks_status_check;

alter table public.tasks
  add constraint tasks_status_check
  check (status in ('new', 'accepted', 'in_progress', 'paused', 'done'));
