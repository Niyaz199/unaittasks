import { NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-auth";
import { canReadTaskByRole } from "@/lib/task-permissions";
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  MAX_FILES_PER_UPLOAD,
  uploadAttachmentFile,
  saveAttachmentMeta,
  getSignedUrls
} from "@/lib/attachments";
import type { TaskAttachment } from "@/lib/types";

type TaskRow = {
  id: string;
  assigned_to: string;
  created_by: string;
  object_id: string;
  objects: { object_engineer_id: string | null } | Array<{ object_engineer_id: string | null }> | null;
  team_members: Array<{ user_id: string }> | null;
};

async function getTaskRow(supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createSupabaseServerClient>>, id: string): Promise<TaskRow | null> {
  const { data } = await supabase
    .from("tasks")
    .select("id,assigned_to,created_by,object_id,objects(object_engineer_id),team_members:task_team_members(user_id)")
    .eq("id", id)
    .single();
  return data as TaskRow | null;
}

/** POST /api/tasks/[id]/attachments — загрузить фото к задаче или комментарию */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: taskId } = await params;
    const { supabase, profile } = await getApiSession();
    if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const task = await getTaskRow(supabase, taskId);
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    const teamMemberIds = (task.team_members ?? []).map((m) => m.user_id);
    const objectEngineerId = Array.isArray(task.objects)
      ? task.objects[0]?.object_engineer_id ?? null
      : task.objects?.object_engineer_id ?? null;

    const canRead = canReadTaskByRole(profile.role, profile.id, task, teamMemberIds, objectEngineerId);
    if (!canRead) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const formData = await request.formData();
    const commentId = formData.get("comment_id");
    const files = formData.getAll("files") as File[];

    if (!files.length) {
      return NextResponse.json({ error: "Файлы не переданы" }, { status: 400 });
    }
    if (files.length > MAX_FILES_PER_UPLOAD) {
      return NextResponse.json({ error: `Максимум ${MAX_FILES_PER_UPLOAD} фото за раз` }, { status: 400 });
    }

    // Валидация всех файлов перед загрузкой
    for (const file of files) {
      if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
        return NextResponse.json(
          { error: `Неподдерживаемый тип файла «${file.name}». Разрешены только JPEG, PNG, WebP.` },
          { status: 400 }
        );
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        return NextResponse.json(
          { error: `Файл «${file.name}» превышает лимит 5 MB.` },
          { status: 400 }
        );
      }
    }

    const uploaded: TaskAttachment[] = [];
    const errors: string[] = [];

    for (const file of files) {
      try {
        const meta = await uploadAttachmentFile(supabase, file, profile.id, taskId);
        await saveAttachmentMeta(supabase, {
          ...meta,
          task_id: taskId,
          comment_id: typeof commentId === "string" ? commentId : null,
          uploaded_by: profile.id
        });
        const { data: row } = await supabase
          .from("task_attachments")
          .select("id,task_id,comment_id,storage_path,file_name,mime_type,size_bytes,uploaded_by,created_at,cleanup_after")
          .eq("storage_path", meta.storage_path)
          .single();
        if (row) uploaded.push(row as TaskAttachment);
      } catch (err) {
        errors.push(err instanceof Error ? err.message : `Ошибка загрузки «${file.name}»`);
      }
    }

    return NextResponse.json({ ok: true, uploaded, errors });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/** GET /api/tasks/[id]/attachments — получить signed URLs для вложений задачи */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: taskId } = await params;
    const { supabase, profile } = await getApiSession();
    if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const task = await getTaskRow(supabase, taskId);
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    const teamMemberIds = (task.team_members ?? []).map((m) => m.user_id);
    const objectEngineerId = Array.isArray(task.objects)
      ? task.objects[0]?.object_engineer_id ?? null
      : task.objects?.object_engineer_id ?? null;

    const canRead = canReadTaskByRole(profile.role, profile.id, task, teamMemberIds, objectEngineerId);
    if (!canRead) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const url = new URL(request.url);
    const commentId = url.searchParams.get("comment_id");

    let query = supabase
      .from("task_attachments")
      .select("id,task_id,comment_id,storage_path,file_name,mime_type,size_bytes,uploaded_by,created_at,cleanup_after")
      .eq("task_id", taskId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    if (commentId) {
      query = query.eq("comment_id", commentId);
    } else {
      query = query.is("comment_id", null);
    }

    const { data: attachments } = await query;
    const paths = (attachments ?? []).map((a) => (a as TaskAttachment).storage_path);
    const signedUrls = await getSignedUrls(supabase, paths);

    const result = (attachments ?? []).map((a) => ({
      ...(a as TaskAttachment),
      url: signedUrls[(a as TaskAttachment).storage_path] ?? null
    }));

    return NextResponse.json({ ok: true, attachments: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
