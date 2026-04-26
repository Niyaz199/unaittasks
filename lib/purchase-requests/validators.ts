import { z } from "zod";

const uuidSchema = z.string().uuid();

export const purchaseRequestStatusSchema = z.enum(["new", "in_progress", "fulfilled", "cancelled"]);
export const purchaseRequestExecutorRoleSchema = z.enum(["engineer", "procurement_manager"]);

export const purchaseRequestFormSchema = z.object({
  objectId: uuidSchema,
  stockItemId: z.string().uuid().optional().nullable(),
  title: z.string().trim().min(2),
  unit: z.string().trim().min(1).max(20).default("шт"),
  quantityRequested: z.coerce.number().positive(),
  note: z.string().trim().max(4000).optional().nullable(),
  description: z.string().trim().max(4000).optional().nullable(),
});

export const purchaseRequestStatusFormSchema = z.object({
  requestId: uuidSchema,
  status: purchaseRequestStatusSchema,
});

export const purchaseRequestFinalizeDraftSchema = z.object({
  requestId: uuidSchema,
});

export const purchaseRequestReassignItemSchema = z.object({
  itemId: uuidSchema,
  targetRole: purchaseRequestExecutorRoleSchema,
});

export const purchaseRequestCartToggleSchema = z.object({
  itemId: uuidSchema,
  inCart: z.boolean(),
});

export const purchaseRequestFromPprTaskItemSchema = z.object({
  stockItemId: uuidSchema,
  quantityRequested: z.coerce.number().positive(),
  note: z.string().trim().max(2000).optional().nullable(),
});

export const purchaseRequestFromPprTaskSchema = z.object({
  taskId: uuidSchema,
  description: z.string().trim().max(4000).optional().nullable(),
  items: z.array(purchaseRequestFromPprTaskItemSchema).min(1, "Выберите хотя бы одну позицию"),
});
