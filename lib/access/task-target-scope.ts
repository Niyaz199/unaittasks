import { isGlobalObjectScopeRole } from "@/lib/access/matrix";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Profile } from "@/lib/types";

type TargetProfile = Pick<Profile, "id" | "role">;

export async function listTaskTargetObjectIdsByProfile(
  profiles: TargetProfile[],
  options?: { allowedObjectIds?: readonly string[] }
) {
  const uniqueProfiles = [...new Map(profiles.map((profile) => [profile.id, profile])).values()];
  if (!uniqueProfiles.length) {
    return new Map<string, string[]>();
  }

  const admin = createSupabaseAdminClient();
  const allowedObjectIds = options?.allowedObjectIds ? new Set(options.allowedObjectIds) : null;
  const engineerScopedIds = uniqueProfiles
    .filter((profile) => profile.role === "engineer" || profile.role === "tech")
    .map((profile) => profile.id);
  const objectEngineerIds = uniqueProfiles
    .filter((profile) => profile.role === "object_engineer")
    .map((profile) => profile.id);

  const linkedObjectsPromise = engineerScopedIds.length
    ? admin.from("user_objects").select("user_id,object_id").in("user_id", engineerScopedIds)
    : Promise.resolve({
        data: [] as Array<{ user_id: string; object_id: string }>,
        error: null,
      });
  const ownedObjectsPromise = objectEngineerIds.length
    ? admin.from("objects").select("id,object_engineer_id").in("object_engineer_id", objectEngineerIds)
    : Promise.resolve({
        data: [] as Array<{ id: string; object_engineer_id: string | null }>,
        error: null,
      });

  const [{ data: linkedObjects, error: linkedObjectsError }, { data: ownedObjects, error: ownedObjectsError }] =
    await Promise.all([linkedObjectsPromise, ownedObjectsPromise]);

  if (linkedObjectsError) throw linkedObjectsError;
  if (ownedObjectsError) throw ownedObjectsError;

  const objectIdsByUser = new Map<string, Set<string>>();
  for (const row of linkedObjects ?? []) {
    if (allowedObjectIds && !allowedObjectIds.has(row.object_id)) continue;
    const current = objectIdsByUser.get(row.user_id) ?? new Set<string>();
    current.add(row.object_id);
    objectIdsByUser.set(row.user_id, current);
  }

  for (const row of ownedObjects ?? []) {
    if (!row.object_engineer_id) continue;
    if (allowedObjectIds && !allowedObjectIds.has(row.id)) continue;
    const current = objectIdsByUser.get(row.object_engineer_id) ?? new Set<string>();
    current.add(row.id);
    objectIdsByUser.set(row.object_engineer_id, current);
  }

  return new Map(
    uniqueProfiles.map((profile) => [profile.id, [...(objectIdsByUser.get(profile.id) ?? new Set<string>())]])
  );
}

export async function hasTaskTargetObjectAccess(profile: TargetProfile, objectId: string) {
  if (isGlobalObjectScopeRole(profile.role)) {
    return true;
  }

  const objectIdsByUser = await listTaskTargetObjectIdsByProfile([profile], { allowedObjectIds: [objectId] });
  return objectIdsByUser.get(profile.id)?.includes(objectId) ?? false;
}
