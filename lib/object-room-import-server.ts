import { parse } from "csv-parse/sync";
import type { SupabaseClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import { listObjectRoomManageableObjectsForProfile, canManageObjectRooms } from "@/lib/object-rooms";
import { listRoomTypesForProfile } from "@/lib/room-types";
import type { Profile } from "@/lib/types";
import {
  buildObjectRoomImportDuplicateKey,
  detectObjectRoomImportFileType,
  formatObjectRoomImportStatusWhitelist,
  isObjectRoomImportRowEmpty,
  normalizeImportLookupValue,
  normalizeImportWhitespace,
  sanitizeObjectRoomImportName,
  OBJECT_ROOM_IMPORT_ALLOWED_STATUSES,
  OBJECT_ROOM_IMPORT_MAX_FILE_SIZE_BYTES,
  OBJECT_ROOM_IMPORT_MAX_ROWS,
  OBJECT_ROOM_IMPORT_TEMPLATE_HEADERS,
  type ObjectRoomImportPreviewResponse,
  type ObjectRoomImportPreviewRow,
  type ObjectRoomImportRawRow,
  type ObjectRoomImportSummary,
  validateObjectRoomImportSelectedFile,
} from "@/lib/object-room-import";

type LookupValue<T> = T | null;

type ManagedObject = {
  id: string;
  name: string;
};

type FloorLookupRow = {
  id: string;
  object_id: string;
  name: string;
  is_active: boolean;
};

type RoomTypeLookupRow = {
  id: string;
  name: string;
  is_active: boolean;
};

type ExistingRoomLookupRow = {
  id: string;
  object_id: string;
  floor_id: string | null;
  name: string;
};

type ObjectRoomImportValidationContext = {
  objectsByLookup: Map<string, LookupValue<ManagedObject>>;
  floorsByLookup: Map<string, LookupValue<FloorLookupRow>>;
  roomTypesByLookup: Map<string, LookupValue<RoomTypeLookupRow>>;
  existingRoomKeys: Set<string>;
};

export type ObjectRoomImportReadyRow = {
  rowNumber: number;
  objectId: string;
  objectName: string;
  floorId: string;
  floorName: string;
  name: string;
  roomTypeId: string;
  roomTypeName: string;
  description: string | null;
  isActive: boolean;
};

type ParsedCsvRows = {
  rows: ObjectRoomImportRawRow[];
  presetErrorsByRowNumber: Map<number, string[]>;
};

type ValidationResult = {
  rows: ObjectRoomImportPreviewRow[];
  readyRows: ObjectRoomImportReadyRow[];
  summary: ObjectRoomImportSummary;
};

const OBJECT_ROOM_IMPORT_STATUS_MAP = new Map<string, boolean>(
  OBJECT_ROOM_IMPORT_ALLOWED_STATUSES.map((value) => [value, value === "active"])
);

function addLookupValue<T extends { id: string }>(map: Map<string, LookupValue<T>>, key: string, value: T) {
  if (!map.has(key)) {
    map.set(key, value);
    return;
  }

  const current = map.get(key);
  if (!current || current.id !== value.id) {
    map.set(key, null);
  }
}

function createEmptySummary(): ObjectRoomImportSummary {
  return { totalRows: 0, readyCount: 0, skippedCount: 0, errorCount: 0 };
}

export function validateObjectRoomImportFile(file: File) {
  if (!file) return "Файл не передан.";
  return validateObjectRoomImportSelectedFile(file);
}

function parseObjectRoomImportGrid(grid: unknown[][]): ParsedCsvRows {
  const firstMeaningfulRowIndex = grid.findIndex((row) =>
    row.some((cell) => normalizeImportWhitespace(String(cell ?? "")) !== "")
  );

  if (firstMeaningfulRowIndex === -1) {
    throw new Error("Файл не содержит данных.");
  }

  const [headerRow, ...dataRows] = grid.slice(firstMeaningfulRowIndex);
  const normalizedHeaders = headerRow.map((value) => normalizeImportLookupValue(String(value ?? "")));
  const expectedHeaders = [...OBJECT_ROOM_IMPORT_TEMPLATE_HEADERS];

  if (
    normalizedHeaders.length !== expectedHeaders.length ||
    normalizedHeaders.some((value, index) => value !== expectedHeaders[index])
  ) {
    throw new Error(`Неверный заголовок файла. Ожидаются колонки: ${expectedHeaders.join(", ")}.`);
  }

  const presetErrorsByRowNumber = new Map<number, string[]>();
  const rows = dataRows
    .map((record, index) => {
      const rowNumber = firstMeaningfulRowIndex + index + 2;
      const values = expectedHeaders.map((_, cellIndex) => String(record[cellIndex] ?? ""));
      const extraValues = record.slice(expectedHeaders.length).map((value) => normalizeImportWhitespace(String(value ?? "")));

      if (extraValues.some(Boolean)) {
        presetErrorsByRowNumber.set(rowNumber, ["В строке есть лишние значения за пределами шаблона."]);
      }

      return {
        rowNumber,
        object: values[0] ?? "",
        floor: values[1] ?? "",
        name: values[2] ?? "",
        type: values[3] ?? "",
        status: values[4] ?? "",
        description: values[5] ?? "",
      } satisfies ObjectRoomImportRawRow;
    })
    .filter((row) => !isObjectRoomImportRowEmpty(row));

  if (!rows.length) {
    throw new Error("В CSV нет ни одной непустой строки для импорта.");
  }

  if (rows.length > OBJECT_ROOM_IMPORT_MAX_ROWS) {
    throw new Error(`За один импорт можно загрузить не более ${OBJECT_ROOM_IMPORT_MAX_ROWS} строк.`);
  }

  return { rows, presetErrorsByRowNumber };
}

export function parseObjectRoomImportCsv(csvText: string): ParsedCsvRows {
  const parsed = parse(csvText, {
    bom: true,
    comment: "#",
    relax_column_count: true,
    skip_empty_lines: false,
  }) as string[][];

  return parseObjectRoomImportGrid(parsed);
}

export function parseObjectRoomImportXlsx(buffer: Buffer): ParsedCsvRows {
  const workbook = XLSX.read(buffer, { type: "buffer", dense: true });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error("Excel-файл не содержит листов.");
  }

  const worksheet = workbook.Sheets[firstSheetName];
  const parsed = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    raw: false,
    defval: "",
    blankrows: true,
  }) as unknown[][];

  return parseObjectRoomImportGrid(parsed);
}

