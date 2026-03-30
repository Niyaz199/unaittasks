import { normalizeObjectRoomName, sanitizeObjectRoomName } from "@/lib/object-rooms";

export const OBJECT_ROOM_IMPORT_TEMPLATE_HEADERS = ["object", "floor", "name", "type", "status", "description"] as const;

export const OBJECT_ROOM_IMPORT_ALLOWED_STATUSES = ["active", "inactive"] as const;
export const OBJECT_ROOM_IMPORT_SUPPORTED_EXTENSIONS = [".csv", ".xlsx"] as const;

export const OBJECT_ROOM_IMPORT_MAX_FILE_SIZE_BYTES = 1024 * 1024;
export const OBJECT_ROOM_IMPORT_MAX_ROWS = 500;

export type ObjectRoomImportAllowedStatus = (typeof OBJECT_ROOM_IMPORT_ALLOWED_STATUSES)[number];
export type ObjectRoomImportFileType = "csv" | "xlsx";

export type ObjectRoomImportRawRow = {
  rowNumber: number;
  object: string;
  floor: string;
  name: string;
  type: string;
  status: string;
  description: string;
};

export type ObjectRoomImportRowOutcome = "ready" | "skip" | "error";

export type ObjectRoomImportRowReason =
  | "valid"
  | "duplicate_in_file"
  | "duplicate_in_db"
  | "validation_error";

export type ObjectRoomImportPreviewRow = {
  rowNumber: number;
  object: string;
  floor: string;
  name: string;
  type: string;
  status: string;
  description: string;
  outcome: ObjectRoomImportRowOutcome;
  reason: ObjectRoomImportRowReason;
  messages: string[];
};

export type ObjectRoomImportErrorItem = {
  rowNumber: number;
  message: string;
};

export type ObjectRoomImportSummary = {
  totalRows: number;
  readyCount: number;
  skippedCount: number;
  errorCount: number;
};

export type ObjectRoomImportPreviewResponse = {
  ok: true;
  fileName: string;
  summary: ObjectRoomImportSummary;
  rows: ObjectRoomImportPreviewRow[];
  commitRows: ObjectRoomImportRawRow[];
  constraints: {
    maxRows: number;
    maxFileSizeBytes: number;
    allowedStatuses: readonly ObjectRoomImportAllowedStatus[];
  };
};

export type ObjectRoomImportCommitResponse = {
  ok: true;
  summary: {
    created: number;
    skipped: number;
    errors: number;
  };
  errors: ObjectRoomImportErrorItem[];
};

export function normalizeImportWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizeImportLookupValue(value: string) {
  return normalizeImportWhitespace(value).toLowerCase();
}

export function normalizeObjectRoomImportName(value: string) {
  return normalizeObjectRoomName(value);
}

export function sanitizeObjectRoomImportName(value: string) {
  return sanitizeObjectRoomName(value);
}

export function buildObjectRoomImportDuplicateKey(objectId: string, floorId: string, roomName: string) {
  return `${objectId}::${floorId}::${normalizeObjectRoomImportName(roomName)}`;
}

export function isObjectRoomImportRowEmpty(row: ObjectRoomImportRawRow) {
  return (
    normalizeImportWhitespace(row.object) === "" &&
    normalizeImportWhitespace(row.floor) === "" &&
    normalizeImportWhitespace(row.name) === "" &&
    normalizeImportWhitespace(row.type) === "" &&
    normalizeImportWhitespace(row.status) === "" &&
    normalizeImportWhitespace(row.description) === ""
  );
}

export function formatObjectRoomImportStatusWhitelist() {
  return OBJECT_ROOM_IMPORT_ALLOWED_STATUSES.join(", ");
}

export function detectObjectRoomImportFileType(fileName: string): ObjectRoomImportFileType | null {
  const normalized = fileName.trim().toLowerCase();
  if (normalized.endsWith(".csv")) return "csv";
  if (normalized.endsWith(".xlsx")) return "xlsx";
  return null;
}

export function validateObjectRoomImportSelectedFile(file: { name: string; size: number }) {
  if (!detectObjectRoomImportFileType(file.name)) {
    return "Поддерживаются только файлы .csv и .xlsx.";
  }

  if (file.size <= 0) {
    return "Файл пустой.";
  }

  if (file.size > OBJECT_ROOM_IMPORT_MAX_FILE_SIZE_BYTES) {
    return `Файл превышает лимит ${Math.floor(OBJECT_ROOM_IMPORT_MAX_FILE_SIZE_BYTES / 1024 / 1024)} MB.`;
  }

  return null;
}
