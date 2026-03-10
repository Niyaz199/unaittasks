-- 0009_task_attachments.sql
-- Поддержка фото-вложений в задачах и комментариях

-- ============================================================
-- 1. Storage bucket для фото вложений
-- ============================================================
-- Bucket создаётся через Supabase Dashboard или CLI:
--   supabase storage create task-attachments --public=false
-- Здесь только политики доступа через storage.objects

-- ============================================================
-- 2. Таблица метаданных вложений
-- ============================================================
create table if not exists public.task_attachments (
  id             uuid        primary key default gen_random_uuid(),
  task_id        uuid        not null references public.tasks(id) on delete cascade,
  comment_id     uuid        references public.task_comments(id) on delete cascade,
  storage_path   text        not null,
  file_name      text        not null,
  mime_type      text        not null,
  size_bytes     bigint      not null,
  -- NOT NULL убран: при удалении профиля поле обнуляется (ON DELETE SET NULL)
  uploaded_by    uuid        references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  -- Каркас под будущее автоудаление через 30 дней:
  -- cron/Edge Function сможет фильтровать по этому полю и удалять файлы.
  -- Фактическое удаление сейчас НЕ запускается — поле только заполняется.
  cleanup_after  timestamptz not null default (now() + interval '30 days'),
  deleted_at     timestamptz -- мягкое удаление (пока не используется)
);

-- Индексы для типовых выборок
create index if not exists idx_task_attachments_task_id    on public.task_attachments(task_id);
create index if not exists idx_task_attachments_comment_id on public.task_attachments(comment_id);
create index if not exists idx_task_attachments_cleanup    on public.task_attachments(cleanup_after) where deleted_at is null;

-- ============================================================
-- 3. RLS на таблицу метаданных
-- ============================================================
alter table public.task_attachments enable row level security;

-- Читать метаданные может тот, кто имеет доступ к задаче
create policy "attachments_select" on public.task_attachments
  for select using (
    exists (
      select 1 from public.tasks t
      where t.id = task_attachments.task_id
        and public.can_read_task(t)
    )
  );

-- Вставлять может аутентифицированный пользователь, имеющий доступ к задаче
create policy "attachments_insert" on public.task_attachments
  for insert with check (
    auth.uid() = uploaded_by
    and exists (
      select 1 from public.tasks t
      where t.id = task_attachments.task_id
        and public.can_read_task(t)
    )
  );

-- Удалять может загрузивший или admin/chief
create policy "attachments_delete" on public.task_attachments
  for delete using (
    auth.uid() = uploaded_by
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'chief')
    )
  );

-- ============================================================
-- 4. RLS для Supabase Storage bucket "task-attachments"
-- ============================================================
-- Политики применяются к таблице storage.objects.
-- Bucket "task-attachments" должен быть создан вручную (не публичный).

-- SELECT: скачать файл может тот, кто видит соответствующую задачу
create policy "storage_attachments_select" on storage.objects
  for select using (
    bucket_id = 'task-attachments'
    and auth.role() = 'authenticated'
    and exists (
      select 1
      from public.task_attachments ta
      join public.tasks t on t.id = ta.task_id
      where ta.storage_path = name
        and ta.deleted_at is null
        and public.can_read_task(t)
    )
  );

-- INSERT: загружать может аутентифицированный пользователь;
-- путь обязан начинаться с его user_id (структура: {userId}/{taskId}/{uuid}.{ext})
create policy "storage_attachments_insert" on storage.objects
  for insert with check (
    bucket_id = 'task-attachments'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- DELETE: удалять может загрузивший или admin/chief
create policy "storage_attachments_delete" on storage.objects
  for delete using (
    bucket_id = 'task-attachments'
    and auth.role() = 'authenticated'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from public.profiles p
        where p.id = auth.uid()
          and p.role in ('admin', 'chief')
      )
    )
  );