export async function parseObjectRoomImportFile(file: File): Promise<ParsedCsvRows> {
  const fileType = detectObjectRoomImportFileType(file.name);
  if (fileType === "csv") {
    return parseObjectRoomImportCsv(await file.text());
  }

  if (fileType === "xlsx") {
    const buffer = Buffer.from(await file.arrayBuffer());
    return parseObjectRoomImportXlsx(buffer);
  }

  throw new Error("Поддерживаются только файлы .csv и .xlsx.");
}

export async function buildObjectRoomImportValidationContext(
  supabase: SupabaseClient,
  profile: Pick<Profile, "id" | "role">
): Promise<ObjectRoomImportValidationContext> {
  if (!canManageObjectRooms(profile.role)) {
    throw new Error("Нет доступа к импорту помещений.");
  }

  const manageableObjects = await listObjectRoomManageableObjectsForProfile(supabase, profile);
  if (!manageableObjects.length) {
    throw new Error("Нет доступных объектов для импорта помещений.");
  }

  const managedObjectIds = manageableObjects.map((item) => item.id);

  const [{ data: floors, error: floorsError }, roomTypes, { data: existingRooms, error: roomsError }] = await Promise.all([
    supabase.from("floors").select("id,object_id,name,is_active").in("object_id", managedObjectIds),
    listRoomTypesForProfile(supabase, profile),
    supabase.from("object_rooms").select("id,object_id,floor_id,name").in("object_id", managedObjectIds),
  ]);

  if (floorsError) throw floorsError;
  if (roomsError) throw roomsError;

  const objectsByLookup = new Map<string, LookupValue<ManagedObject>>();
  for (const objectItem of manageableObjects) {
    addLookupValue(objectsByLookup, normalizeImportLookupValue(objectItem.name), objectItem);
  }

  const floorsByLookup = new Map<string, LookupValue<FloorLookupRow>>();
  for (const floor of ((floors ?? []) as FloorLookupRow[])) {
    addLookupValue(
      floorsByLookup,
      `${floor.object_id}::${normalizeImportLookupValue(floor.name)}`,
      floor
    );
  }

  const roomTypesByLookup = new Map<string, LookupValue<RoomTypeLookupRow>>();
  for (const roomType of roomTypes) {
    addLookupValue(roomTypesByLookup, normalizeImportLookupValue(roomType.name), {
      id: roomType.id,
      name: roomType.name,
      is_active: roomType.is_active,
    });
  }

  const existingRoomKeys = new Set<string>();
  for (const room of ((existingRooms ?? []) as ExistingRoomLookupRow[])) {
    if (!room.floor_id) continue;
    existingRoomKeys.add(buildObjectRoomImportDuplicateKey(room.object_id, room.floor_id, room.name));
  }

  return { objectsByLookup, floorsByLookup, roomTypesByLookup, existingRoomKeys };
}

