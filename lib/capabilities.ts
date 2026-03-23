import type { Role } from "@/lib/types";

export function canViewAudit(role: Role) {
  return role === "admin" || role === "chief";
}

export function canManageObjects(role: Role) {
  return role === "admin" || role === "chief";
}

export function canManageUsers(role: Role) {
  return role === "admin" || role === "chief";
}

export function canReadFloorsDirectory(role: Role) {
  return role === "admin" || role === "chief" || role === "lead" || role === "object_engineer";
}

export function canManageFloorsDirectory(role: Role) {
  return role === "admin" || role === "chief" || role === "lead" || role === "object_engineer";
}

export function canReadRoomTypesDirectory(role: Role) {
  return role === "admin" || role === "chief" || role === "lead" || role === "object_engineer";
}

export function canManageRoomTypesDirectory(role: Role) {
  return role === "admin" || role === "chief";
}

export function canAccessDirectories(role: Role) {
  return canManageObjects(role) || canReadFloorsDirectory(role) || canReadRoomTypesDirectory(role);
}

export function canEditTasks(role: Role) {
  return role === "admin" || role === "chief" || role === "lead" || role === "engineer" || role === "object_engineer";
}

export function canManageTaskTeam(role: Role) {
  return role === "admin" || role === "chief" || role === "lead" || role === "engineer" || role === "object_engineer";
}

export function isSuperuser(role: Role) {
  return role === "admin";
}
