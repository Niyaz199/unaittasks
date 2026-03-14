import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiSession } from "@/lib/api-auth";
import { writeAudit } from "@/lib/audit";
import { getPprTaskByIdForProfile } from "@/lib/ppr/queries";
import { buildPprTaskActor, canAddPprTaskComment } from "@/lib/ppr/task-lifecycle";

const schema = z.object({
  body: z.string().trim().min(1),
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
    const { body } = schema.parse(await request.json());
    const { supabase, profile } = await getApiSession();
    if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const task = await getPprTaskByIdForProfile(supabase, profile, id);
    if (!task) return NextResponse.json({ error: "PPR task not found" }, { status: 404 });

    const actor = await buildPprTaskActor(supabase, profile);
    if (!canAddPprTaskComment(actor, task)) {
      return NextResponse.json({ error: "Нет прав на добавление комментария к ППР-заявке" }, { status: 403 });
    }

    const { data, error } = await supabase
      .from("ppr_task_comments")
      .insert({
        object_id: task.object_id,
        task_id: id,
        author_id: profile.id,
        body: body.trim(),
      })
      .select("id")
      .single();
    if (error) throw error;

    await writeAudit({
      actorId: profile.id,
      action: "comment",
      entityType: "ppr_task",
      entityId: id,
      meta: {
        comment_id: data.id,
      },
    });

    revalidateTaskPaths(id);
    return NextResponse.json({ ok: true, commentId: data.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
