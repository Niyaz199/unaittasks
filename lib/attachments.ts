import type { SupabaseClient } from "@supabase/supabase-js";

export const ATTACHMENT_BUCKET = "task-attachments";
export const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_FILES_PER_UPLOAD = 5;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

export function validateAttachmentFile(file: File): string | null {
  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
    return `Неподдерживаемый тип файла «${file.name}». Разрешены только JPEG, PNG, WebP.`;
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `Файл «${file.name}» превышает лимит 5 MB.`;
  }
  return null;
}

export function buildStoragePath(userId: string, taskId: string, fileName: string): string {
  const ext = fileName.split(".").pop() ?? "jpg";
  const unique = crypto.randomUUID();
  return `${userId}/${taskId}/${unique}.${ext}`;
}

export type UploadedAttachmentMeta = {
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
};

/** Загрузить один файл в Storage. Возвращает storage_path или бросает ошибку. */
export async function uploadAttachmentFile(
  supabase: SupabaseClient,
  file: File,
  userId: string,
  taskId: string
): Promise<UploadedAttachmentMeta> {
  const storagePath = buildStoragePath(userId, taskId, file.name);
  const { error } = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .upload(storagePath, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(`Ошибка загрузки «${file.name}»: ${error.message}`);
  return {
    storage_path: storagePath,
    file_name: file.name,
    mime_type: file.type,
    size_bytes: file.size
  };
}

/** Сохранить метаданные вложения в таблицу task_attachments. */
export async function saveAttachmentMeta(
  supabase: SupabaseClient,
  meta: UploadedAttachmentMeta & { task_id: string; comment_id?: string | null; uploaded_by: string }
) {
  const { error } = await supabase.from("task_attachments").insert({
    task_id: meta.task_id,
    comment_id: meta.comment_id ?? null,
    storage_path: meta.storage_path,
    file_name: meta.file_name,
    mime_type: meta.mime_type,
    size_bytes: meta.size_bytes,
    uploaded_by: meta.uploaded_by
  });
  if (error) throw new Error(`Ошибка сохранения метаданных: ${error.message}`);
}

/** Получить signed URL для одного файла (1 час). */
export async function getSignedUrl(supabase: SupabaseClient, storagePath: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .createSignedUrl(storagePath, 3600);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/** Получить signed URLs для массива вложений. */
export async function getSignedUrls(
  supabase: SupabaseClient,
  paths: string[]
): Promise<Record<string, string>> {
  if (!paths.length) return {};
  const { data, error } = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .createSignedUrls(paths, 3600);
  if (error || !data) return {};
  const result: Record<string, string> = {};
  for (const item of data) {
    if (item.path != null && item.signedUrl) result[item.path] = item.signedUrl;
  }
  return result;
}
