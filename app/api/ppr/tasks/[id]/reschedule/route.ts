import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiSession } from "@/lib/api-auth";
import { writeAudit } from "@/lib/audit";
import { getPprTaskByIdForProfile } from "@/lib/ppr/queries";
import {
  buildPprTaskActor,
  calculatePprTaskOverdueAfterReschedule,
  canReschedulePprTaskLifecycle,
  syncPprTaskPlanItemsPlannedFor,
} from "@/lib/ppr/task-lifecycle";

const schema = z.object({
  plannedFor: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().trim().min(3),
});

function assertSamePlanMonth(currentPlannedFor: string, nextPlannedFor: string) {
  if (currentPlannedFor.slice(0, 7) !== nextPlannedFor.slice(0, 7)) {
    throw new Error("Перенос ППР-заявки допускается только внутри текущего месяца");
  }
}

function revalidateTaskPaths(taskId: string) {
  revalidatePath("/ppr/my");
  revalidatePath("/ppr/tasks");
  revalidatePath("/ppr/archive");
  revalidatePath("/ppr/calendar");
  revalidatePath(`/ppr/tasks/${taskId}`);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { plannedFor, reason } = schema.parse(await request.json());
    const { supabase, profile } = await getApiSession();
    if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const task = await getPprTaskByIdForProfile(supabase, profile, id);
    if (!task) return NextResponse.json({ error: "PPR task not found" }, { status: 404 });

    const actor = await buildPprTaskActor(supabase, profile);
    if (!canReschedulePprTaskLifecycle(actor, task)) {
      return NextResponse.json({ error: "Нет прав на перенос ППР-заявки" }, { status: 403 });
    }
    if (plannedFor === task.planned_for) {
      return NextResponse.json({ error: "Новая плановая дата совпадает с текущей" }, { status: 400 });
    }
    assertSamePlanMonth(task.planned_for, plannedFor);

    const { data, error } = await supabase
      .from("ppr_tasks")
      .update({
        planned_for: plannedFor,
        is_rescheduled: true,
        is_overdue: calculatePprTaskOverdueAfterReschedule(task.planned_for, plannedFor),
      })
      .eq("id", id)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: "Не удалось перенести ППР-заявку" }, { status: 409 });
    }

    await syncPprTaskPlanItemsPlannedFor(supabase, task, plannedFor);

    await writeAudit({
      actorId: profile.id,
      action: "reschedule_ppr_task",
      entityType: "ppr_task",
      entityId: id,
      meta: {
        object_id: task.object_id,
        previous_planned_for: task.planned_for,
        planned_for: plannedFor,
        reason,
      },
    });

    revalidateTaskPaths(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
