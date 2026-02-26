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

    const rows = (data ?? []) as Array<{ objects: ObjectItem[] | null }>;
    return rows
      .map((row) => row.objects?.[0] ?? null)
      .filter(Boolean) as ObjectItem[];
  }

  const { data, error } = await supabase
    .from("objects")
    .select("id,name,object_engineer_id")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ObjectItem[];
}
