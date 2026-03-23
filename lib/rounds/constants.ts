export const ROUNDS_FILES_BUCKET = "rounds-files";
export const ROUNDS_ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const ROUNDS_MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
export const ROUNDS_MAX_COMMENT_LENGTH = 2000;

export function getRoundsProjectTimeZone() {
  return process.env.ROUND_PROJECT_TIMEZONE ?? process.env.TZ ?? "UTC";
}
