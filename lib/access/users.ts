import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile, Role } from "@/lib/types";
import {
  canAccessUserManagement,
  canAssignLinkedObjectsToRole,
  canManageUserTarget,
  isGlobalObjectScopeRole,
  listManageableUserRoles,
} from "@/lib/access/matrix";
import { listActorScopedObjectIdsForProfile } from "@/lib/access/object-scope";

export function canManageUsers(role: Role) {
  return canAccessUserManagement(role);
}

export function listAvailableUserRoles(actorRole: Role) {
  return listManageableUserRoles(actorRole);
}

export function canManageUserRole(actorRole: Role, targetRole: Role) {
  return canManageUserTarget(actorRole, targetRole);
}

export function canAssignObjectsToManagedUser(targetRole: Role) {
  return canAssignLinkedObjectsToRole(targetRole);
}

export async function listManageableObjectIdsForUserManagement(
  supabase: SupabaseClient,
  actor: Pick<Profile, "id" | "role">
) {
  if (isGlobalObjectScopeRole(actor.role)) {
    const { data, error } = await supabase.from("objects").select("id");
    if (error) throw error;
    return (data ?? []).map((item) => item.id as string);
  }

  return listActorScopedObjectIdsForProfile(supabase, actor);
}

export async function assertManageableUserPayload(
  supabase: SupabaseClient,
  actor: Pick<Profile, "id" | "role">,
  targetRole: Role,
  objectIds: string[]
) {
  if (!canManageUserRole(actor.role, targetRole)) {
    throw new Error("\u041d\u0435\u0434\u043e\u0441\u0442\u0430\u0442\u043e\u0447\u043d\u043e \u043f\u0440\u0430\u0432 \u0434\u043b\u044f \u0443\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u0438\u044f \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u043e\u0439 \u0440\u043e\u043b\u044c\u044e");
  }

  const uniqueObjectIds = [...new Set(objectIds)];
  if (!canAssignObjectsToManagedUser(targetRole)) {
    if (uniqueObjectIds.length > 0) {
      throw new Error("\u0414\u043b\u044f \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u043e\u0439 \u0440\u043e\u043b\u0438 \u043d\u0435\u043b\u044c\u0437\u044f \u043d\u0430\u0437\u043d\u0430\u0447\u0430\u0442\u044c \u0434\u043e\u0441\u0442\u0443\u043f \u043a \u043e\u0431\u044a\u0435\u043a\u0442\u0430\u043c \u0447\u0435\u0440\u0435\u0437 \u0444\u043e\u0440\u043c\u0443 \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f");
    }
    return [];
  }

  const manageableObjectIds = await listManageableObjectIdsForUserManagement(supabase, actor);
  const deniedObjectIds = uniqueObjectIds.filter((objectId) => !manageableObjectIds.includes(objectId));
  if (deniedObjectIds.length > 0) {
    throw new Error("\u0412\u044b\u0431\u0440\u0430\u043d\u044b \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u044b\u0435 \u043e\u0431\u044a\u0435\u043a\u0442\u044b");
  }

  return uniqueObjectIds;
}
