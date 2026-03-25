import type { SupabaseClient } from "@supabase/supabase-js";
import { listScopedObjectsForProfile } from "@/lib/object-access";
import {
  resolveRelationName,
  resolveRelationNameWithFallback,
  type NamedRelation,
  type RelationValue,
} from "@/lib/relation-normalization";
import type { Profile } from "@/lib/types";
import { getRoundsProjectTimeZone } from "@/lib/rounds/constants";
import { toOperationalDate } from "@/lib/rounds/date";
import { getRoundsSignedUrls } from "@/lib/rounds/files";
import { canManageRoundsConfig, canReadRoundsReports, canUseRoundsScanner } from "@/lib/rounds/permissions";
import type {
  RoundsArchiveRow,
  RoundsCheckinResult,
  RoundsConfigRoom,
  RoundsObjectOption,
  RoundsQrResolution,
  RoundsScannerRoom,
  RoundsTodayRow,
} from "@/lib/rounds/types";

type FloorRelation = RelationValue<{ name: string; sort_order?: number | null }>;

type ConfigRoomRow = {
  id: string;
  object_id: string;
  name: string;
  floor: string | null;
  is_active: boolean;
  rounds_enabled: boolean;
  object: NamedRelation;
  floor_ref: FloorRelation;
};

type ActiveRoomQrRow = {
  room_id: string;
  qr_token: string;
  generated_at: string;
};

type ArchiveQueryRow = {
  id: string;
  operational_date: string;
  room_id: string;
  object_id: string;
  checked_in_by_user_id: string;
  checked_in_by_display_name: string;
  scanned_at_device: string;
  comment: string | null;
  photo_storage_path: string | null;
  room: NamedRelation;
  object: NamedRelation;
};

type TodayCheckinRow = {
  room_id: string;
  checked_in_by_display_name: string;
  scanned_at_device: string;
  comment: string | null;
  photo_storage_path: string | null;
};

function toContainsPattern(value: string) {
  return `%${value}%`;
}

async function listActiveRoomQrMap(supabase: SupabaseClient, roomIds: string[]) {
  if (!roomIds.length) {
    return new Map<string, ActiveRoomQrRow>();
  }

  const { data, error } = await supabase
    .from("object_room_qr_codes")
    .select("room_id,qr_token,generated_at")
    .in("room_id", roomIds)
    .eq("is_active", true);
  if (error) throw error;

  return new Map(
    ((data ?? []) as ActiveRoomQrRow[]).map((row) => [row.room_id, row] satisfies [string, ActiveRoomQrRow])
  );
}

export async function listRoundsReadableObjectsForProfile(supabase: SupabaseClient, profile: Pick<Profile, "id" | "role">) {
  if (!canReadRoundsReports(profile.role)) {
    throw new Error("Недостаточно прав для просмотра обходов");
  }
  return (await listScopedObjectsForProfile(supabase, profile, "rounds_read")) as RoundsObjectOption[];
}

export async function listRoundsManageableObjectsForProfile(supabase: SupabaseClient, profile: Pick<Profile, "id" | "role">) {
  if (!canManageRoundsConfig(profile.role)) {
    throw new Error("Недостаточно прав для настройки обходов");
  }
  return (await listScopedObjectsForProfile(supabase, profile, "rounds_manage")) as RoundsObjectOption[];
}

export async function listRoundsScannerObjectsForProfile(supabase: SupabaseClient, profile: Pick<Profile, "id" | "role">) {
  if (!canUseRoundsScanner(profile.role)) {
    throw new Error("Недостаточно прав для работы со сканером обходов");
  }
  return (await listScopedObjectsForProfile(supabase, profile, "rounds_scan")) as RoundsObjectOption[];
}

export async function getRoundsScannerConfigForProfile(supabase: SupabaseClient, profile: Pick<Profile, "id" | "role">) {
  if (!canUseRoundsScanner(profile.role)) {
    throw new Error("Недостаточно прав для работы со сканером обходов");
  }

  const [objects, scannerResult] = await Promise.all([
    listRoundsScannerObjectsForProfile(supabase, profile),
    supabase.rpc("rounds_list_scanner_config"),
  ]);
  if (scannerResult.error) throw scannerResult.error;

  return {
    projectTimeZone: getRoundsProjectTimeZone(),
    objects,
    rooms: (scannerResult.data ?? []) as RoundsScannerRoom[],
  };
}

export async function resolveRoundsQrTokenForProfile(
  supabase: SupabaseClient,
  profile: Pick<Profile, "id" | "role">,
  token: string
): Promise<RoundsQrResolution | null> {
  if (!canUseRoundsScanner(profile.role) || !token.trim()) return null;
  const { data, error } = await supabase.rpc("rounds_resolve_room_qr_token", { _token: token.trim() });
  if (error) throw error;
  return ((data ?? [])[0] as RoundsQrResolution | undefined) ?? null;
}

