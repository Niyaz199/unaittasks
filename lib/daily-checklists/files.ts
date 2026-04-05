import type { SupabaseClient } from "@supabase/supabase-js";

export const DAILY_CHECKLIST_ATTACHMENT_BUCKET = "daily-checklist-attachments";
export const DAILY_CHECKLIST_ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const DAILY_CHECKLIST_MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
export const DAILY_CHECKLIST_MAX_FILES_PER_UPLOAD = 5;

export function validateDailyChecklistAttachmentFile(file: File): string | null {
  if (!(DAILY_CHECKLIST_ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
    return `Неподдерживаемый тип файла «${file.name}». Разрешены только JPEG, PNG, WebP.`;
  }
  if (file.size > DAILY_CHECKLIST_MAX_FILE_SIZE_BYTES) {
    return `Файл «${file.name}» превышает лимит 5 MB.`;
  }
  return null;
}

export function buildDailyChecklistAttachmentPath(userId: string, itemRunId: string, fileName: string) {
  const ext = fileName.split(".").pop() ?? "jpg";
  const unique = crypto.randomUUID();
  return `${userId}/${itemRunId}/${unique}.${ext}`;
}

export type UploadedDailyChecklistAttachmentMeta = {
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
};

export async function uploadDailyChecklistAttachmentFile(
  supabase: SupabaseClient,
  file: File,
  userId: string,
  itemRunId: string
): Promise<UploadedDailyChecklistAttachmentMeta> {
  const storagePath = buildDailyChecklistAttachmentPath(userId, itemRunId, file.name);
  const { error } = await supabase.storage
    .from(DAILY_CHECKLIST_ATTACHMENT_BUCKET)
    .upload(storagePath, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(`Ошибка загрузки «${file.name}»: ${error.message}`);

  return {
    storage_path: storagePath,
    file_name: file.name,
    mime_type: file.type,
    size_bytes: file.size,
  };
}

export async function getDailyChecklistSignedUrls(supabase: SupabaseClient, paths: string[]) {
  if (!paths.length) return {} as Record<string, string>;
  const { data, error } = await supabase.storage
    .from(DAILY_CHECKLIST_ATTACHMENT_BUCKET)
    .createSignedUrls(paths, 3600);
  if (error || !data) return {};

  const result: Record<string, string> = {};
  for (const item of data) {
    if (item.path != null && item.signedUrl) {
      result[item.path] = item.signedUrl;
    }
  }
  return result;
}
