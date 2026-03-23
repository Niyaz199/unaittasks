import type { SupabaseClient } from "@supabase/supabase-js";
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

type NamedRelation = { name: string } | Array<{ name: string }> | null;
type FloorRelation = { name: string; sort_order?: number | null } | Array<{ name: string; sort_order?: number | null }> | null;

type ConfigRoomRow = {
  id: string;
  object_id: string;
  name: string;
  floor: string | null;
  is_active: boolean;
  rounds_enabled: boolean;
  rounds_qr_token: string | null;
  rounds_qr_generated_at: string | null;
  object: NamedRelation;
  floor_ref: FloorRelation;
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

function resolveName(value: NamedRelation) {
  if (Array.isArray(value)) return value[0]?.name ?? "—";
  return value?.name ?? "—";
}

function resolveFloorName(value: FloorRelation, fallback: string | null) {
  if (Array.isArray(value)) return value[0]?.name ?? fallback ?? "—";
  return value?.name ?? fallback ?? "—";
}

async function listRoundsScopedObjects(
  supabase: SupabaseClient,
  profile: Pick<Profile, "id" | "role">,
  mode: "scan" | "read" | "manage"
): Promise<RoundsObjectOption[]> {
  if (profile.role === "admin" || profile.role === "chief") {
    const { data, error } = await supabase.from("objects").select("id,name").order("name", { ascending: true });
    if (error) throw error;
    return (data ?? []) as RoundsObjectOption[];
  }

  if (mode !== "scan" && profile.role === "tech") {
    return [];
  }

  const result = new Map<string, RoundsObjectOption>();

  if (profile.role === "lead" || profile.role === "engineer" || profile.role === "object_engineer" || profile.role === "tech") {
    type UserObjectRow = { objects: RoundsObjectOption | null };
    const { data, error } = await supabase
      .from("user_objects")
      .select("objects(id,name)")
      .eq("user_id", profile.id);
    if (error) throw error;

    for (const row of ((data ?? []) as unknown as UserObjectRow[])) {
      if (row.objects) result.set(row.objects.id, row.objects);
    }
  }

  if (profile.role === "object_engineer") {
    const { data, error } = await supabase
      .from("objects")
      .select("id,name")
      .eq("object_engineer_id", profile.id);
    if (error) throw error;

    for (const row of (data ?? []) as RoundsObjectOption[]) {
      result.set(row.id, row);
    }
  }

  return [...result.values()].sort((left, right) => left.name.localeCompare(right.name, "ru"));
}

export async function listRoundsReadableObjectsForProfile(supabase: SupabaseClient, profile: Pick<Profile, "id" | "role">) {
  if (!canReadRoundsReports(profile.role)) {
    throw new Error("Недостаточно прав для просмотра обходов");
  }
  return listRoundsScopedObjects(supabase, profile, "read");
}

export async function listRoundsManageableObjectsForProfile(supabase: SupabaseClient, profile: Pick<Profile, "id" | "role">) {
  if (!canManageRoundsConfig(profile.role)) {
    throw new Error("Недостаточно прав для настройки обходов");
  }
  return listRoundsScopedObjects(supabase, profile, "manage");
}

export async function listRoundsScannerObjectsForProfile(supabase: SupabaseClient, profile: Pick<Profile, "id" | "role">) {
  if (!canUseRoundsScanner(profile.role)) {
    throw new Error("Недостаточно прав для работы со сканером обходов");
  }
  return listRoundsScopedObjects(supabase, profile, "scan");
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

  const { data, error } = await supabase
    .from("object_rooms")
    .select("id,object_id,name,floor,is_active,rounds_enabled,rounds_qr_token,rounds_qr_generated_at,object:objects(name),floor_ref:floors(name,sort_order)")
    .in("object_id", targetIds);
  if (error) throw error;

  const normalizedQuery = filters?.query?.trim().toLowerCase() ?? "";
  const rooms = ((data ?? []) as ConfigRoomRow[])
    .filter((room) => normalizedQuery === "" || room.name.toLowerCase().includes(normalizedQuery))
    .map((room) => ({
      id: room.id,
      object_id: room.object_id,
      object_name: resolveName(room.object),
      room_name: room.name,
      floor_name: resolveFloorName(room.floor_ref, room.floor),
      is_active: room.is_active,
      rounds_enabled: room.rounds_enabled,
      rounds_qr_token: room.rounds_qr_token,
      rounds_qr_generated_at: room.rounds_qr_generated_at,
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

  const { error: disableError } = await supabase
    .from("object_rooms")
    .update({ rounds_enabled: false })
    .eq("object_id", objectId);
  if (disableError) throw disableError;

  if (enabledRoomIds.length) {
    const { error: enableError } = await supabase
      .from("object_rooms")
      .update({ rounds_enabled: true })
      .eq("object_id", objectId)
      .in("id", enabledRoomIds);
    if (enableError) throw enableError;
  }
}

export async function ensureRoundsQrTokens(
  supabase: SupabaseClient,
  profile: Pick<Profile, "id" | "role">,
  options: {
    objectId?: string;
    roomIds?: string[];
    forceRegenerate?: boolean;
    missingOnly?: boolean;
  }
) {
  const objects = await listRoundsManageableObjectsForProfile(supabase, profile);
  const accessibleObjectIds = new Set(objects.map((item) => item.id));
  if (!accessibleObjectIds.size) {
    return [];
  }

  let query = supabase
    .from("object_rooms")
    .select("id,object_id,rounds_enabled,rounds_qr_token")
    .eq("is_active", true);

  if (options.objectId) {
    if (!accessibleObjectIds.has(options.objectId)) {
      throw new Error("Объект недоступен для генерации QR");
    }
    query = query.eq("object_id", options.objectId);
  } else {
    query = query.in("object_id", [...accessibleObjectIds]);
  }

  if (options.roomIds?.length) {
    query = query.in("id", options.roomIds);
  }

  const { data, error } = await query;
  if (error) throw error;

  const candidates = ((data ?? []) as Array<{ id: string; object_id: string; rounds_enabled: boolean; rounds_qr_token: string | null }>)
    .filter((room) => room.rounds_enabled)
    .filter((room) => (options.missingOnly ? !room.rounds_qr_token : true));

  const updated: string[] = [];
  for (const room of candidates) {
    if (!options.forceRegenerate && !options.missingOnly && room.rounds_qr_token) {
      continue;
    }

    const tokenResult = await supabase.rpc("rounds_generate_qr_token");
    if (tokenResult.error) throw tokenResult.error;

    const { error: updateError } = await supabase
      .from("object_rooms")
      .update({
        rounds_qr_token: tokenResult.data,
        rounds_qr_generated_at: new Date().toISOString(),
      })
      .eq("id", room.id);
    if (updateError) throw updateError;

    updated.push(room.id);
  }

  return updated;
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
        object_name: resolveName(room.object),
        room_name: room.name,
        floor_name: resolveFloorName(room.floor_ref, room.floor),
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

  const { data, error } = await query;
  if (error) throw error;

  const signedUrls = await getRoundsSignedUrls(
    supabase,
    ((data ?? []) as ArchiveQueryRow[])
      .map((item) => item.photo_storage_path)
      .filter((item): item is string => Boolean(item))
  );

  const technicianQuery = filters?.technicianQuery?.trim().toLowerCase() ?? "";
  const roomQuery = filters?.query?.trim().toLowerCase() ?? "";
  const rows = ((data ?? []) as ArchiveQueryRow[])
    .filter((row) => technicianQuery === "" || row.checked_in_by_display_name.toLowerCase().includes(technicianQuery))
    .filter((row) => roomQuery === "" || resolveName(row.room).toLowerCase().includes(roomQuery))
    .map((row) => ({
      id: row.id,
      operational_date: row.operational_date,
      room_id: row.room_id,
      object_id: row.object_id,
      object_name: resolveName(row.object),
      room_name: resolveName(row.room),
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
  return rooms.filter((room) => room.rounds_enabled && room.rounds_qr_token && (!roomIds.size || roomIds.has(room.id)));
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