export async function listRoundsConfigRoomsForProfile(
  supabase: SupabaseClient,
  profile: Pick<Profile, "id" | "role">,
  filters?: { objectId?: string; query?: string }
) {
  const objects = await listRoundsManageableObjectsForProfile(supabase, profile);
  const accessibleObjectIds = objects.map((item) => item.id);
  if (!accessibleObjectIds.length) {
    return { objects, rooms: [] as RoundsConfigRoom[] };
  }

  const objectId = filters?.objectId?.trim();
  const targetIds = objectId ? accessibleObjectIds.filter((id) => id === objectId) : accessibleObjectIds;
  if (!targetIds.length) {
    return { objects, rooms: [] as RoundsConfigRoom[] };
  }

  let query = supabase
    .from("object_rooms")
    .select("id,object_id,name,floor,is_active,rounds_enabled,object:objects(name),floor_ref:floors(name,sort_order)")
    .in("object_id", targetIds);

  const normalizedQuery = filters?.query?.trim().toLowerCase() ?? "";
  if (normalizedQuery) {
    query = query.ilike("name", toContainsPattern(normalizedQuery));
  }

  const { data, error } = await query;
  if (error) throw error;

  const qrByRoomId = await listActiveRoomQrMap(
    supabase,
    ((data ?? []) as ConfigRoomRow[]).map((room) => room.id)
  );

  const rooms = ((data ?? []) as ConfigRoomRow[])
    .map((room) => ({
      id: room.id,
      object_id: room.object_id,
      object_name: resolveRelationName(room.object),
      room_name: room.name,
      floor_name: resolveRelationNameWithFallback(room.floor_ref, room.floor),
      is_active: room.is_active,
      rounds_enabled: room.rounds_enabled,
      room_qr_token: qrByRoomId.get(room.id)?.qr_token ?? null,
      room_qr_generated_at: qrByRoomId.get(room.id)?.generated_at ?? null,
    }))
    .sort((left, right) => {
      if (left.object_name !== right.object_name) return left.object_name.localeCompare(right.object_name, "ru");
      if (left.floor_name !== right.floor_name) return left.floor_name.localeCompare(right.floor_name, "ru", { numeric: true });
      return left.room_name.localeCompare(right.room_name, "ru");
    });

  return { objects, rooms };
}

export async function saveRoundsRoomSelection(
  supabase: SupabaseClient,
  profile: Pick<Profile, "id" | "role">,
  objectId: string,
  enabledRoomIds: string[]
) {
  const objects = await listRoundsManageableObjectsForProfile(supabase, profile);
  if (!objects.some((item) => item.id === objectId)) {
    throw new Error("Объект недоступен для настройки обходов");
  }

  const normalizedRoomIds = [...new Set(enabledRoomIds.filter(Boolean))];
  const { data: objectRooms, error: roomsError } = await supabase
    .from("object_rooms")
    .select("id")
    .eq("object_id", objectId);
  if (roomsError) throw roomsError;

  const allowedRoomIds = new Set(((objectRooms ?? []) as Array<{ id: string }>).map((room) => room.id));
  const invalidRoomIds = normalizedRoomIds.filter((roomId) => !allowedRoomIds.has(roomId));
  if (invalidRoomIds.length) {
    throw new Error("В payload сохранения попали помещения, которые не принадлежат выбранному объекту.");
  }

  const { error: saveError } = await supabase.rpc("rounds_save_room_selection", {
    _object_id: objectId,
    _enabled_room_ids: normalizedRoomIds,
  });
  if (saveError) throw saveError;

  return {
    objectId,
    enabledRoomIds: normalizedRoomIds,
    enabledCount: normalizedRoomIds.length,
  };
}

export async function saveRoundsRoomSelectionBatch(
  supabase: SupabaseClient,
  profile: Pick<Profile, "id" | "role">,
  operations: Array<{ objectId: string; enabledRoomIds: string[] }>
) {
  const grouped = new Map<string, string[]>();
  for (const operation of operations) {
    if (!operation.objectId) continue;
    grouped.set(operation.objectId, [...new Set(operation.enabledRoomIds.filter(Boolean))]);
  }

  const saved: Array<{ objectId: string; enabledCount: number }> = [];
  const failed: Array<{ objectId: string; error: string }> = [];

  for (const [objectId, enabledRoomIds] of grouped) {
    try {
      const result = await saveRoundsRoomSelection(supabase, profile, objectId, enabledRoomIds);
      saved.push({ objectId: result.objectId, enabledCount: result.enabledCount });
    } catch (error) {
      failed.push({
        objectId,
        error: error instanceof Error ? error.message : "Не удалось сохранить конфигурацию объекта",
      });
    }
  }

  return {
    requestedObjectIds: [...grouped.keys()],
    saved,
    failed,
  };
}

