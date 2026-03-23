import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "@/lib/types";
import { canManageRoomTypesDirectory, canReadRoomTypesDirectory } from "@/lib/auth";

export type RoomTypeRow = {
  id: string;
  name: string;
  description: string | null;
  sort_order: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  usage_count: number;
};

export const roomTypeFormSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional().nullable(),
  sortOrder: z.number().int().optional().nullable(),
  isActive: z.boolean().default(true),
});

function isSchemaCacheError(error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? String((error as { code?: string }).code ?? "") : "";
  const message =
    typeof error === "object" && error && "message" in error ? String((error as { message?: string }).message ?? "") : "";
  return code === "PGRST204" || code === "PGRST205" || message.toLowerCase().includes("schema cache");
}

export async function listRoomTypesForProfile(
  supabase: SupabaseClient,
  profile: Pick<Profile, "role">,
  options: { onlyActive?: boolean } = {}
) {
  if (!canReadRoomTypesDirectory(profile.role)) {
    throw new Error("Недостаточно прав для чтения справочника типов помещений");
  }

  let query = supabase
    .from("room_types")
    .select("id,name,description,sort_order,is_active,created_at,updated_at")
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true });

  if (options.onlyActive) query = query.eq("is_active", true);

  const [{ data, error }, { data: roomLinks, error: usageError }] = await Promise.all([
    query,
    supabase.from("object_rooms").select("room_type_id").not("room_type_id", "is", null),
  ]);

  if (error) {
    if (isSchemaCacheError(error)) return [] as RoomTypeRow[];
    throw error;
  }
  if (usageError && !isSchemaCacheError(usageError)) throw usageError;

  const usageCountByTypeId = new Map<string, number>();
  for (const link of roomLinks ?? []) {
    if (!link.room_type_id) continue;
    usageCountByTypeId.set(link.room_type_id, (usageCountByTypeId.get(link.room_type_id) ?? 0) + 1);
  }

  return ((data ?? []) as Array<Omit<RoomTypeRow, "usage_count">>).map((row) => ({
    ...row,
    usage_count: usageCountByTypeId.get(row.id) ?? 0,
  }));
}

export async function listManageableRoomTypesForProfile(
  supabase: SupabaseClient,
  profile: Pick<Profile, "role">,
  options: { onlyActive?: boolean } = {}
) {
  if (!canManageRoomTypesDirectory(profile.role)) {
    throw new Error("Недостаточно прав для управления справочником типов помещений");
  }

  return listRoomTypesForProfile(supabase, profile, options);
}
