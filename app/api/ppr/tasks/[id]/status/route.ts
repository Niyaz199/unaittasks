import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiSession } from "@/lib/api-auth";
import { writeAudit } from "@/lib/audit";
import { getPprTaskByIdForProfile, getPprTaskCompletionEvidenceForProfile } from "@/lib/ppr/queries";
import {
  buildPprTaskActor,
  canCompletePprTask,
  canStartPprTask,
} from "@/lib/ppr/task-lifecycle";

const schema = z.object({
  status: z.enum(["in_progress", "done"]),
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
    const { status } = schema.parse(await request.json());
    const { supabase, profile } = await getApiSession();
    if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const task = await getPprTaskByIdForProfile(supabase, profile, id);
    if (!task) return NextResponse.json({ error: "PPR task not found" }, { status: 404 });

    const actor = await buildPprTaskActor(supabase, profile);
    const allowed =
      status === "in_progress" ? canStartPprTask(actor, task) : canCompletePprTask(actor, task);
    if (!allowed) {
      return NextResponse.json({ error: "Недопустимый переход статуса для текущего пользователя" }, { status: 403 });
    }

    if (status === "done") {
      const evidence = await getPprTaskCompletionEvidenceForProfile(supabase, profile, id);
      if (!evidence) {
        return NextResponse.json({ error: "PPR task not found" }, { status: 404 });
      }
      if (evidence.commentsCount < 1 || evidence.attachmentsCount < 1) {
        return NextResponse.json(
          { error: "Для перевода ППР-заявки в `done` нужен минимум один комментарий и одно фото." },
          { status: 400 }
        );
      }
    }

    const { data, error } = await supabase
      .from("ppr_tasks")
      .update({ status })
      .eq("id", id)
      .eq("status", task.status)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: "Статус ППР-заявки уже изменился" }, { status: 409 });
    }

    await writeAudit({
      actorId: profile.id,
      action: status === "in_progress" ? "start_ppr_task" : "complete_ppr_task",
      entityType: "ppr_task",
      entityId: id,
      meta: {
        object_id: task.object_id,
        from: task.status,
        to: status,
      },
    });

    revalidateTaskPaths(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
