import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiSession } from "@/lib/api-auth";
import { ROUNDS_MAX_COMMENT_LENGTH } from "@/lib/rounds/constants";
import { uploadRoundsPhoto, validateRoundsPhoto } from "@/lib/rounds/files";
import { canUseRoundsScanner } from "@/lib/rounds/permissions";
import { upsertRoundsCheckin } from "@/lib/rounds/queries";

function revalidateRoundsPaths() {
  revalidatePath("/rounds");
  revalidatePath("/rounds/today");
  revalidatePath("/rounds/archive");
  revalidatePath("/rounds/scan");
}

const checkinSchema = z.object({
  roomId: z.string().uuid("room_id должен быть корректным UUID"),
  clientEventId: z.string().uuid("client_event_id должен быть корректным UUID"),
  scannedAtDevice: z.string().datetime({ offset: true, message: "scanned_at_device должен быть корректной датой ISO" }),
  comment: z.string().max(ROUNDS_MAX_COMMENT_LENGTH, `Комментарий не должен превышать ${ROUNDS_MAX_COMMENT_LENGTH} символов`),
  source: z.string().trim().min(1).max(50),
});

function extractApiErrorMessage(error: unknown, fallback = "Не удалось сохранить отметку обхода") {
  if (typeof error === "string" && error.trim()) return error.trim();
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  if (typeof error === "object" && error) {
    for (const key of ["message", "error", "details", "hint"] as const) {
      const value = key in error ? (error as Record<string, unknown>)[key] : null;
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }
  }
  return fallback;
}

export async function POST(request: Request) {
  let uploadedPhoto: {
    storage_path: string;
    file_name: string;
    mime_type: string;
    size_bytes: number;
  } | null = null;

  try {
    const { supabase, profile } = await getApiSession();
    if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!canUseRoundsScanner(profile.role)) {
      return NextResponse.json({ error: "Недостаточно прав для отметки обхода" }, { status: 403 });
    }

    const formData = await request.formData();
    const roomId = String(formData.get("room_id") ?? "");
    const clientEventId = String(formData.get("client_event_id") ?? "");
    const scannedAtDevice = String(formData.get("scanned_at_device") ?? "");
    const comment = String(formData.get("comment") ?? "").trim();
    const source = String(formData.get("source") ?? "pwa");
    const photoField = formData.get("photo");
    const photo = photoField instanceof File && photoField.size > 0 ? photoField : null;

    const payload = checkinSchema.safeParse({
      roomId,
      clientEventId,
      scannedAtDevice,
      comment,
      source,
    });
    if (!payload.success) {
      return NextResponse.json(
        {
          error: payload.error.issues[0]?.message ?? "Некорректные данные отметки обхода",
          details: payload.error.flatten(),
        },
        { status: 400 }
      );
    }

    if (photo) {
      const validationError = validateRoundsPhoto(photo);
      if (validationError) {
        return NextResponse.json({ error: validationError }, { status: 400 });
      }
      uploadedPhoto = await uploadRoundsPhoto(supabase, photo, profile.id, roomId);
    }

    const result = await upsertRoundsCheckin(supabase, {
      roomId,
      clientEventId,
      scannedAtDevice,
      comment,
      photo: uploadedPhoto,
      source,
    });

    if (!result) {
      return NextResponse.json({ error: "Не удалось сохранить отметку обхода" }, { status: 400 });
    }

    if (!result.was_applied && uploadedPhoto?.storage_path) {
      await supabase.storage.from("rounds-files").remove([uploadedPhoto.storage_path]);
    }

    revalidateRoundsPaths();
    return NextResponse.json({ ok: true, checkin: result });
  } catch (error) {
    try {
      if (uploadedPhoto?.storage_path) {
        const { supabase } = await getApiSession();
        await supabase.storage.from("rounds-files").remove([uploadedPhoto.storage_path]);
      }
    } catch {
      // ignore storage cleanup failures and return the original business error
    }

    const message = extractApiErrorMessage(error);
    const details =
      typeof error === "object" && error && "details" in error && typeof (error as { details?: unknown }).details === "string"
        ? (error as { details: string }).details
        : null;
    const hint =
      typeof error === "object" && error && "hint" in error && typeof (error as { hint?: unknown }).hint === "string"
        ? (error as { hint: string }).hint
        : null;
    return NextResponse.json({ error: message, details, hint }, { status: 400 });
  }
}
