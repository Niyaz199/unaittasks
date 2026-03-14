"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/audit";
import { getPprTaskByIdForProfile } from "@/lib/ppr/queries";
import {
  buildPprTaskActor,
  canClosePprTaskLifecycle,
  syncPprTaskPlanItemsStatus,
} from "@/lib/ppr/task-lifecycle";

function revalidateTaskPaths(taskId: string) {
  revalidatePath("/ppr/my");
  revalidatePath("/ppr/tasks");
  revalidatePath("/ppr/archive");
  revalidatePath("/ppr/calendar");
  revalidatePath(`/ppr/tasks/${taskId}`);
}

export async function closePprTaskAction(formData: FormData) {
  const taskId = String(formData.get("task_id") ?? "");
  const { profile } = await requireProfile();
  const supabase = await createSupabaseServerClient();

  const task = await getPprTaskByIdForProfile(supabase, profile, taskId);
  if (!task) {
    throw new Error("ППР-заявка не найдена");
  }

  const actor = await buildPprTaskActor(supabase, profile);
  if (!canClosePprTaskLifecycle(actor, task)) {
    throw new Error("Нет прав на закрытие ППР-заявки");
  }

  const { data, error } = await supabase
    .from("ppr_tasks")
    .update({ status: "closed" })
    .eq("id", taskId)
    .eq("status", "done")
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new Error("ППР-заявка больше не находится в статусе `done`");
  }

  await syncPprTaskPlanItemsStatus(supabase, taskId, "closed");

  await writeAudit({
    actorId: profile.id,
    action: "close_ppr_task",
    entityType: "ppr_task",
    entityId: taskId,
    meta: {
      object_id: task.object_id,
      from: task.status,
      to: "closed",
    },
  });

  revalidateTaskPaths(taskId);
}
