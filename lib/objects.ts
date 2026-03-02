import type { SupabaseClient } from "@supabase/supabase-js";
import type { ObjectItem, Profile } from "@/lib/types";

export async function listObjectsForProfile(supabase: SupabaseClient, profile: Profile) {
  if (profile.role === "object_engineer") {
    const { data, error } = await supabase
      .from("objects")
      .select("id,name,object_engineer_id")
      .eq("object_engineer_id", profile.id)
      .order("name", { ascending: true });
    if (error) throw error;
    return (data ?? []) as ObjectItem[];
  }

  if (profile.role === "engineer") {
    const { data, error } = await supabase
      .from("user_objects")
      .select("objects(id,name,object_engineer_id)")
      .eq("user_id", profile.id);
    if (error) throw error;

    // PostgREST returns the related record as a single object (ManyToOne FK),
    // not an array. Cast through unknown to satisfy TS when no generated types.
    type UserObjectRow = { objects: ObjectItem | null };
    const rows = (data as unknown as UserObjectRow[]) ?? [];
    return rows
      .map((row) => row.objects ?? null)
      .filter((obj): obj is ObjectItem => obj !== null);
  }

  const { data, error } = await supabase
    .from("objects")
    .select("id,name,object_engineer_id")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ObjectItem[];
}
