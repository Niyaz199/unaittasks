-- Stock item card: descriptive fields + attachments (PDF/images) with Storage bucket

-- 1. Extra descriptive fields
alter table public.stock_items
  add column if not exists manufacturer text,
  add column if not exists model text,
  add column if not exists description text;

-- 2. Attachments table
create table if not exists public.stock_item_attachments (
  id uuid primary key default gen_random_uuid(),
  object_id uuid not null references public.objects (id) on delete cascade,
  stock_item_id uuid not null references public.stock_items (id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  uploaded_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  constraint stock_item_attachments_storage_path_key unique (storage_path),
  constraint stock_item_attachments_size_check check (size_bytes >= 0)
);

create index if not exists idx_stock_item_attachments_object_id
  on public.stock_item_attachments (object_id);
create index if not exists idx_stock_item_attachments_stock_item_id
  on public.stock_item_attachments (stock_item_id);
create index if not exists idx_stock_item_attachments_uploaded_by
  on public.stock_item_attachments (uploaded_by);

alter table public.stock_item_attachments enable row level security;

drop policy if exists "stock_item_attachments_select" on public.stock_item_attachments;
drop policy if exists "stock_item_attachments_insert" on public.stock_item_attachments;
drop policy if exists "stock_item_attachments_delete" on public.stock_item_attachments;

create policy "stock_item_attachments_select" on public.stock_item_attachments
  for select using (public.warehouse_can_read(object_id));

create policy "stock_item_attachments_insert" on public.stock_item_attachments
  for insert with check (public.warehouse_can_manage_catalog(object_id));

create policy "stock_item_attachments_delete" on public.stock_item_attachments
  for delete using (
    public.warehouse_can_manage_catalog(object_id)
    or uploaded_by = auth.uid()
  );

-- 3. Storage bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'stock-item-attachments',
  'stock-item-attachments',
  false,
  10485760,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf'
  ]
)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "stock_item_files_select" on storage.objects;
drop policy if exists "stock_item_files_insert" on storage.objects;
drop policy if exists "stock_item_files_delete" on storage.objects;

create policy "stock_item_files_select" on storage.objects
  for select using (
    bucket_id = 'stock-item-attachments'
    and auth.role() = 'authenticated'
    and exists (
      select 1
      from public.stock_item_attachments sa
      where sa.storage_path = name
        and public.warehouse_can_read(sa.object_id)
    )
  );

create policy "stock_item_files_insert" on storage.objects
  for insert with check (
    bucket_id = 'stock-item-attachments'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = 'items'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy "stock_item_files_delete" on storage.objects
  for delete using (
    bucket_id = 'stock-item-attachments'
    and auth.role() = 'authenticated'
    and exists (
      select 1
      from public.stock_item_attachments sa
      where sa.storage_path = name
        and (
          sa.uploaded_by = auth.uid()
          or public.warehouse_can_manage_catalog(sa.object_id)
        )
    )
  );
