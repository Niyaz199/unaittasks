import { z } from "zod";

const uuidSchema = z.string().uuid();

export const stockItemKindSchema = z.enum(["zip", "component"]);
export const stockMovementTypeSchema = z.enum(["receipt", "issue", "adjustment_in", "adjustment_out"]);
export const procurementMethodSchema = z.enum(["engineer", "procurement"]);

export const pprTemplateLinkSchema = z.object({
  templateId: uuidSchema,
  requiredQty: z.coerce.number().positive(),
});

export const stockItemFormSchema = z.object({
  objectId: uuidSchema,
  name: z.string().trim().min(2),
  kind: stockItemKindSchema.default("zip"),
  isSparePart: z.boolean().default(false),
  procurementMethod: procurementMethodSchema.default("engineer"),
  unit: z.string().trim().min(1).max(20),
  sku: z.string().trim().max(120).optional().nullable(),
  manufacturer: z.string().trim().max(200).optional().nullable(),
  model: z.string().trim().max(200).optional().nullable(),
  description: z.string().trim().max(4000).optional().nullable(),
  minQty: z.coerce.number().min(0),
  storageLocationId: z.string().uuid().optional().nullable(),
  systemGroupIds: z.array(uuidSchema).default([]),
  pprTemplateLinks: z.array(pprTemplateLinkSchema).default([]),
  initialQty: z.coerce.number().min(0).optional().nullable(),
  comment: z.string().trim().max(4000).optional().nullable(),
  isActive: z.boolean().default(true),
}).superRefine((payload, ctx) => {
  const needsStorage = payload.kind === "zip" || (payload.kind === "component" && payload.isSparePart);
  if (needsStorage && !payload.storageLocationId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["storageLocationId"],
      message: "Для ЗИП нужно указать место хранения.",
    });
  }

  if (!needsStorage && payload.storageLocationId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["storageLocationId"],
      message: "Место хранения указывается только для ЗИП-компонента или отдельного ЗИП.",
    });
  }
});

export const stockLocationFormSchema = z.object({
  objectId: uuidSchema,
  systemId: uuidSchema,
  roomId: uuidSchema,
  name: z.string().trim().min(2),
  description: z.string().trim().max(2000).optional().nullable(),
  isActive: z.boolean().default(true),
});

export const stockMovementFormSchema = z.object({
  objectId: uuidSchema,
  itemId: uuidSchema,
  locationId: uuidSchema,
  movementType: stockMovementTypeSchema,
  quantity: z.coerce.number().positive(),
  note: z.string().trim().max(2000).optional().nullable(),
});

export const pprTaskCloseWriteoffItemSchema = z.object({
  stockItemId: uuidSchema,
  quantity: z.coerce.number().positive(),
});

export const pprTaskCloseWriteoffSchema = z
  .object({
    taskId: uuidSchema,
    skip: z.boolean().default(false),
    items: z.array(pprTaskCloseWriteoffItemSchema).default([]),
  })
  .superRefine((payload, ctx) => {
    if (!payload.skip && payload.items.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["items"],
        message: "Отметьте хотя бы одну позицию или включите «Ничего не расходовалось».",
      });
    }
  });

export const equipmentComponentFormSchema = z.object({
  equipmentId: uuidSchema,
  stockItemId: uuidSchema,
  quantity: z.coerce.number().positive(),
  reserveQty: z.coerce.number().min(0),
  isCritical: z.boolean().default(false),
  note: z.string().trim().max(2000).optional().nullable(),
});
