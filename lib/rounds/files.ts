import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ROUNDS_ALLOWED_MIME_TYPES,
  ROUNDS_FILES_BUCKET,
  ROUNDS_MAX_FILE_SIZE_BYTES,
} from "@/lib/rounds/constants";

export function validateRoundsPhoto(file: File): string | null {
  if (!(ROUNDS_ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
    return `Неподдерживаемый тип файла «${file.name}». Разрешены только JPEG, PNG и WebP.`;
  }
  if (file.size > ROUNDS_MAX_FILE_SIZE_BYTES) {
    return `Файл «${file.name}» превышает лимит 5 MB.`;
  }
  return null;
}

export function buildRoundsPhotoPath(userId: string, roomId: string, fileName: string) {
  const ext = fileName.split(".").pop() ?? "jpg";
  return `checkins/${userId}/${roomId}/${crypto.randomUUID()}.${ext}`;
}

export async function uploadRoundsPhoto(
  supabase: SupabaseClient,
  file: File,
  userId: string,
  roomId: string
) {
  const storagePath = buildRoundsPhotoPath(userId, roomId, file.name);
  const { error } = await supabase.storage
    .from(ROUNDS_FILES_BUCKET)
    .upload(storagePath, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(`Ошибка загрузки фото «${file.name}»: ${error.message}`);

  return {
    storage_path: storagePath,
    file_name: file.name,
    mime_type: file.type,
    size_bytes: file.size,
  };
}

export async function getRoundsSignedUrls(supabase: SupabaseClient, paths: string[]) {
  if (!paths.length) return {} as Record<string, string>;
  const { data, error } = await supabase.storage
    .from(ROUNDS_FILES_BUCKET)
    .createSignedUrls(paths, 3600);
  if (error || !data) return {};

  const result: Record<string, string> = {};
  for (const item of data) {
    if (item.path && item.signedUrl) {
      result[item.path] = item.signedUrl;
    }
  }
  return result;
}
