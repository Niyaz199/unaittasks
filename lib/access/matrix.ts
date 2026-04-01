import type { Role } from "@/lib/types";

export type ObjectScopeSource = "global" | "user_objects" | "object_engineer_objects" | "none";

const AUDIT_ROLES: Role[] = ["admin", "chief"];
const OBJECT_MANAGEMENT_ROLES: Role[] = ["admin", "chief", "lead"];
const USER_MANAGEMENT_ROLES: Role[] = ["admin", "chief", "lead", "engineer", "object_engineer"];
const FLOOR_READ_ROLES: Role[] = ["admin", "chief", "lead", "object_engineer"];
const FLOOR_MANAGE_ROLES: Role[] = ["admin", "chief", "lead", "object_engineer"];
const ROOM_TYPE_READ_ROLES: Role[] = ["admin", "chief", "lead", "object_engineer"];
const ROOM_TYPE_MANAGE_ROLES: Role[] = ["admin", "chief"];
const OBJECT_ROOM_ROLES: Role[] = ["admin", "chief", "lead", "engineer", "object_engineer"];
const TASK_CREATE_ROLES: Role[] = ["admin", "chief", "lead", "engineer", "object_engineer"];
const TASK_DELETE_ROLES: Role[] = ["admin", "chief", "lead"];
const TASK_TEAM_MANAGEMENT_ROLES: Role[] = ["admin", "chief", "lead", "engineer", "object_engineer"];
const TASK_ASSIGNMENT_MATRIX: Partial<Record<Role, readonly Role[]>> = {
  admin: ["lead", "engineer", "object_engineer", "tech"],
  chief: ["lead", "engineer", "object_engineer", "tech"],
  lead: ["engineer", "object_engineer", "tech"],
  engineer: ["lead", "engineer", "object_engineer", "tech"],
  object_engineer: ["lead", "engineer", "object_engineer", "tech"],
};
const PPR_MODULE_ROLES: Role[] = ["admin", "chief", "lead", "engineer", "object_engineer", "tech"];
const PPR_MANAGEMENT_ROLES: Role[] = ["admin", "chief", "lead", "engineer", "object_engineer"];
const ROUNDS_MODULE_ROLES: Role[] = ["admin", "chief", "lead", "engineer", "object_engineer", "tech"];
const ROUNDS_REPORT_ROLES: Role[] = ["admin", "chief", "lead", "engineer", "object_engineer"];
const ROUNDS_CONFIG_ROLES: Role[] = ["admin", "chief", "lead", "engineer", "object_engineer"];
const GLOBAL_OBJECT_SCOPE_ROLES: Role[] = ["admin", "chief", "lead"];

function includesRole(roles: readonly Role[], role: Role) {
  return roles.includes(role);
}

export function canViewAudit(role: Role) {
  return includesRole(AUDIT_ROLES, role);
}

export function canManageObjects(role: Role) {
  return includesRole(OBJECT_MANAGEMENT_ROLES, role);
}

export function canAccessUserManagement(role: Role) {
  return includesRole(USER_MANAGEMENT_ROLES, role);
}

export function canReadFloorsDirectory(role: Role) {
  return includesRole(FLOOR_READ_ROLES, role);
}

export function canManageFloorsDirectory(role: Role) {
  return includesRole(FLOOR_MANAGE_ROLES, role);
}

export function canReadRoomTypesDirectory(role: Role) {
  return includesRole(ROOM_TYPE_READ_ROLES, role);
}

export function canManageRoomTypesDirectory(role: Role) {
  return includesRole(ROOM_TYPE_MANAGE_ROLES, role);
}

export function canReadObjectRoomsDirectory(role: Role) {
  return includesRole(OBJECT_ROOM_ROLES, role);
}

export function canManageObjectRoomsDirectory(role: Role) {
  return includesRole(OBJECT_ROOM_ROLES, role);
}

export function canAccessDirectories(role: Role) {
  return (
    canManageObjects(role) ||
    canAccessUserManagement(role) ||
    canReadFloorsDirectory(role) ||
    canReadRoomTypesDirectory(role) ||
    canReadObjectRoomsDirectory(role)
  );
}

export function canCreateTasks(role: Role) {
  return includesRole(TASK_CREATE_ROLES, role);
}

export function canDeleteTasks(role: Role) {
  return includesRole(TASK_DELETE_ROLES, role);
}

export function canManageTaskTeam(role: Role) {
  return includesRole(TASK_TEAM_MANAGEMENT_ROLES, role);
}

export function listAssignableTaskRoles(actorRole: Role): Role[] {
  return [...(TASK_ASSIGNMENT_MATRIX[actorRole] ?? [])];
}

export function canAssignTaskToRole(actorRole: Role, targetRole: Role) {
  return listAssignableTaskRoles(actorRole).includes(targetRole);
}

export function listManageableUserRoles(actorRole: Role): Role[] {
  if (actorRole === "admin" || actorRole === "chief" || actorRole === "lead") {
    return ["admin", "chief", "lead", "engineer", "object_engineer", "tech"];
  }
  if (actorRole === "engineer") {
    return ["tech"];
  }
  if (actorRole === "object_engineer") {
    return ["engineer", "tech"];
  }
  return [];
}

export function canManageUserTarget(actorRole: Role, targetRole: Role) {
  return listManageableUserRoles(actorRole).includes(targetRole);
}

export function canAssignLinkedObjectsToRole(targetRole: Role) {
  return targetRole === "engineer" || targetRole === "tech";
}

export function canAccessPprModule(role: Role) {
  return includesRole(PPR_MODULE_ROLES, role);
}

export function canManagePprScopedContent(role: Role) {
  return includesRole(PPR_MANAGEMENT_ROLES, role);
}

export function canAccessRoundsModule(role: Role) {
  return includesRole(ROUNDS_MODULE_ROLES, role);
}

export function canUseRoundsScanner(role: Role) {
  return canAccessRoundsModule(role);
}

export function canReadRoundsReports(role: Role) {
  return includesRole(ROUNDS_REPORT_ROLES, role);
}

export function canManageRoundsConfig(role: Role) {
  return includesRole(ROUNDS_CONFIG_ROLES, role);
}

export function isGlobalObjectScopeRole(role: Role) {
  return includesRole(GLOBAL_OBJECT_SCOPE_ROLES, role);
}

export function getObjectScopeSource(role: Role): ObjectScopeSource {
  if (isGlobalObjectScopeRole(role)) {
    return "global";
  }
  if (role === "engineer" || role === "tech") {
    return "user_objects";
  }
  if (role === "object_engineer") {
    return "object_engineer_objects";
  }
  return "none";
}

export function isSuperuser(role: Role) {
  return role === "admin";
}
