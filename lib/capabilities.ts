import type { Role } from "@/lib/types";
import {
  canAccessDailyChecklists as canAccessDailyChecklistsByRole,
  canAccessDirectories as canAccessDirectoriesByRole,
  canAccessWarehouseModule as canAccessWarehouseModuleByRole,
  canAccessUserManagement,
  canCreatePurchaseRequests as canCreatePurchaseRequestsByRole,
  canCreateTasks,
  canManageDailyChecklistTemplates as canManageDailyChecklistTemplatesByRole,
  canManageFloorsDirectory as canManageFloorsDirectoryByRole,
  canManageObjects as canManageObjectsByRole,
  canManageTaskTeam as canManageTaskTeamByRole,
  canManagePurchaseRequests as canManagePurchaseRequestsByRole,
  canManageWarehouseCatalog as canManageWarehouseCatalogByRole,
  canManageObjectRoomsDirectory as canManageObjectRoomsDirectoryByRole,
  canManageRoomTypesDirectory as canManageRoomTypesDirectoryByRole,
  canReadDailyChecklistControl as canReadDailyChecklistControlByRole,
  canReadFloorsDirectory as canReadFloorsDirectoryByRole,
  canReadObjectRoomsDirectory,
  canReadRoomTypesDirectory as canReadRoomTypesDirectoryByRole,
  canViewAudit as canViewAuditByRole,
  isSuperuser,
} from "@/lib/access/matrix";

export function canViewAudit(role: Role) {
  return canViewAuditByRole(role);
}

export function canManageObjects(role: Role) {
  return canManageObjectsByRole(role);
}

export function canManageUsers(role: Role) {
  return canAccessUserManagement(role);
}

export function canReadFloorsDirectory(role: Role) {
  return canReadFloorsDirectoryByRole(role);
}

export function canManageFloorsDirectory(role: Role) {
  return canManageFloorsDirectoryByRole(role);
}

export function canReadRoomTypesDirectory(role: Role) {
  return canReadRoomTypesDirectoryByRole(role);
}

export function canManageRoomTypesDirectory(role: Role) {
  return canManageRoomTypesDirectoryByRole(role);
}

export function canAccessDirectories(role: Role) {
  return canAccessDirectoriesByRole(role);
}

export function canEditTasks(role: Role) {
  return canCreateTasks(role);
}

export function canManageTaskTeam(role: Role) {
  return canManageTaskTeamByRole(role);
}

export function canManageObjectRooms(role: Role) {
  return canManageObjectRoomsDirectoryByRole(role);
}

export function canAccessDailyChecklists(role: Role) {
  return canAccessDailyChecklistsByRole(role);
}

export function canAccessWarehouseModule(role: Role) {
  return canAccessWarehouseModuleByRole(role);
}

export function canManageWarehouseCatalog(role: Role) {
  return canManageWarehouseCatalogByRole(role);
}

export function canAccessPurchaseRequestsModule(role: Role) {
  return canAccessWarehouseModuleByRole(role);
}

export function canCreatePurchaseRequests(role: Role) {
  return canCreatePurchaseRequestsByRole(role);
}

export function canManagePurchaseRequests(role: Role) {
  return canManagePurchaseRequestsByRole(role);
}

export function canManageDailyChecklistTemplates(role: Role) {
  return canManageDailyChecklistTemplatesByRole(role);
}

export function canReadDailyChecklistControl(role: Role) {
  return canReadDailyChecklistControlByRole(role);
}

export { canReadObjectRoomsDirectory, isSuperuser };