export async function getRoundsTodayForProfile(
  supabase: SupabaseClient,
  profile: Pick<Profile, "id" | "role">,
  options?: { objectId?: string; operationalDate?: string; query?: string }
) {
  const objects = await listRoundsReadableObjectsForProfile(supabase, profile);
  const accessibleObjectIds = objects.map((item) => item.id);
  if (!accessibleObjectIds.length) {
    return { objects, operationalDate: options?.operationalDate ?? toOperationalDate(new Date(), getRoundsProjectTimeZone()), rows: [] as RoundsTodayRow[] };
  }

  const requestedObjectId = options?.objectId?.trim();
  const objectIds = requestedObjectId ? accessibleObjectIds.filter((id) => id === requestedObjectId) : accessibleObjectIds;
  if (!objectIds.length) {
    return { objects, operationalDate: options?.operationalDate ?? toOperationalDate(new Date(), getRoundsProjectTimeZone()), rows: [] as RoundsTodayRow[] };
  }

  const operationalDate = options?.operationalDate?.trim() || toOperationalDate(new Date(), getRoundsProjectTimeZone());
  const { data: roomsData, error: roomsError } = await supabase
    .from("object_rooms")
    .select("id,object_id,name,floor,is_active,rounds_enabled,object:objects(name),floor_ref:floors(name,sort_order)")
    .eq("rounds_enabled", true)
    .eq("is_active", true)
    .in("object_id", objectIds);
  if (roomsError) throw roomsError;

  const { data: checkinsData, error: checkinsError } = await supabase
    .from("rounds_checkins")
    .select("room_id,checked_in_by_display_name,scanned_at_device,comment,photo_storage_path")
    .eq("operational_date", operationalDate)
    .in("object_id", objectIds);
  if (checkinsError) throw checkinsError;

  const checkinMap = new Map<string, TodayCheckinRow>();
  for (const row of (checkinsData ?? []) as TodayCheckinRow[]) {
    checkinMap.set(row.room_id, row);
  }

  const signedUrls = await getRoundsSignedUrls(
    supabase,
    ((checkinsData ?? []) as TodayCheckinRow[])
      .map((item) => item.photo_storage_path)
      .filter((item): item is string => Boolean(item))
  );

  const normalizedQuery = options?.query?.trim().toLowerCase() ?? "";
  const rows = ((roomsData ?? []) as Array<ConfigRoomRow & { rounds_enabled: boolean }>)
    .filter((room) => normalizedQuery === "" || room.name.toLowerCase().includes(normalizedQuery))
    .map((room) => {
      const checkin = checkinMap.get(room.id);
      return {
        room_id: room.id,
        object_id: room.object_id,
        object_name: resolveRelationName(room.object),
        room_name: room.name,
        floor_name: resolveRelationNameWithFallback(room.floor_ref, room.floor),
        rounds_enabled: true,
        status: checkin ? "checked_in" : "missing",
        checked_in_at: checkin?.scanned_at_device ?? null,
        checked_in_by: checkin?.checked_in_by_display_name ?? null,
        has_comment: Boolean(checkin?.comment?.trim()),
        has_photo: Boolean(checkin?.photo_storage_path),
        comment: checkin?.comment ?? null,
        photo_url: checkin?.photo_storage_path ? signedUrls[checkin.photo_storage_path] ?? null : null,
      } satisfies RoundsTodayRow;
    })
    .sort((left, right) => {
      if (left.object_name !== right.object_name) return left.object_name.localeCompare(right.object_name, "ru");
      if (left.floor_name !== right.floor_name) return left.floor_name.localeCompare(right.floor_name, "ru", { numeric: true });
      return left.room_name.localeCompare(right.room_name, "ru");
    });

  return { objects, operationalDate, rows };
}

