import { NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-auth";
import {
  DAILY_CHECKLIST_MAX_FILES_PER_UPLOAD,
  getDailyChecklistSignedUrls,
  uploadDailyChecklistAttachmentFile,
  validateDailyChecklistAttachmentFile,
} from "@/lib/daily-checklists/files";
import { getDailyChecklistItemRunForProfile } from "@/lib/daily-checklists/queries";
import type { DailyChecklistAttachment } from "@/lib/types";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { supabase, profile } = await getApiSession();
    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const bundle = await getDailyChecklistItemRunForProfile(supabase, profile, id);
    if (!bundle) {
      return NextResponse.json({ error: "Checklist item not found" }, { status: 404 });
    }
    if (bundle.run.profile_id !== profile.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const formData = await request.formData();
    const files = formData.getAll("files") as File[];
    if (!files.length) {
      return NextResponse.json({ error: "Файлы не переданы" }, { status: 400 });
    }
    if (files.length > DAILY_CHECKLIST_MAX_FILES_PER_UPLOAD) {
      return NextResponse.json({ error: `Максимум ${DAILY_CHECKLIST_MAX_FILES_PER_UPLOAD} фото за раз` }, { status: 400 });
    }

    for (const file of files) {
      const validationError = validateDailyChecklistAttachmentFile(file);
      if (validationError) {
        return NextResponse.json({ error: validationError }, { status: 400 });
      }
    }

    const uploaded: DailyChecklistAttachment[] = [];
    const errors: string[] = [];
    for (const file of files) {
      try {
        const meta = await uploadDailyChecklistAttachmentFile(supabase, file, profile.id, id);
        const { error: insertError } = await supabase.from("daily_checklist_item_attachments").insert({
          item_run_id: id,
          storage_path: meta.storage_path,
          file_name: meta.file_name,
          mime_type: meta.mime_type,
          size_bytes: meta.size_bytes,
          uploaded_by: profile.id,
        });
        if (insertError) throw new Error(insertError.message);

        const { data: row, error: rowError } = await supabase
          .from("daily_checklist_item_attachments")
          .select("id,item_run_id,storage_path,file_name,mime_type,size_bytes,uploaded_by,created_at,cleanup_after,deleted_at")
          .eq("storage_path", meta.storage_path)
          .single();
        if (rowError) throw new Error(rowError.message);

        const signedUrls = await getDailyChecklistSignedUrls(supabase, [meta.storage_path]);
        uploaded.push({
          ...(row as DailyChecklistAttachment),
          url: signedUrls[meta.storage_path] ?? null,
        });
      } catch (error) {
        errors.push(error instanceof Error ? error.message : `Ошибка загрузки «${file.name}»`);
      }
    }

    return NextResponse.json({ ok: true, uploaded, errors });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { supabase, profile } = await getApiSession();
    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const bundle = await getDailyChecklistItemRunForProfile(supabase, profile, id);
    if (!bundle) {
      return NextResponse.json({ error: "Checklist item not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, attachments: bundle.item.attachments ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
