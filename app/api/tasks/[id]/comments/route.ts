import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiSession } from "@/lib/api-auth";
import { writeAudit } from "@/lib/audit";
import { canReadTaskByRole } from "@/lib/task-permissions";
import { sendPushToUser } from "@/lib/push";

const schema = z.object({
  body: z.string().min(1),
  clientMsgId: z.string().optional()
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { body, clientMsgId } = schema.parse(await request.json());
    const { supabase, profile } = await getApiSession();
    if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    type TaskRow = {
      id: string;
      title: string;
      assigned_to: string;
      created_by: string;
      object_id: string;
      objects: { name: string; object_engineer_id: string | null } | Array<{ name: string; object_engineer_id: string | null }> | null;
      team_members: Array<{ user_id: string }> | null;
    };

    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .select("id, title, assigned_to, created_by, object_id, objects(name, object_engineer_id), team_members:task_team_members(user_id)")
      .eq("id", id)
      .single();
    if (taskError) console.error("[comments] task fetch error:", taskError);
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    const row = task as unknown as TaskRow;

    console.log("[comments] raw task row:", {
      id: row.id,
      title: row.title,
      assigned_to: row.assigned_to,
      created_by: row.created_by,
      team_members: row.team_members,
    });

    const teamMemberIds = (row.team_members ?? []).map((member) => member.user_id);
    const objectsRelation = row.objects;
    const objectName = Array.isArray(objectsRelation)
      ? objectsRelation[0]?.name ?? null
      : objectsRelation?.name ?? null;
    const objectEngineerId = Array.isArray(objectsRelation)
      ? objectsRelation[0]?.object_engineer_id ?? null
      : objectsRelation?.object_engineer_id ?? null;

    const canRead = canReadTaskByRole(profile.role, profile.id, row, teamMemberIds, objectEngineerId);
    if (!canRead) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (clientMsgId) {
      const { data: existing } = await supabase
        .from("task_comments")
        .select("id")
        .eq("task_id", id)
        .eq("author_id", profile.id)
        .eq("client_msg_id", clientMsgId)
        .maybeSingle();
      if (existing) return NextResponse.json({ ok: true, deduped: true });
    }

    const { data, error } = await supabase
      .from("task_comments")
      .insert({
        task_id: id,
        author_id: profile.id,
        body: body.trim(),
        client_msg_id: clientMsgId ?? null
      })
      .select("id")
      .single();
    if (error) throw error;

    await writeAudit({
      actorId: profile.id,
      action: "comment",
      entityType: "comment",
      entityId: data.id,
      meta: { task_id: id }
    });

    // Notify all task observers except the comment author
    void sendCommentPushes({
      taskId: id,
      taskTitle: row.title,
      objectName,
      actorName: profile.full_name,
      actorId: profile.id,
      assignedTo: row.assigned_to,
      createdBy: row.created_by,
      teamMemberIds,
      commentBody: body.trim(),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

type CommentPushParams = {
  taskId: string;
  taskTitle: string;
  objectName: string | null;
  actorName: string;
  actorId: string;
  assignedTo: string;
  createdBy: string;
  teamMemberIds: string[];
  commentBody: string;
};

async function sendCommentPushes(p: CommentPushParams) {
  const candidates = [p.assignedTo, p.createdBy, ...p.teamMemberIds];
  const observers = [...new Set(candidates)].filter(
    (uid): uid is string => typeof uid === "string" && uid.length > 0 && uid !== p.actorId
  );

  console.log("[comments push] actorId:", p.actorId);
  console.log("[comments push] assigned_to:", p.assignedTo);
  console.log("[comments push] created_by:", p.createdBy);
  console.log("[comments push] teamMemberIds:", p.teamMemberIds);
  console.log("[comments push] finalRecipients:", observers);

  if (!observers.length) {
    console.log("[comments push] no recipients, skipping");
    return;
  }

  const titlePrefix = p.objectName ? `[${p.objectName}] ` : "";
  const bodySnippet = p.commentBody.length > 100
    ? p.commentBody.slice(0, 100).trimEnd() + "…"
    : p.commentBody;

  const pushPayload = {
    title: `${titlePrefix}${p.taskTitle}`,
    body: `${p.actorName}: ${bodySnippet}`,
    url: `/tasks/${p.taskId}`,
  };

  const results = await Promise.allSettled(observers.map((uid) => sendPushToUser(uid, pushPayload)));
  results.forEach((r, i) => {
    if (r.status === "rejected") {
      console.error(`[comments push] failed for uid=${observers[i]}:`, r.reason);
    } else {
      console.log(`[comments push] result for uid=${observers[i]}:`, r.value);
    }
  });
}
