import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiSession } from "@/lib/api-auth";
import { writeAudit } from "@/lib/audit";
import { getPprTaskByIdForProfile } from "@/lib/ppr/queries";
import {
  buildPprTaskActor,
  canCancelPprTaskLifecycle,
  syncPprTaskPlanItemsStatus,
} from "@/lib/ppr/task-lifecycle";

const schema = z.object({
  reason: z.string().trim().min(3),
});

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
    const { reason } = schema.parse(await request.json());
    const { supabase, profile } = await getApiSession();
    if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const task = await getPprTaskByIdForProfile(supabase, profile, id);
    if (!task) return NextResponse.json({ error: "PPR task not found" }, { status: 404 });

    const actor = await buildPprTaskActor(supabase, profile);
    if (!canCancelPprTaskLifecycle(actor, task)) {
      return NextResponse.json({ error: "Нет прав на отмену ППР-заявки" }, { status: 403 });
    }

    const { data, error } = await supabase
      .from("ppr_tasks")
      .update({
        status: "cancelled",
        cancel_reason: reason,
        cancelled_by: profile.id,
      })
      .eq("id", id)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: "Не удалось отменить ППР-заявку" }, { status: 409 });
    }

    await syncPprTaskPlanItemsStatus(supabase, id, "cancelled");

    await writeAudit({
      actorId: profile.id,
      action: "cancel_ppr_task",
      entityType: "ppr_task",
      entityId: id,
      meta: {
        object_id: task.object_id,
        from: task.status,
        to: "cancelled",
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
