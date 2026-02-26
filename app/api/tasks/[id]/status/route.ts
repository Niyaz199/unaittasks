import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiSession } from "@/lib/api-auth";
import { writeAudit } from "@/lib/audit";
import { canChangeStatus } from "@/lib/task-permissions";

const schema = z.object({
  status: z.enum(["new", "in_progress", "paused", "done"])
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { status } = schema.parse(await request.json());
    if (status === "paused") {
      return NextResponse.json(
        { error: "Для постановки на паузу используйте отдельное действие с причиной и датой восстановления" },
        { status: 400 }
      );
    }
    const { supabase, profile } = await getApiSession();
    if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: task } = await supabase
      .from("tasks")
      .select("id,status,assigned_to,accepted_at,completed_at,created_by,object_id,team_members:task_team_members(user_id)")
      .eq("id", id)
      .single();
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    const teamMemberIds = (task.team_members ?? []).map((member) => member.user_id);
    const canChange = canChangeStatus(task, { id: profile.id, role: profile.role }, { teamMemberIds });
    if (!canChange) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const patch: Record<string, unknown> = { status };
    if (status === "in_progress" && !task.accepted_at) patch.accepted_at = new Date().toISOString();
    if (status === "done" && !task.completed_at) patch.completed_at = new Date().toISOString();
    patch.resume_at = null;

    const { error } = await supabase.from("tasks").update(patch).eq("id", id);
    if (error) throw error;

    await writeAudit({
      actorId: profile.id,
      action: "status_change",
      entityType: "task",
      entityId: id,
      meta: { from: task.status, to: status }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
