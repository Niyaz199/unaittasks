import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-auth";
import { getPprSignedUrls, PPR_MAX_FILES_PER_UPLOAD, uploadPprTaskAttachmentFile, validatePprAttachmentFile } from "@/lib/ppr/files";
import { getPprTaskByIdForProfile, listPprTaskAttachmentsForProfile } from "@/lib/ppr/queries";
import { buildPprTaskActor, canUploadPprTaskAttachment } from "@/lib/ppr/task-lifecycle";

function revalidateTaskPaths(taskId: string) {
  revalidatePath("/ppr/my");
  revalidatePath("/ppr/tasks");
  revalidatePath("/ppr/archive");
  revalidatePath(`/ppr/tasks/${taskId}`);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: taskId } = await params;
    const { supabase, profile } = await getApiSession();
    if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const task = await getPprTaskByIdForProfile(supabase, profile, taskId);
    if (!task) return NextResponse.json({ error: "PPR task not found" }, { status: 404 });

    const actor = await buildPprTaskActor(supabase, profile);
    if (!canUploadPprTaskAttachment(actor, task)) {
      return NextResponse.json({ error: "Нет прав на загрузку фото к ППР-заявке" }, { status: 403 });
    }

    const formData = await request.formData();
    const commentIdRaw = formData.get("comment_id");
    const commentId = typeof commentIdRaw === "string" && commentIdRaw.trim() ? commentIdRaw : null;
    const files = formData.getAll("files") as File[];

    if (!files.length) {
      return NextResponse.json({ error: "Файлы не переданы" }, { status: 400 });
    }
    if (files.length > PPR_MAX_FILES_PER_UPLOAD) {
      return NextResponse.json({ error: `Максимум ${PPR_MAX_FILES_PER_UPLOAD} фото за раз` }, { status: 400 });
    }

    if (commentId) {
      const { count, error: commentError } = await supabase
        .from("ppr_task_comments")
        .select("id", { count: "exact", head: true })
        .eq("id", commentId)
        .eq("task_id", taskId);
      if (commentError) throw commentError;
      if ((count ?? 0) === 0) {
        return NextResponse.json({ error: "Комментарий не принадлежит ППР-заявке" }, { status: 400 });
      }
    }

    for (const file of files) {
      const validationError = validatePprAttachmentFile(file);
      if (validationError) {
        return NextResponse.json({ error: validationError }, { status: 400 });
      }
    }

    const uploaded = [];
    const errors: string[] = [];

    for (const file of files) {
      try {
        const meta = await uploadPprTaskAttachmentFile(supabase, file, profile.id, taskId);
        const { data: row, error } = await supabase
          .from("ppr_task_attachments")
          .insert({
            object_id: task.object_id,
            task_id: taskId,
            comment_id: commentId,
            storage_path: meta.storage_path,
            file_name: meta.file_name,
            mime_type: meta.mime_type,
            size_bytes: meta.size_bytes,
            uploaded_by: profile.id,
          })
          .select("id,object_id,task_id,comment_id,storage_path,file_name,mime_type,size_bytes,uploaded_by,created_at")
          .single();
        if (error) throw error;
        uploaded.push(row);
      } catch (error) {
        errors.push(error instanceof Error ? error.message : `Ошибка загрузки файла ${file.name}`);
      }
    }

    revalidateTaskPaths(taskId);
    return NextResponse.json({ ok: true, uploaded, errors });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: taskId } = await params;
    const { supabase, profile } = await getApiSession();
    if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(request.url);
    const commentId = url.searchParams.get("comment_id");
    const attachments = await listPprTaskAttachmentsForProfile(supabase, profile, taskId, { commentId });
    const signedUrls = await getPprSignedUrls(
      supabase,
      attachments.map((item) => item.storage_path)
    );

    return NextResponse.json({
      ok: true,
      attachments: attachments.map((item) => ({
        ...item,
        url: signedUrls[item.storage_path] ?? null,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
