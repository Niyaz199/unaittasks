import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
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

export async function POST(request: Request) {
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

    if (!roomId || !clientEventId || !scannedAtDevice) {
      return NextResponse.json({ error: "room_id, client_event_id и scanned_at_device обязательны" }, { status: 400 });
    }
    if (comment.length > ROUNDS_MAX_COMMENT_LENGTH) {
      return NextResponse.json({ error: `Комментарий не должен превышать ${ROUNDS_MAX_COMMENT_LENGTH} символов` }, { status: 400 });
    }

    let uploadedPhoto: {
      storage_path: string;
      file_name: string;
      mime_type: string;
      size_bytes: number;
    } | null = null;

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
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
