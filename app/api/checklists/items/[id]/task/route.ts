import { NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-auth";
import { getDailyChecklistItemRunForProfile, recomputeDailyChecklistRunStatus } from "@/lib/daily-checklists/queries";
import { createTaskFromPayload, taskCreateSchema } from "@/lib/task-create";

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

    const rawBody = (await request.json()) as Record<string, unknown>;
    const payload = taskCreateSchema.parse({
      title: rawBody.title,
      description: rawBody.description,
      objectId: rawBody.objectId,
      priority: rawBody.priority,
      dueAt: rawBody.dueAt,
      assignedTo: rawBody.assignedTo,
      teamMemberIds: Array.isArray(rawBody.teamMemberIds) ? rawBody.teamMemberIds : [],
    });

    const task = await createTaskFromPayload({
      supabase,
      actor: profile,
      payload,
      extraAuditMeta: {
        source: "daily_checklist",
        checklist_item_run_id: id,
      },
    });

    const now = new Date().toISOString();
    const { error: linkError } = await supabase
      .from("daily_checklist_item_runs")
      .update({
        linked_task_id: task.taskId,
        linked_object_id: payload.objectId,
        status: "problem",
        completed_at: bundle.item.completed_at ?? now,
        completed_by: bundle.item.completed_by ?? profile.id,
        updated_at: now,
      })
      .eq("id", id);
    if (linkError) {
      return NextResponse.json({ error: linkError.message }, { status: 400 });
    }

    await recomputeDailyChecklistRunStatus(supabase, bundle.run.id);
    return NextResponse.json({ ok: true, taskId: task.taskId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
