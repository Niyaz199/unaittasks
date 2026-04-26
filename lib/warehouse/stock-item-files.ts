import type { SupabaseClient } from "@supabase/supabase-js";

export const STOCK_ITEM_ATTACHMENT_BUCKET = "stock-item-attachments";
export const STOCK_ITEM_ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;
export const STOCK_ITEM_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
export const STOCK_ITEM_MAX_FILES_PER_UPLOAD = 5;

export function validateStockItemAttachmentFile(file: File): string | null {
  if (!(STOCK_ITEM_ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
    return `Неподдерживаемый тип файла «${file.name}». Разрешены JPEG, PNG, WebP, PDF.`;
  }
  if (file.size > STOCK_ITEM_MAX_FILE_SIZE_BYTES) {
    return `Файл «${file.name}» превышает лимит 10 MB.`;
  }
  return null;
}

export function buildStockItemAttachmentPath(userId: string, stockItemId: string, fileName: string) {
  const ext = fileName.includes(".") ? fileName.split(".").pop() : "bin";
  const unique = crypto.randomUUID();
  return `items/${userId}/${stockItemId}/${unique}.${ext}`;
}

export type UploadedStockItemAttachmentMeta = {
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
};

export async function uploadStockItemAttachmentFile(
  supabase: SupabaseClient,
  file: File,
  userId: string,
  stockItemId: string
): Promise<UploadedStockItemAttachmentMeta> {
  const storagePath = buildStockItemAttachmentPath(userId, stockItemId, file.name);
  const { error } = await supabase.storage
    .from(STOCK_ITEM_ATTACHMENT_BUCKET)
    .upload(storagePath, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(`Ошибка загрузки «${file.name}»: ${error.message}`);

  return {
    storage_path: storagePath,
    file_name: file.name,
    mime_type: file.type,
    size_bytes: file.size,
  };
}

export async function getStockItemSignedUrls(supabase: SupabaseClient, paths: string[]) {
  if (!paths.length) return {} as Record<string, string>;
  const { data, error } = await supabase.storage
    .from(STOCK_ITEM_ATTACHMENT_BUCKET)
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