export function validateObjectRoomImportRows(
  context: ObjectRoomImportValidationContext,
  rawRows: ObjectRoomImportRawRow[],
  presetErrorsByRowNumber?: Map<number, string[]>
): ValidationResult {
  const fileSeenKeys = new Map<string, number>();
  const previewRows: ObjectRoomImportPreviewRow[] = [];
  const readyRows: ObjectRoomImportReadyRow[] = [];

  for (const rawRow of rawRows) {
    const objectValue = normalizeImportWhitespace(rawRow.object);
    const floorValue = normalizeImportWhitespace(rawRow.floor);
    const nameValue = sanitizeObjectRoomImportName(rawRow.name);
    const typeValue = normalizeImportWhitespace(rawRow.type);
    const statusValue = normalizeImportWhitespace(rawRow.status);
    const descriptionValue = normalizeImportWhitespace(rawRow.description);

    const messages = [...(presetErrorsByRowNumber?.get(rawRow.rowNumber) ?? [])];

    if (!objectValue) messages.push("Не заполнена колонка object.");
    if (!floorValue) messages.push("Не заполнена колонка floor.");
    if (!nameValue) messages.push("Не заполнена колонка name.");
    if (!typeValue) messages.push("Не заполнена колонка type.");
    if (!statusValue) messages.push("Не заполнена колонка status.");
    if (nameValue && nameValue.length < 2) messages.push("Название помещения должно быть не короче 2 символов.");
    if (descriptionValue.length > 2000) messages.push("Описание превышает лимит 2000 символов.");

    const resolvedObject = objectValue
      ? context.objectsByLookup.get(normalizeImportLookupValue(objectValue))
      : undefined;
    if (objectValue) {
      if (resolvedObject === undefined) {
        messages.push("Объект не найден или недоступен для импорта.");
      } else if (resolvedObject === null) {
        messages.push("Название объекта неоднозначно после нормализации.");
      }
    }

    const resolvedFloor =
      resolvedObject && resolvedObject !== null && floorValue
        ? context.floorsByLookup.get(`${resolvedObject.id}::${normalizeImportLookupValue(floorValue)}`)
        : undefined;
    if (resolvedObject && resolvedObject !== null && floorValue) {
      if (resolvedFloor === undefined) {
        messages.push("Этаж не найден среди доступных этажей выбранного объекта.");
      } else if (resolvedFloor === null) {
        messages.push("Название этажа неоднозначно после нормализации.");
      } else if (!resolvedFloor.is_active) {
        messages.push("Нельзя импортировать помещение на неактивный этаж.");
      }
    }

    const resolvedRoomType = typeValue ? context.roomTypesByLookup.get(normalizeImportLookupValue(typeValue)) : undefined;
    if (typeValue) {
      if (resolvedRoomType === undefined) {
        messages.push("Тип помещения не найден.");
      } else if (resolvedRoomType === null) {
        messages.push("Название типа помещения неоднозначно после нормализации.");
      } else if (!resolvedRoomType.is_active) {
        messages.push("Нельзя импортировать помещение с неактивным типом.");
      }
    }

    const resolvedStatus = statusValue ? OBJECT_ROOM_IMPORT_STATUS_MAP.get(normalizeImportLookupValue(statusValue)) : undefined;
    if (statusValue && resolvedStatus === undefined) {
      messages.push(`Допустимые значения status: ${formatObjectRoomImportStatusWhitelist()}.`);
    }

    let outcome: ObjectRoomImportPreviewRow["outcome"] = "ready";
    let reason: ObjectRoomImportPreviewRow["reason"] = "valid";

    if (!messages.length && resolvedObject && resolvedObject !== null && resolvedFloor && resolvedFloor !== null && resolvedRoomType && resolvedRoomType !== null) {
      const duplicateKey = buildObjectRoomImportDuplicateKey(resolvedObject.id, resolvedFloor.id, nameValue);
      const firstSeenRow = fileSeenKeys.get(duplicateKey);

      if (firstSeenRow) {
        outcome = "skip";
        reason = "duplicate_in_file";
        messages.push(`Дубликат внутри файла: строка ${firstSeenRow}.`);
      } else if (context.existingRoomKeys.has(duplicateKey)) {
        outcome = "skip";
        reason = "duplicate_in_db";
        messages.push("Помещение с таким названием уже существует для выбранных объекта и этажа.");
      } else {
        fileSeenKeys.set(duplicateKey, rawRow.rowNumber);
        readyRows.push({
          rowNumber: rawRow.rowNumber,
          objectId: resolvedObject.id,
          objectName: resolvedObject.name,
          floorId: resolvedFloor.id,
          floorName: resolvedFloor.name,
          name: nameValue,
          roomTypeId: resolvedRoomType.id,
          roomTypeName: resolvedRoomType.name,
          description: descriptionValue || null,
          isActive: resolvedStatus ?? true,
        });
      }
    } else if (messages.length) {
      outcome = "error";
      reason = "validation_error";
    }

    previewRows.push({
      rowNumber: rawRow.rowNumber,
      object: objectValue,
      floor: floorValue,
      name: nameValue,
      type: typeValue,
      status: statusValue,
      description: descriptionValue,
      outcome,
      reason,
      messages,
    });
  }

  const summary = previewRows.reduce(
    (acc, row) => {
      acc.totalRows += 1;
      if (row.outcome === "ready") acc.readyCount += 1;
      if (row.outcome === "skip") acc.skippedCount += 1;
      if (row.outcome === "error") acc.errorCount += 1;
      return acc;
    },
    createEmptySummary()
  );

  return { rows: previewRows, readyRows, summary };
}

export function buildObjectRoomImportPreviewResponse(
  fileName: string,
  validation: ValidationResult
): ObjectRoomImportPreviewResponse {
  return {
    ok: true,
    fileName,
    summary: validation.summary,
    rows: validation.rows,
    commitRows: validation.rows.map((row) => ({
      rowNumber: row.rowNumber,
      object: row.object,
      floor: row.floor,
      name: row.name,
      type: row.type,
      status: row.status,
      description: row.description,
    })),
    constraints: {
      maxRows: OBJECT_ROOM_IMPORT_MAX_ROWS,
      maxFileSizeBytes: OBJECT_ROOM_IMPORT_MAX_FILE_SIZE_BYTES,
      allowedStatuses: OBJECT_ROOM_IMPORT_ALLOWED_STATUSES,
    },
  };
}