export async function getRoundsArchiveForProfile(
  supabase: SupabaseClient,
  profile: Pick<Profile, "id" | "role">,
  filters?: {
    objectId?: string;
    roomId?: string;
    technicianId?: string;
    technicianQuery?: string;
    query?: string;
    dateFrom?: string;
    dateTo?: string;
  }
) {
  const objects = await listRoundsReadableObjectsForProfile(supabase, profile);
  const accessibleObjectIds = objects.map((item) => item.id);
  if (!accessibleObjectIds.length) {
    return { objects, rows: [] as RoundsArchiveRow[] };
  }

  const dateFrom = filters?.dateFrom?.trim() || toOperationalDate(new Date(Date.now() - 1000 * 60 * 60 * 24 * 7), getRoundsProjectTimeZone());
  const dateTo = filters?.dateTo?.trim() || toOperationalDate(new Date(), getRoundsProjectTimeZone());
  const requestedObjectId = filters?.objectId?.trim();
  const objectIds = requestedObjectId ? accessibleObjectIds.filter((id) => id === requestedObjectId) : accessibleObjectIds;
  if (!objectIds.length) {
    return { objects, rows: [] as RoundsArchiveRow[] };
  }

  const roomQuery = filters?.query?.trim().toLowerCase() ?? "";
  let matchedRoomIds: string[] | null = null;

  if (roomQuery) {
    const { data: roomsData, error: roomsError } = await supabase
      .from("object_rooms")
      .select("id")
      .in("object_id", objectIds)
      .ilike("name", toContainsPattern(roomQuery));
    if (roomsError) throw roomsError;

    matchedRoomIds = ((roomsData ?? []) as Array<{ id: string }>).map((row) => row.id);
    if (!matchedRoomIds.length) {
      return { objects, rows: [] as RoundsArchiveRow[] };
    }
  }

  let query = supabase
    .from("rounds_checkins")
    .select("id,operational_date,room_id,object_id,checked_in_by_user_id,checked_in_by_display_name,scanned_at_device,comment,photo_storage_path,room:object_rooms(name),object:objects(name)")
    .gte("operational_date", dateFrom)
    .lte("operational_date", dateTo)
    .order("operational_date", { ascending: false })
    .order("scanned_at_device", { ascending: false });

  query = query.in("object_id", objectIds);
  if (filters?.roomId?.trim()) query = query.eq("room_id", filters.roomId.trim());
  if (filters?.technicianId?.trim()) query = query.eq("checked_in_by_user_id", filters.technicianId.trim());
  if (filters?.technicianQuery?.trim()) query = query.ilike("checked_in_by_display_name", toContainsPattern(filters.technicianQuery.trim().toLowerCase()));
  if (matchedRoomIds) query = query.in("room_id", matchedRoomIds);

  const { data, error } = await query;
  if (error) throw error;

  const signedUrls = await getRoundsSignedUrls(
    supabase,
    ((data ?? []) as ArchiveQueryRow[])
      .map((item) => item.photo_storage_path)
      .filter((item): item is string => Boolean(item))
  );

  const rows = ((data ?? []) as ArchiveQueryRow[])
    .map((row) => ({
      id: row.id,
      operational_date: row.operational_date,
      room_id: row.room_id,
      object_id: row.object_id,
      object_name: resolveRelationName(row.object),
      room_name: resolveRelationName(row.room),
      checked_in_by_user_id: row.checked_in_by_user_id,
      checked_in_by_display_name: row.checked_in_by_display_name,
      scanned_at_device: row.scanned_at_device,
      comment: row.comment,
      photo_storage_path: row.photo_storage_path,
      photo_url: row.photo_storage_path ? signedUrls[row.photo_storage_path] ?? null : null,
    }));

  return { objects, rows };
}

export async function getRoundsPrintRowsForProfile(
  supabase: SupabaseClient,
  profile: Pick<Profile, "id" | "role">,
  options?: { objectId?: string; roomIds?: string[] }
) {
  const { rooms } = await listRoundsConfigRoomsForProfile(supabase, profile, { objectId: options?.objectId });
  const roomIds = new Set(options?.roomIds?.filter(Boolean) ?? []);
  return rooms.filter((room) => room.rounds_enabled && room.room_qr_token && (!roomIds.size || roomIds.has(room.id)));
}

export async function upsertRoundsCheckin(
  supabase: SupabaseClient,
  input: {
    roomId: string;
    clientEventId: string;
    scannedAtDevice: string;
    comment?: string | null;
    photo?: {
      storage_path: string;
      file_name: string;
      mime_type: string;
      size_bytes: number;
    } | null;
    source?: string;
  }
) {
  const { data, error } = await supabase.rpc("rounds_upsert_checkin", {
    _room_id: input.roomId,
    _client_event_id: input.clientEventId,
    _scanned_at_device: input.scannedAtDevice,
    _comment: input.comment ?? null,
    _photo_storage_path: input.photo?.storage_path ?? null,
    _photo_file_name: input.photo?.file_name ?? null,
    _photo_mime_type: input.photo?.mime_type ?? null,
    _photo_size_bytes: input.photo?.size_bytes ?? null,
    _source: input.source ?? "pwa",
  });
  if (error) throw error;
  return ((data ?? [])[0] as RoundsCheckinResult | undefined) ?? null;
}
