-- Link purchase requests to specific PPR tasks.
-- The 'ppr' source was already allowed by migration 0044; here we only add the task FK + index.

alter table public.purchase_requests
  add column if not exists source_task_id uuid references public.ppr_tasks (id) on delete set null;

create index if not exists idx_purchase_requests_source_task
  on public.purchase_requests (source_task_id);
