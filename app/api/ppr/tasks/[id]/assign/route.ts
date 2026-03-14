import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiSession } from "@/lib/api-auth";
import { writeAudit } from "@/lib/audit";
import { getPprTaskByIdForProfile } from "@/lib/ppr/queries";
import {
  assertPprTaskAssigneeCandidate,
  buildPprTaskActor,
  canAssignPprTaskExecutor,
} from "@/lib/ppr/task-lifecycle";

const schema = z.object({
  assigneeId: z.string().uuid().nullable(),
});

function revalidateTaskPaths(taskId: string) {
  revalidatePath("/ppr/my");
  revalidatePath("/ppr/tasks");
  revalidatePath("/ppr/archive");
  revalidatePath(`/ppr/tasks/${taskId}`);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const payload = schema.parse(await request.json());
    const { supabase, profile } = await getApiSession();
    if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const task = await getPprTaskByIdForProfile(supabase, profile, id);
    if (!task) return NextResponse.json({ error: "PPR task not found" }, { status: 404 });

    const actor = await buildPprTaskActor(supabase, profile);
    if (!canAssignPprTaskExecutor(actor, task)) {
      return NextResponse.json({ error: "Нет прав на назначение исполнителя" }, { status: 403 });
    }

    let assigneeMeta: Record<string, unknown> = { assignee_id: null };
    if (payload.assigneeId) {
      const assignee = await assertPprTaskAssigneeCandidate(supabase, payload.assigneeId, task.object_id);
      assigneeMeta = {
        assignee_id: assignee.id,
        assignee_name: assignee.full_name,
        assignee_role: assignee.role,
      };
    }

    const { data, error } = await supabase
      .from("ppr_tasks")
      .update({ assignee_id: payload.assigneeId })
      .eq("id", id)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: "Не удалось обновить исполнителя ППР-заявки" }, { status: 409 });
    }

    await writeAudit({
      actorId: profile.id,
      action: "assign_ppr_task",
      entityType: "ppr_task",
      entityId: id,
      meta: {
        object_id: task.object_id,
        previous_assignee_id: task.assignee_id,
        ...assigneeMeta,
      },
    });

    revalidateTaskPaths(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
