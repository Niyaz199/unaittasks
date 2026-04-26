-- Link stock movements to PPR tasks (write-off on task close)

alter table public.stock_movements
  add column if not exists source_task_id uuid references public.ppr_tasks (id) on delete set null;

create index if not exists idx_stock_movements_source_task
  on public.stock_movements (source_task_id);
