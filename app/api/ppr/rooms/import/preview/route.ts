import { NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-auth";
import {
  buildObjectRoomImportPreviewResponse,
  buildObjectRoomImportValidationContext,
  parseObjectRoomImportFile,
  validateObjectRoomImportFile,
  validateObjectRoomImportRows,
} from "@/lib/object-room-import-server";

export async function POST(request: Request) {
  try {
    const { supabase, profile } = await getApiSession();
    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Файл не передан." }, { status: 400 });
    }

    const validationError = validateObjectRoomImportFile(file);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const parsed = await parseObjectRoomImportFile(file);
    const context = await buildObjectRoomImportValidationContext(supabase, profile);
    const validation = validateObjectRoomImportRows(context, parsed.rows, parsed.presetErrorsByRowNumber);

    return NextResponse.json(buildObjectRoomImportPreviewResponse(file.name, validation));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
