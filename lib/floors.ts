import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NamedRelation } from "@/lib/relation-normalization";
import type { Profile } from "@/lib/types";
import { canReadObjectRoomsDirectory } from "@/lib/access/matrix";
import { canManageFloorsDirectory, canReadFloorsDirectory } from "@/lib/auth";
import { listObjectRoomManageableObjectsForProfile, listObjectRoomReadableObjectsForProfile } from "@/lib/object-rooms";

export type FloorRow = {
  id: string;
  object_id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  usage_count: number;
  object: NamedRelation;
};

const floorSortKeywordMap = new Map<string, number>([
  ["подвал", -1000],
  ["цоколь", -1000],
  ["антресоль", 50000],
  ["мезонин", 50000],
  ["техэтаж", 900000],
  ["технический этаж", 900000],
  ["кровля", 1000000],
  ["крыша", 1000000],
]);

export function inferFloorSortOrder(name: string) {
  const normalized = name.trim().toLowerCase();
  if (/^-?\d+$/.test(normalized)) return Number(normalized) * 100;
  return floorSortKeywordMap.get(normalized) ?? 2000000;
}

export const floorFormSchema = z.object({
  objectId: z.string().uuid(),
  name: z.string().trim().min(1).max(100),
  sortOrder: z.number().int().optional().nullable(),
  isActive: z.boolean().default(true),
});

function isSchemaCacheError(error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? String((error as { code?: string }).code ?? "") : "";
  const message =
    typeof error === "object" && error && "message" in error ? String((error as { message?: string }).message ?? "") : "";
  return code === "PGRST204" || code === "PGRST205" || message.toLowerCase().includes("schema cache");
}

export async function listFloorsForProfile(
  supabase: SupabaseClient,
  profile: Pick<Profile, "id" | "role">,
  options: { objectId?: string; onlyActive?: boolean } = {}
) {
  if (!canReadFloorsDirectory(profile.role) && !canReadObjectRoomsDirectory(profile.role)) {
    throw new Error("Недостаточно прав для чтения справочника этажей");
  }

  const readableObjects = await listObjectRoomReadableObjectsForProfile(supabase, profile);
  if (!readableObjects.length && profile.role !== "admin" && profile.role !== "chief") {
    return [] as FloorRow[];
  }

  let query = supabase
    .from("floors")
    .select("id,object_id,name,sort_order,is_active,created_at,updated_at")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (options.onlyActive) query = query.eq("is_active", true);
  if (options.objectId) query = query.eq("object_id", options.objectId);
  if (profile.role !== "admin" && profile.role !== "chief") {
    query = query.in("object_id", readableObjects.map((item) => item.id));
  }

  const { data, error } = await query;
  if (error) {
    if (isSchemaCacheError(error)) return [] as FloorRow[];
    throw error;
  }

  let usageQuery = supabase.from("object_rooms").select("floor_id,object_id").not("floor_id", "is", null);
  if (options.objectId) usageQuery = usageQuery.eq("object_id", options.objectId);
  if (profile.role !== "admin" && profile.role !== "chief") {
    usageQuery = usageQuery.in("object_id", readableObjects.map((item) => item.id));
  }
  const { data: roomLinks, error: usageError } = await usageQuery;
  if (usageError && !isSchemaCacheError(usageError)) throw usageError;

  const usageCountByFloorId = new Map<string, number>();
  for (const link of roomLinks ?? []) {
    if (!link.floor_id) continue;
    usageCountByFloorId.set(link.floor_id, (usageCountByFloorId.get(link.floor_id) ?? 0) + 1);
  }

  const objectNameById = new Map(readableObjects.map((item) => [item.id, item.name] as const));

  return ((data ?? []) as Array<Omit<FloorRow, "usage_count" | "object">>).map((row) => ({
    ...row,
    usage_count: usageCountByFloorId.get(row.id) ?? 0,
    object: objectNameById.has(row.object_id) ? { name: objectNameById.get(row.object_id) ?? "—" } : null,
  }));
}

export async function listManageableFloorsForProfile(
  supabase: SupabaseClient,
  profile: Pick<Profile, "id" | "role">,
  options: { objectId?: string; onlyActive?: boolean } = {}
) {
  if (!canManageFloorsDirectory(profile.role)) {
    throw new Error("Недостаточно прав для управления справочником этажей");
  }

  const manageableObjects = await listObjectRoomManageableObjectsForProfile(supabase, profile);
  if (!manageableObjects.length && profile.role !== "admin" && profile.role !== "chief") {
    return [] as FloorRow[];
  }

  return listFloorsForProfile(supabase, profile, options);
}
