import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hasScopedObjectAccessForProfile, listScopedObjectsForProfile } from "@/lib/object-access";
import type { NamedRelation, RelationValue } from "@/lib/relation-normalization";
import type { Profile } from "@/lib/types";
import { canManageObjectRoomsDirectory, canReadObjectRoomsDirectory } from "@/lib/access/matrix";

type FloorRelation = RelationValue<{ id: string; name: string; sort_order: number; is_active: boolean }>;
type RoomTypeRelation = RelationValue<{ id: string; name: string; is_active: boolean }>;

export type ObjectRoomRow = {
  id: string;
  object_id: string;
  name: string;
  floor: string | null;
  floor_id: string | null;
  room_type_id: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  object: NamedRelation;
  floor_ref: FloorRelation;
  room_type: RoomTypeRelation;
};

export type ObjectRoomQrCode = {
  id: string;
  object_id: string;
  room_id: string;
  qr_token: string;
  is_active: boolean;
  generated_at: string;
};

export const objectRoomFormSchema = z.object({
  objectId: z.string().uuid(),
  name: z.string().trim().min(2),
  floorId: z.string().uuid().optional().nullable(),
  roomTypeId: z.string().uuid().optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
  isActive: z.boolean().default(true),
});

export function sanitizeObjectRoomName(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeObjectRoomName(value: string) {
  return sanitizeObjectRoomName(value).toLowerCase();
}

export function canReadObjectRooms(role: Profile["role"]) {
  return canReadObjectRoomsDirectory(role);
}

export function canManageObjectRooms(role: Profile["role"]) {
  return canManageObjectRoomsDirectory(role);
}

function isSchemaCacheError(error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? String((error as { code?: string }).code ?? "") : "";
  const message =
    typeof error === "object" && error && "message" in error ? String((error as { message?: string }).message ?? "") : "";
  return code === "PGRST204" || code === "PGRST205" || message.toLowerCase().includes("schema cache");
}

export async function listObjectRoomReadableObjectsForProfile(
  supabase: SupabaseClient,
  profile: Pick<Profile, "id" | "role">
) {
  if (!canReadObjectRooms(profile.role)) {
    throw new Error("Недостаточно прав для чтения справочника помещений");
  }

  return listScopedObjectsForProfile(supabase, profile, "object_rooms_read");
}

export async function listObjectRoomManageableObjectsForProfile(
  supabase: SupabaseClient,
  profile: Pick<Profile, "id" | "role">
) {
  if (!canManageObjectRooms(profile.role)) {
    throw new Error("Недостаточно прав для управления справочником помещений");
  }

  return listScopedObjectsForProfile(supabase, profile, "object_rooms_manage");
}

export async function listObjectRoomsForProfile(
  supabase: SupabaseClient,
  profile: Pick<Profile, "id" | "role">,
  options: { objectId?: string } = {}
) {
  if (!canReadObjectRooms(profile.role)) {
    throw new Error("Недостаточно прав для чтения справочника помещений");
  }

  const objects = await listObjectRoomReadableObjectsForProfile(supabase, profile);
  if (!objects.length && profile.role !== "admin" && profile.role !== "chief") return [];

  let query = supabase
    .from("object_rooms")
    .select(
      "id,object_id,name,floor,floor_id,room_type_id,description,is_active,created_at,object:objects(name),floor_ref:floors(id,name,sort_order,is_active),room_type:room_types(id,name,is_active)"
    )
    .order("name", { ascending: true });
  if (options.objectId) {
    query = query.eq("object_id", options.objectId);
  }

  const { data, error } =
    profile.role === "admin" || profile.role === "chief" ? await query : await query.in("object_id", objects.map((item) => item.id));
  if (error) {
    if (!isSchemaCacheError(error)) throw error;

    let legacyQuery = supabase
      .from("object_rooms")
      .select("id,object_id,name,floor,description,is_active,created_at,object:objects(name)")
      .order("name", { ascending: true });
    if (options.objectId) {
      legacyQuery = legacyQuery.eq("object_id", options.objectId);
    }
    const legacyResult =
      profile.role === "admin" || profile.role === "chief"
        ? await legacyQuery
        : await legacyQuery.in("object_id", objects.map((item) => item.id));
    if (legacyResult.error) throw legacyResult.error;

    return ((legacyResult.data ?? []) as Array<{
      id: string;
      object_id: string;
      name: string;
      floor: string | null;
      description: string | null;
      is_active: boolean;
      created_at: string;
      object: NamedRelation;
    }>).map((row) => ({
      ...row,
      floor_id: null,
      room_type_id: null,
      floor_ref: null,
      room_type: null,
    }));
  }

  return (data ?? []) as ObjectRoomRow[];
}

export async function getObjectRoomByIdForProfile(
  supabase: SupabaseClient,
  profile: Pick<Profile, "id" | "role">,
  roomId: string
) {
  if (!canReadObjectRooms(profile.role)) {
    throw new Error("Недостаточно прав для чтения карточки помещения");
  }

  const { data, error } = await supabase
    .from("object_rooms")
    .select(
      "id,object_id,name,floor,floor_id,room_type_id,description,is_active,created_at,rounds_enabled,object:objects(name),floor_ref:floors(id,name,sort_order,is_active),room_type:room_types(id,name,is_active)"
    )
    .eq("id", roomId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const canAccess = await hasScopedObjectAccessForProfile(supabase, profile, "object_rooms_read", data.object_id);
  if (!canAccess) return null;

  const { data: qrCode, error: qrError } = await supabase
    .from("object_room_qr_codes")
    .select("id,object_id,room_id,qr_token,is_active,generated_at")
    .eq("room_id", roomId)
    .eq("is_active", true)
    .maybeSingle();
  if (qrError) throw qrError;

  return {
    room: data as ObjectRoomRow & { rounds_enabled: boolean },
    qrCode: (qrCode ?? null) as ObjectRoomQrCode | null,
  };
}

export async function getObjectRoomQrCodeByTokenForProfile(
  supabase: SupabaseClient,
  profile: Pick<Profile, "role">,
  qrToken: string
) {
  if (!canReadObjectRooms(profile.role)) {
    throw new Error("Недостаточно прав для QR-запросов помещений");
  }

  const { data, error } = await supabase.rpc("object_room_resolve_qr_token", { _token: qrToken.trim() });
  if (error) throw error;

  const row = Array.isArray(data) ? data[0] ?? null : data ?? null;
  return row as ObjectRoomQrCode | null;
}

export type ObjectRoomsObjectSummaryRow = {
  object_id: string;
  object_name: string;
  total_count: number;
  active_count: number;
  inactive_count: number;
  floor_count: number;
};

export async function listObjectRoomsObjectSummariesForProfile(
  supabase: SupabaseClient,
  profile: Pick<Profile, "id" | "role">
): Promise<ObjectRoomsObjectSummaryRow[]> {
  const objects = await listObjectRoomManageableObjectsForProfile(supabase, profile);
  if (!objects.length) return [];

  const objectIds = objects.map((item) => item.id);
  const { data, error } = await supabase
    .from("object_rooms")
    .select("object_id,floor_id,is_active")
    .in("object_id", objectIds);
  if (error) throw error;

  const stats = new Map<
    string,
    { total: number; active: number; inactive: number; floors: Set<string> }
  >();
  for (const row of (data ?? []) as Array<{ object_id: string; floor_id: string | null; is_active: boolean }>) {
    const current =
      stats.get(row.object_id) ?? { total: 0, active: 0, inactive: 0, floors: new Set<string>() };
    current.total += 1;
    if (row.is_active) current.active += 1;
    else current.inactive += 1;
    if (row.floor_id) current.floors.add(row.floor_id);
    stats.set(row.object_id, current);
  }

  return objects
    .map((object) => {
      const s = stats.get(object.id);
      return {
        object_id: object.id,
        object_name: object.name,
        total_count: s?.total ?? 0,
        active_count: s?.active ?? 0,
        inactive_count: s?.inactive ?? 0,
        floor_count: s?.floors.size ?? 0,
      };
    })
    .sort((a, b) => a.object_name.localeCompare(b.object_name, "ru"));
}

export async function regenerateObjectRoomQrCodeForProfile(
  supabase: SupabaseClient,
  profile: Pick<Profile, "id" | "role">,
  roomId: string
) {
  if (!canManageObjectRooms(profile.role)) {
    throw new Error("Недостаточно прав для регенерации QR помещения");
  }

  const { data: room, error: roomError } = await supabase
    .from("object_rooms")
    .select("id,object_id")
    .eq("id", roomId)
    .maybeSingle();
  if (roomError) throw roomError;
  if (!room) {
    throw new Error("Помещение не найдено");
  }

  const canManage = await hasScopedObjectAccessForProfile(supabase, profile, "object_rooms_manage", room.object_id);
  if (!canManage) {
    throw new Error("Помещение недоступно для регенерации QR");
  }

  const { data, error } = await supabase.rpc("object_room_regenerate_qr", { _room_id: roomId });
  if (error) throw error;

  const row = Array.isArray(data) ? data[0] ?? null : data ?? null;
  return row as ObjectRoomQrCode | null;
}
