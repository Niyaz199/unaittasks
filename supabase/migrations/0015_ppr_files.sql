-- PPR storage bucket and storage policies

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ppr-files',
  'ppr-files',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "ppr_files_select" on storage.objects;
drop policy if exists "ppr_files_insert" on storage.objects;
drop policy if exists "ppr_files_delete" on storage.objects;

create policy "ppr_files_select" on storage.objects
  for select using (
    bucket_id = 'ppr-files'
    and auth.role() = 'authenticated'
    and (
      exists (
        select 1
        from public.ppr_equipment_attachments ea
        where ea.storage_path = name
          and public.ppr_has_object_access(ea.object_id)
      )
      or exists (
        select 1
        from public.ppr_work_template_attachments ta
        where ta.storage_path = name
          and public.ppr_has_object_access(ta.object_id)
      )
      or exists (
        select 1
        from public.ppr_task_attachments pa
        join public.ppr_tasks t on t.id = pa.task_id
        where pa.storage_path = name
          and public.ppr_can_read_task(t)
      )
    )
  );

create policy "ppr_files_insert" on storage.objects
  for insert with check (
    bucket_id = 'ppr-files'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] in ('equipment', 'templates', 'tasks')
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy "ppr_files_delete" on storage.objects
  for delete using (
    bucket_id = 'ppr-files'
    and auth.role() = 'authenticated'
    and (
      exists (
        select 1
        from public.ppr_equipment_attachments ea
        where ea.storage_path = name
          and (
            ea.uploaded_by = auth.uid()
            or public.ppr_can_manage_object_scope(ea.object_id)
          )
      )
      or exists (
        select 1
        from public.ppr_work_template_attachments ta
        where ta.storage_path = name
          and (
            ta.uploaded_by = auth.uid()
            or public.ppr_can_manage_templates(ta.object_id)
          )
      )
      or exists (
        select 1
        from public.ppr_task_attachments pa
        join public.ppr_tasks t on t.id = pa.task_id
        where pa.storage_path = name
          and (
            pa.uploaded_by = auth.uid()
            or public.ppr_can_close_task(t)
            or public.ppr_can_assign_executor(t)
          )
      )
    )
  );
