import { NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-auth";
import { writeAudit } from "@/lib/audit";
import { canArchiveTask } from "@/lib/task-permissions";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { supabase, profile } = await getApiSession();
    if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: task } = await supabase
      .from("tasks")
      .select("id,status,archived_at")
      .eq("id", id)
      .single();
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    if (!canArchiveTask(profile.role, task)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { error, data } = await supabase
      .from("tasks")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", id)
      .eq("status", "done")
      .is("archived_at", null)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Task not eligible for archive" }, { status: 409 });

    await writeAudit({
      actorId: profile.id,
      action: "task_archived_manual",
      entityType: "task",
      entityId: id,
      meta: { status: task.status }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
