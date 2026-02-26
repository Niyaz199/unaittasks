import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiSession } from "@/lib/api-auth";
import { writeAudit } from "@/lib/audit";
import { canReadTaskByRole } from "@/lib/task-permissions";

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

    const { data: task } = await supabase
      .from("tasks")
      .select("id,assigned_to,created_by,object_id,team_members:task_team_members(user_id),objects(object_engineer_id)")
      .eq("id", id)
      .single();
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    const teamMemberIds = (task.team_members ?? []).map((member) => member.user_id);
    const objectsRelation = task.objects as
      | { object_engineer_id: string | null }
      | Array<{ object_engineer_id: string | null }>
      | null;
    const objectEngineerId = Array.isArray(objectsRelation)
      ? objectsRelation[0]?.object_engineer_id ?? null
      : objectsRelation?.object_engineer_id ?? null;
    const canRead = canReadTaskByRole(profile.role, profile.id, task, teamMemberIds, objectEngineerId);
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

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
