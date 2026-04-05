import type { SupabaseClient } from "@supabase/supabase-js";
import { getPprSignedUrls } from "@/lib/ppr/files";
import { getPprTaskByIdForProfile } from "@/lib/ppr/task-queries";
import type { PprTaskAttachment } from "@/lib/ppr/types";
import type { Profile } from "@/lib/types";

export type PprTaskAttachmentWithUrl = PprTaskAttachment & { url: string | null };

export type PprTaskAttachmentsReadModel = {
  taskAttachments: PprTaskAttachmentWithUrl[];
  commentAttachmentsById: Record<string, PprTaskAttachmentWithUrl[]>;
};

export async function listPprTaskAttachmentsForProfile(
  supabase: SupabaseClient,
  profile: Pick<Profile, "id" | "role">,
  taskId: string,
  options: { commentId?: string | null } = {}
) {
  const task = await getPprTaskByIdForProfile(supabase, profile, taskId);
  if (!task) {
    return [];
  }

  let query = supabase
    .from("ppr_task_attachments")
    .select("id,object_id,task_id,comment_id,storage_path,file_name,mime_type,size_bytes,uploaded_by,created_at")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });

  if (options.commentId) {
    query = query.eq("comment_id", options.commentId);
  } else {
    query = query.is("comment_id", null);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as PprTaskAttachment[];
}

export async function getPprTaskAttachmentsReadModelForProfile(
  supabase: SupabaseClient,
  profile: Pick<Profile, "id" | "role">,
  taskId: string
): Promise<PprTaskAttachmentsReadModel> {
  const task = await getPprTaskByIdForProfile(supabase, profile, taskId);
  if (!task) {
    return { taskAttachments: [], commentAttachmentsById: {} };
  }

  const { data, error } = await supabase
    .from("ppr_task_attachments")
    .select("id,object_id,task_id,comment_id,storage_path,file_name,mime_type,size_bytes,uploaded_by,created_at")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });
  if (error) throw error;

  const attachments = (data ?? []) as PprTaskAttachment[];
  const signedUrls = await getPprSignedUrls(
    supabase,
    attachments.map((item) => item.storage_path)
  );

  const taskAttachments: PprTaskAttachmentWithUrl[] = [];
  const commentAttachmentsById: Record<string, PprTaskAttachmentWithUrl[]> = {};

  for (const attachment of attachments) {
    const item: PprTaskAttachmentWithUrl = {
      ...attachment,
      url: signedUrls[attachment.storage_path] ?? null,
    };

    if (!attachment.comment_id) {
      taskAttachments.push(item);
      continue;
    }

    if (!commentAttachmentsById[attachment.comment_id]) {
      commentAttachmentsById[attachment.comment_id] = [];
    }
    commentAttachmentsById[attachment.comment_id].push(item);
  }

  return {
    taskAttachments,
    commentAttachmentsById,
  };
}

export async function getPprTaskCompletionEvidenceForProfile(
  supabase: SupabaseClient,
  profile: Pick<Profile, "id" | "role">,
  taskId: string
) {
  const task = await getPprTaskByIdForProfile(supabase, profile, taskId);
  if (!task) {
    return null;
  }

  const [{ count: commentsCount, error: commentsError }, { count: attachmentsCount, error: attachmentsError }] =
    await Promise.all([
      supabase.from("ppr_task_comments").select("id", { count: "exact", head: true }).eq("task_id", taskId),
      supabase.from("ppr_task_attachments").select("id", { count: "exact", head: true }).eq("task_id", taskId),
    ]);

  if (commentsError) throw commentsError;
  if (attachmentsError) throw attachmentsError;

  return {
    commentsCount: commentsCount ?? 0,
    attachmentsCount: attachmentsCount ?? 0,
  };
}

export async function listMaterializablePlanItemsForRange(
  supabase: SupabaseClient,
  options: { dateFrom: string; dateTo: string }
) {
  const { data, error } = await supabase
    .from("ppr_month_plan_items")
    .select(
      "id,object_id,month_plan_id,system_id,equipment_id,template_id,planned_for,source_due_date,is_overdue,is_carried_over,task_id,status,template:ppr_work_templates(id,name,description,methodology,norm_hours),system:ppr_systems(id,responsible_user_id)"
    )
    .in("status", ["pending", "carried_over"])
    .is("task_id", null)
    .gte("planned_for", options.dateFrom)
    .lte("planned_for", options.dateTo)
    .order("planned_for", { ascending: true })
    .order("equipment_id", { ascending: true })
    .order("template_id", { ascending: true });
  if (error) throw error;

  return (data ?? []) as Array<{
    id: string;
    object_id: string;
    month_plan_id: string;
    system_id: string;
    equipment_id: string;
    template_id: string;
    planned_for: string;
    source_due_date: string;
    is_overdue: boolean;
    is_carried_over: boolean;
    task_id: string | null;
    status: "pending" | "carried_over";
    template:
      | { id: string; name: string; description: string | null; methodology: string | null; norm_hours: number | null }
      | Array<{ id: string; name: string; description: string | null; methodology: string | null; norm_hours: number | null }>
      | null;
    system: { id: string; responsible_user_id: string | null } | Array<{ id: string; responsible_user_id: string | null }> | null;
  }>;
}
