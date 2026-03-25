import type { SupabaseClient } from "@supabase/supabase-js";
import { listScopedObjectsForProfile, type ScopedObjectRow } from "@/lib/object-access";
import type { Profile } from "@/lib/types";

const STRUCTURE_MANAGER_ROLES = new Set(["admin", "chief", "lead", "object_engineer"]);
const SYSTEM_GROUP_MANAGER_ROLES = new Set(["admin", "chief", "lead"]);
const TEMPLATE_MANAGER_ROLES = new Set(["admin", "chief", "lead", "object_engineer"]);
const ASSIGNMENT_MANAGER_ROLES = new Set(["admin", "chief", "lead", "object_engineer"]);
const CALENDAR_MANAGER_ROLES = new Set(["admin", "chief", "lead", "engineer", "object_engineer"]);
const TASK_LAYER_ROLES = new Set(["admin", "chief", "lead", "engineer", "object_engineer", "tech"]);
const QR_LAYER_ROLES = new Set(["admin", "chief", "lead", "engineer", "object_engineer", "tech"]);

export const RESPONSIBLE_ROLES = new Set(["lead", "engineer", "object_engineer"]);

export type PprManageableObjectRow = ScopedObjectRow;

export function canAccessPprStructureScreens(role: Profile["role"]) {
  return STRUCTURE_MANAGER_ROLES.has(role);
}

export function canAccessPprSystemGroupScreens(role: Profile["role"]) {
  return SYSTEM_GROUP_MANAGER_ROLES.has(role);
}

export function canAccessPprTemplateScreens(role: Profile["role"]) {
  return TEMPLATE_MANAGER_ROLES.has(role);
}

export function canAccessPprAssignmentScreens(role: Profile["role"]) {
  return ASSIGNMENT_MANAGER_ROLES.has(role);
}

export function canAccessPprCalendarScreens(role: Profile["role"]) {
  return CALENDAR_MANAGER_ROLES.has(role);
}

export function canAccessPprTaskScreens(role: Profile["role"]) {
  return TASK_LAYER_ROLES.has(role);
}

export function canAccessPprQrScreens(role: Profile["role"]) {
  return QR_LAYER_ROLES.has(role);
}

export function assertPprStructureQueryAccess(role: Profile["role"]) {
  if (!canAccessPprStructureScreens(role)) {
    throw new Error("Недостаточно прав для server-side запросов структуры ППР");
  }
}

export function assertPprSystemGroupQueryAccess(role: Profile["role"]) {
  if (!canAccessPprSystemGroupScreens(role)) {
    throw new Error("Недостаточно прав для server-side запросов справочника групп систем ППР");
  }
}

export function assertPprTemplateQueryAccess(role: Profile["role"]) {
  if (!canAccessPprTemplateScreens(role)) {
    throw new Error("Недостаточно прав для server-side запросов шаблонов ППР");
  }
}

export function assertPprAssignmentQueryAccess(role: Profile["role"]) {
  if (!canAccessPprAssignmentScreens(role)) {
    throw new Error("Недостаточно прав для server-side запросов назначений ППР");
  }
}

export function assertPprCalendarQueryAccess(role: Profile["role"]) {
  if (!canAccessPprCalendarScreens(role)) {
    throw new Error("Недостаточно прав для server-side запросов календаря ППР");
  }
}

export function assertPprTaskQueryAccess(role: Profile["role"]) {
  if (!canAccessPprTaskScreens(role)) {
    throw new Error("Недостаточно прав для server-side запросов ППР-заявок");
  }
}

export function assertPprQrQueryAccess(role: Profile["role"]) {
  if (!canAccessPprQrScreens(role)) {
    throw new Error("Недостаточно прав для QR-запросов ППР");
  }
}

export async function listPprManageableObjectsForProfile(
  supabase: SupabaseClient,
  profile: Pick<Profile, "id" | "role">
): Promise<PprManageableObjectRow[]> {
  assertPprStructureQueryAccess(profile.role);
  return listScopedObjectsForProfile(supabase, profile, "ppr_manage");
}
