import type { Role } from "@/lib/types";

export function canAccessRoundsModule(role: Role) {
  return ["admin", "chief", "lead", "engineer", "object_engineer", "tech"].includes(role);
}

export function canUseRoundsScanner(role: Role) {
  return canAccessRoundsModule(role);
}

export function canReadRoundsReports(role: Role) {
  return role !== "tech" && canAccessRoundsModule(role);
}

export function canManageRoundsConfig(role: Role) {
  return ["admin", "chief", "lead", "engineer", "object_engineer"].includes(role);
}
