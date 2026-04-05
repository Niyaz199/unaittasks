import type { DailyChecklistRole, Role } from "@/lib/types";

const DAILY_CHECKLIST_USER_ROLES: Role[] = ["admin", "chief", "lead", "engineer", "object_engineer"];
const DAILY_CHECKLIST_TEMPLATE_ROLES: DailyChecklistRole[] = ["lead", "engineer", "object_engineer"];
const DAILY_CHECKLIST_TEMPLATE_MANAGER_ROLES: Role[] = ["admin", "chief"];
const DAILY_CHECKLIST_CONTROL_ROLES: Role[] = ["admin", "chief", "lead"];

function includesRole(roles: readonly Role[], role: Role) {
  return roles.includes(role);
}

export function canAccessDailyChecklists(role: Role) {
  return includesRole(DAILY_CHECKLIST_USER_ROLES, role);
}

export function canManageDailyChecklistTemplates(role: Role) {
  return includesRole(DAILY_CHECKLIST_TEMPLATE_MANAGER_ROLES, role);
}

export function canReadDailyChecklistControl(role: Role) {
  return includesRole(DAILY_CHECKLIST_CONTROL_ROLES, role);
}

export function listDailyChecklistTemplateRoles() {
  return [...DAILY_CHECKLIST_TEMPLATE_ROLES];
}

export function isDailyChecklistTemplateRole(role: Role): role is DailyChecklistRole {
  return DAILY_CHECKLIST_TEMPLATE_ROLES.includes(role as DailyChecklistRole);
}
