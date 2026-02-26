import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiSession } from "@/lib/api-auth";
import { canChangeStatus } from "@/lib/task-permissions";

const schema = z.object({
  reason: z.string().trim().min(5),
  resumeAt: z.string().datetime()
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { reason, resumeAt } = schema.parse(await request.json());
    const resumeDate = new Date(resumeAt);
    if (Number.isNaN(resumeDate.getTime()) || resumeDate.getTime() <= Date.now()) {
      return NextResponse.json({ error: "resume_at должен быть в будущем" }, { status: 400 });
    }

    const { supabase, profile } = await getApiSession();
    if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: task } = await supabase
      .from("tasks")
      .select("id,status,assigned_to,created_by,object_id,team_members:task_team_members(user_id)")
      .eq("id", id)
      .single();
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    const teamMemberIds = (task.team_members ?? []).map((member) => member.user_id);
    const canPause = canChangeStatus(task, { id: profile.id, role: profile.role }, { teamMemberIds });
    if (!canPause) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { data, error } = await supabase.rpc("pause_task", {
      p_task_id: id,
      p_reason: reason,
      p_resume_at: resumeDate.toISOString()
    });
    if (error) throw error;

    return NextResponse.json({ ok: true, result: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
