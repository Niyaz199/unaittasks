import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "@/lib/types";
import { getObjectScopeSource, isGlobalObjectScopeRole, type ObjectScopeSource } from "@/lib/access/matrix";

export type ScopedObjectAccessRow = {
  id: string;
  name: string;
  object_engineer_id: string | null;
};

type UserObjectRelationRow = {
  objects: ScopedObjectAccessRow | null;
};

function sortObjects(objects: ScopedObjectAccessRow[]) {
  return [...objects].sort((left, right) => left.name.localeCompare(right.name, "ru"));
}

async function listObjectsByScopeSource(
  supabase: SupabaseClient,
  profileId: string,
  source: ObjectScopeSource
): Promise<ScopedObjectAccessRow[]> {
  if (source === "global") {
    const { data, error } = await supabase
      .from("objects")
      .select("id,name,object_engineer_id")
      .order("name", { ascending: true });
    if (error) throw error;
    return (data ?? []) as ScopedObjectAccessRow[];
  }

  if (source === "user_objects") {
    const { data, error } = await supabase
      .from("user_objects")
      .select("objects(id,name,object_engineer_id)")
      .eq("user_id", profileId);
    if (error) throw error;

    const rows = (data ?? []) as unknown as UserObjectRelationRow[];
    const byId = new Map<string, ScopedObjectAccessRow>();
    for (const row of rows) {
      if (row.objects) {
        byId.set(row.objects.id, row.objects);
      }
    }
    return sortObjects([...byId.values()]);
  }

  if (source === "object_engineer_objects") {
    const { data, error } = await supabase
      .from("objects")
      .select("id,name,object_engineer_id")
      .eq("object_engineer_id", profileId)
      .order("name", { ascending: true });
    if (error) throw error;
    return (data ?? []) as ScopedObjectAccessRow[];
  }

  return [];
}

const listActorScopedObjectsCached = cache(
  async (supabase: SupabaseClient, profileId: string, role: Profile["role"]): Promise<ScopedObjectAccessRow[]> => {
    return listObjectsByScopeSource(supabase, profileId, getObjectScopeSource(role));
  }
);

export async function listActorScopedObjectsForProfile(
  supabase: SupabaseClient,
  profile: Pick<Profile, "id" | "role">
) {
  return listActorScopedObjectsCached(supabase, profile.id, profile.role);
}

export async function listActorScopedObjectIdsForProfile(
  supabase: SupabaseClient,
  profile: Pick<Profile, "id" | "role">
) {
  const objects = await listActorScopedObjectsForProfile(supabase, profile);
  return objects.map((item) => item.id);
}

export async function hasActorScopedObjectAccessForProfile(
  supabase: SupabaseClient,
  profile: Pick<Profile, "id" | "role">,
  objectId: string
) {
  if (isGlobalObjectScopeRole(profile.role)) {
    return true;
  }

  const objectIds = await listActorScopedObjectIdsForProfile(supabase, profile);
  return objectIds.includes(objectId);
}
