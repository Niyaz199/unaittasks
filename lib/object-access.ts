import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "@/lib/types";

export type ScopedObjectRow = {
  id: string;
  name: string;
};

type ObjectScopeKey =
  | "object_rooms_read"
  | "object_rooms_manage"
  | "ppr_manage"
  | "ppr_execute"
  | "rounds_read"
  | "rounds_manage"
  | "rounds_scan";

type ObjectScopePolicy = {
  viaUserObjectsRoles: Profile["role"][];
  includeObjectEngineerOwnedObjects: boolean;
};

type UserObjectRelationRow = {
  objects: ScopedObjectRow | null;
};

const OBJECT_SCOPE_POLICIES: Record<ObjectScopeKey, ObjectScopePolicy> = {
  object_rooms_read: {
    viaUserObjectsRoles: ["lead", "engineer", "object_engineer"],
    includeObjectEngineerOwnedObjects: false,
  },
  object_rooms_manage: {
    viaUserObjectsRoles: ["lead", "object_engineer"],
    includeObjectEngineerOwnedObjects: false,
  },
  ppr_manage: {
    viaUserObjectsRoles: ["lead", "object_engineer"],
    includeObjectEngineerOwnedObjects: false,
  },
  ppr_execute: {
    viaUserObjectsRoles: ["lead", "engineer", "object_engineer", "tech"],
    includeObjectEngineerOwnedObjects: false,
  },
  rounds_read: {
    viaUserObjectsRoles: ["lead", "engineer", "object_engineer"],
    includeObjectEngineerOwnedObjects: true,
  },
  rounds_manage: {
    viaUserObjectsRoles: ["lead", "engineer", "object_engineer"],
    includeObjectEngineerOwnedObjects: true,
  },
  rounds_scan: {
    viaUserObjectsRoles: ["lead", "engineer", "object_engineer", "tech"],
    includeObjectEngineerOwnedObjects: true,
  },
};

function isGlobalObjectScopeRole(role: Profile["role"]) {
  return role === "admin" || role === "chief";
}

const listScopedObjectsCached = cache(
  async (
    supabase: SupabaseClient,
    profileId: string,
    role: Profile["role"],
    scope: ObjectScopeKey
  ): Promise<ScopedObjectRow[]> => {
    if (isGlobalObjectScopeRole(role)) {
      const { data, error } = await supabase.from("objects").select("id,name").order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ScopedObjectRow[];
    }

    const policy = OBJECT_SCOPE_POLICIES[scope];
    const result = new Map<string, ScopedObjectRow>();

    if (policy.viaUserObjectsRoles.includes(role)) {
      const { data, error } = await supabase
        .from("user_objects")
        .select("objects(id,name)")
        .eq("user_id", profileId);
      if (error) throw error;

      for (const row of ((data ?? []) as unknown as UserObjectRelationRow[])) {
        if (row.objects) {
          result.set(row.objects.id, row.objects);
        }
      }
    }

    if (policy.includeObjectEngineerOwnedObjects && role === "object_engineer") {
      const { data, error } = await supabase.from("objects").select("id,name").eq("object_engineer_id", profileId);
      if (error) throw error;

      for (const row of (data ?? []) as ScopedObjectRow[]) {
        result.set(row.id, row);
      }
    }

    return [...result.values()].sort((left, right) => left.name.localeCompare(right.name, "ru"));
  }
);

export async function listScopedObjectsForProfile(
  supabase: SupabaseClient,
  profile: Pick<Profile, "id" | "role">,
  scope: ObjectScopeKey
) {
  return listScopedObjectsCached(supabase, profile.id, profile.role, scope);
}

export async function listScopedObjectIdsForProfile(
  supabase: SupabaseClient,
  profile: Pick<Profile, "id" | "role">,
  scope: ObjectScopeKey
) {
  const objects = await listScopedObjectsForProfile(supabase, profile, scope);
  return objects.map((item) => item.id);
}

export async function hasScopedObjectAccessForProfile(
  supabase: SupabaseClient,
  profile: Pick<Profile, "id" | "role">,
  scope: ObjectScopeKey,
  objectId: string
) {
  if (isGlobalObjectScopeRole(profile.role)) {
    return true;
  }

  const objectIds = await listScopedObjectIdsForProfile(supabase, profile, scope);
  return objectIds.includes(objectId);
}
