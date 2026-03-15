import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "@/lib/types";

const OBJECT_ROOM_READ_ROLES = new Set(["admin", "chief", "lead", "engineer", "object_engineer"]);
const OBJECT_ROOM_MANAGE_ROLES = new Set(["admin", "chief", "lead", "object_engineer"]);

type ObjectRow = { id: string; name: string };

export type ObjectRoomRow = {
  id: string;
  object_id: string;
  name: string;
  floor: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  object: { name: string } | Array<{ name: string }> | null;
};

export const objectRoomFormSchema = z.object({
  objectId: z.string().uuid(),
  name: z.string().trim().min(2),
  floor: z.string().trim().max(100).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
  isActive: z.boolean().default(true),
});

export function canReadObjectRooms(role: Profile["role"]) {
  return OBJECT_ROOM_READ_ROLES.has(role);
}

export function canManageObjectRooms(role: Profile["role"]) {
  return OBJECT_ROOM_MANAGE_ROLES.has(role);
}

async function listObjectScopedObjects(
  supabase: SupabaseClient,
  profile: Pick<Profile, "id" | "role">,
  mode: "read" | "manage"
): Promise<ObjectRow[]> {
  if (profile.role === "admin" || profile.role === "chief") {
    const { data, error } = await supabase.from("objects").select("id,name").order("name", { ascending: true });
    if (error) throw error;
    return (data ?? []) as ObjectRow[];
  }

  const canProceed =
    mode === "manage"
      ? profile.role === "lead" || profile.role === "object_engineer"
      : profile.role === "lead" || profile.role === "engineer" || profile.role === "object_engineer";
  if (!canProceed) {
    return [];
  }

  type UserObjectRow = { objects: ObjectRow | null };
  const { data, error } = await supabase
    .from("user_objects")
    .select("objects(id,name)")
    .eq("user_id", profile.id);
  if (error) throw error;

  const rows = ((data ?? []) as unknown as UserObjectRow[])
    .map((row) => row.objects)
    .filter((row): row is ObjectRow => row !== null);

  return rows.sort((a, b) => a.name.localeCompare(b.name, "ru"));
}

export async function listObjectRoomReadableObjectsForProfile(
  supabase: SupabaseClient,
  profile: Pick<Profile, "id" | "role">
) {
  if (!canReadObjectRooms(profile.role)) {
    throw new Error("Недостаточно прав для чтения справочника помещений");
  }

  return listObjectScopedObjects(supabase, profile, "read");
}

export async function listObjectRoomManageableObjectsForProfile(
  supabase: SupabaseClient,
  profile: Pick<Profile, "id" | "role">
) {
  if (!canManageObjectRooms(profile.role)) {
    throw new Error("Недостаточно прав для управления справочником помещений");
  }

  return listObjectScopedObjects(supabase, profile, "manage");
}

export async function listObjectRoomsForProfile(supabase: SupabaseClient, profile: Pick<Profile, "id" | "role">) {
  if (!canReadObjectRooms(profile.role)) {
    throw new Error("Недостаточно прав для чтения справочника помещений");
  }

  const objects = await listObjectRoomReadableObjectsForProfile(supabase, profile);
  if (!objects.length && profile.role !== "admin" && profile.role !== "chief") return [];

  const query = supabase
    .from("object_rooms")
    .select("id,object_id,name,floor,description,is_active,created_at,object:objects(name)")
    .order("name", { ascending: true });

  const { data, error } =
    profile.role === "admin" || profile.role === "chief" ? await query : await query.in("object_id", objects.map((item) => item.id));
  if (error) throw error;

  return (data ?? []) as ObjectRoomRow[];
}
