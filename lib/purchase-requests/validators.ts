import { z } from "zod";

const uuidSchema = z.string().uuid();

export const purchaseRequestStatusSchema = z.enum(["new", "in_progress", "fulfilled", "cancelled"]);

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
