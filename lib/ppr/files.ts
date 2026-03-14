import type { SupabaseClient } from "@supabase/supabase-js";

export const PPR_ATTACHMENT_BUCKET = "ppr-files";
export const PPR_ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const PPR_MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
export const PPR_MAX_FILES_PER_UPLOAD = 5;

export function validatePprAttachmentFile(file: File): string | null {
  if (!(PPR_ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
    return `Неподдерживаемый тип файла «${file.name}». Разрешены только JPEG, PNG, WebP.`;
  }
  if (file.size > PPR_MAX_FILE_SIZE_BYTES) {
    return `Файл «${file.name}» превышает лимит 5 MB.`;
  }
  return null;
}

export function buildPprTaskAttachmentPath(userId: string, taskId: string, fileName: string) {
  const ext = fileName.split(".").pop() ?? "jpg";
  const unique = crypto.randomUUID();
  return `tasks/${userId}/${taskId}/${unique}.${ext}`;
}

export type UploadedPprAttachmentMeta = {
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
};

export async function uploadPprTaskAttachmentFile(
  supabase: SupabaseClient,
  file: File,
  userId: string,
  taskId: string
): Promise<UploadedPprAttachmentMeta> {
  const storagePath = buildPprTaskAttachmentPath(userId, taskId, file.name);
  const { error } = await supabase.storage
    .from(PPR_ATTACHMENT_BUCKET)
    .upload(storagePath, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(`Ошибка загрузки «${file.name}»: ${error.message}`);

  return {
    storage_path: storagePath,
    file_name: file.name,
    mime_type: file.type,
    size_bytes: file.size,
  };
}

export async function getPprSignedUrls(supabase: SupabaseClient, paths: string[]) {
  if (!paths.length) return {} as Record<string, string>;
  const { data, error } = await supabase.storage
    .from(PPR_ATTACHMENT_BUCKET)
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
