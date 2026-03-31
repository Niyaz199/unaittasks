import type { SupabaseClient } from "@supabase/supabase-js";
import { hasActorScopedObjectAccessForProfile, listActorScopedObjectsForProfile } from "@/lib/access/object-scope";
import { isGlobalObjectScopeRole } from "@/lib/access/matrix";
import type { Profile } from "@/lib/types";

export type ScopedObjectRow = {
  id: string;
  name: string;
  object_engineer_id?: string | null;
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
  allowedRoles: Profile["role"][];
};

const OBJECT_SCOPE_POLICIES: Record<ObjectScopeKey, ObjectScopePolicy> = {
  object_rooms_read: {
    allowedRoles: ["lead", "engineer", "object_engineer"],
  },
  object_rooms_manage: {
    allowedRoles: ["lead", "engineer", "object_engineer"],
  },
  ppr_manage: {
    allowedRoles: ["lead", "engineer", "object_engineer"],
  },
  ppr_execute: {
    allowedRoles: ["lead", "engineer", "object_engineer", "tech"],
  },
  rounds_read: {
    allowedRoles: ["lead", "engineer", "object_engineer"],
  },
  rounds_manage: {
    allowedRoles: ["lead", "engineer", "object_engineer"],
  },
  rounds_scan: {
    allowedRoles: ["lead", "engineer", "object_engineer", "tech"],
  },
};

function canUseObjectScope(profile: Pick<Profile, "role">, scope: ObjectScopeKey) {
  if (isGlobalObjectScopeRole(profile.role)) {
    return true;
  }

  return OBJECT_SCOPE_POLICIES[scope].allowedRoles.includes(profile.role);
}

export async function listScopedObjectsForProfile(
  supabase: SupabaseClient,
  profile: Pick<Profile, "id" | "role">,
  scope: ObjectScopeKey
) {
  if (!canUseObjectScope(profile, scope)) {
    return [] as ScopedObjectRow[];
  }

  const objects = await listActorScopedObjectsForProfile(supabase, profile);
  return objects.map((item) => ({ id: item.id, name: item.name, object_engineer_id: item.object_engineer_id }));
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
  if (!canUseObjectScope(profile, scope)) {
    return false;
  }

  if (isGlobalObjectScopeRole(profile.role)) {
    return true;
  }

  return hasActorScopedObjectAccessForProfile(supabase, profile, objectId);
}
