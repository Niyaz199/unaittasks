import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiSession } from "@/lib/api-auth";
import { writeAudit } from "@/lib/audit";
import {
  buildObjectRoomImportDuplicateKey,
  OBJECT_ROOM_IMPORT_MAX_ROWS,
  type ObjectRoomImportErrorItem,
} from "@/lib/object-room-import";
import {
  buildObjectRoomImportValidationContext,
  validateObjectRoomImportRows,
} from "@/lib/object-room-import-server";

const commitSchema = z.object({
  rows: z.array(
    z.object({
      rowNumber: z.number().int().min(2),
      object: z.string(),
      floor: z.string(),
      name: z.string(),
      type: z.string(),
      status: z.string(),
      description: z.string(),
    })
  ).min(1).max(OBJECT_ROOM_IMPORT_MAX_ROWS),
});

function isUniqueViolation(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && String((error as { code?: string }).code) === "23505";
}

function revalidateObjectRoomPaths() {
  revalidatePath("/directories/floors");
  revalidatePath("/directories/room-types");
  revalidatePath("/ppr/rooms");
  revalidatePath("/ppr/equipment");
  revalidatePath("/rounds/config");
  revalidatePath("/rounds/today");
  revalidatePath("/rounds/archive");
  revalidatePath("/rounds/qr");
}

export async function POST(request: Request) {
  try {
    const { supabase, profile } = await getApiSession();
    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const payload = commitSchema.parse(body);
    const context = await buildObjectRoomImportValidationContext(supabase, profile);
    const validation = validateObjectRoomImportRows(context, payload.rows);

    const errors: ObjectRoomImportErrorItem[] = validation.rows
      .filter((row) => row.outcome === "error")
      .map((row) => ({ rowNumber: row.rowNumber, message: row.messages.join(" ") }));

    const existingRoomKeys = new Set(context.existingRoomKeys);
    let created = 0;
    let skipped = validation.summary.skippedCount;

    for (const row of validation.readyRows) {
      const duplicateKey = buildObjectRoomImportDuplicateKey(row.objectId, row.name);
      if (existingRoomKeys.has(duplicateKey)) {
        skipped += 1;
        continue;
      }

      try {
        const { data, error } = await supabase
          .from("object_rooms")
          .insert({
            object_id: row.objectId,
            name: row.name,
            floor: row.floorName,
            floor_id: row.floorId,
            room_type_id: row.roomTypeId,
            description: row.description,
            is_active: row.isActive,
          })
          .select("id")
          .single();

        if (error) throw error;

        existingRoomKeys.add(duplicateKey);
        created += 1;

        try {
          await writeAudit({
            actorId: profile.id,
            action: "create_object_room",
            entityType: "object_room",
            entityId: data.id,
            meta: {
              object_id: row.objectId,
              floor: row.floorName,
              floor_id: row.floorId,
              room_type_id: row.roomTypeId,
              source: "csv_import",
            },
            supabase,
          });
        } catch (auditError) {
          errors.push({
            rowNumber: row.rowNumber,
            message: auditError instanceof Error ? auditError.message : "Помещение создано, но запись аудита не сохранилась.",
          });
        }
      } catch (error) {
        if (isUniqueViolation(error)) {
          skipped += 1;
          continue;
        }

        errors.push({
          rowNumber: row.rowNumber,
          message: error instanceof Error ? error.message : "Не удалось создать помещение.",
        });
      }
    }

    if (created > 0) {
      revalidateObjectRoomPaths();
    }

    return NextResponse.json({
      ok: true,
      summary: {
        created,
        skipped,
        errors: errors.length,
      },
      errors,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
