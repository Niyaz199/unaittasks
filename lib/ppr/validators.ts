import { z } from "zod";

export const pprResponsibleRoleSchema = z.enum(["lead", "engineer", "object_engineer"]);
export const pprTaskStatusSchema = z.enum(["new", "in_progress", "done", "closed", "cancelled"]);
export const pprEquipmentStatusSchema = z.enum(["active", "repair", "out_of_service", "archived"]);
export const pprMonthPlanItemStatusSchema = z.enum(["pending", "materialized", "carried_over", "closed", "cancelled"]);

const uuidSchema = z.string().uuid();

export const pprSystemGroupFormSchema = z.object({
  name: z.string().trim().min(2),
  code: z.string().trim().min(2),
  isActive: z.boolean().default(true),
});

export const pprSystemFormSchema = z.object({
  objectId: uuidSchema,
  systemGroupId: uuidSchema,
  name: z.string().trim().min(2),
  description: z.string().trim().max(2000).optional().nullable(),
  responsibleUserId: uuidSchema.nullable().optional(),
  isActive: z.boolean().default(true),
});

export const pprSubsystemFormSchema = z.object({
  objectId: uuidSchema,
  systemId: uuidSchema,
  parentId: uuidSchema.nullable().optional(),
  name: z.string().trim().min(2),
  sortOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

export const pprRoomFormSchema = z.object({
  objectId: uuidSchema,
  name: z.string().trim().min(2),
  floor: z.string().trim().max(100).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
  isActive: z.boolean().default(true),
});

export const pprEquipmentFormSchema = z.object({
  objectId: uuidSchema,
  systemId: uuidSchema,
  subsystemId: uuidSchema,
  roomId: uuidSchema,
  inventoryNo: z.string().trim().max(255).optional().nullable(),
  name: z.string().trim().min(2),
  dispatchName: z.string().trim().min(2),
  serviceStartDate: z.string().date(),
  status: pprEquipmentStatusSchema.default("active"),
  serialNo: z.string().trim().max(255).optional().nullable(),
  manufacturer: z.string().trim().max(255).optional().nullable(),
  model: z.string().trim().max(255).optional().nullable(),
  description: z.string().trim().max(4000).optional().nullable(),
  comment: z.string().trim().max(4000).optional().nullable(),
});

export const pprChecklistItemFormSchema = z.object({
  sortOrder: z.number().int().min(1),
  title: z.string().trim().min(1),
  description: z.string().trim().max(4000).optional().nullable(),
});

export const pprWorkTemplateFormSchema = z.object({
  objectId: uuidSchema,
  subsystemId: uuidSchema,
  name: z.string().trim().min(2),
  description: z.string().trim().max(4000).optional().nullable(),
  periodMonths: z.number().int().min(1),
  baseStartDate: z.string().date(),
  normHours: z.number().nonnegative().optional().nullable(),
  methodology: z.string().trim().max(4000).optional().nullable(),
  isActive: z.boolean().default(true),
  checklistItems: z.array(pprChecklistItemFormSchema).default([]),
});

export const pprEquipmentAssignmentFormSchema = z.object({
  objectId: uuidSchema,
  equipmentId: uuidSchema,
  templateId: uuidSchema,
  startDate: z.string().date(),
  periodMonths: z.number().int().min(1),
  isActive: z.boolean().default(true),
});

export const pprMonthPlanGenerateFormSchema = z.object({
  systemId: uuidSchema,
  planMonth: z.string().regex(/^\d{4}-\d{2}$/),
});

export const pprMonthPlanItemScheduleFormSchema = z.object({
  itemId: uuidSchema,
  plannedFor: z.string().optional(),
});
