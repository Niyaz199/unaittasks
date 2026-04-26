import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import {
  canAccessPprTaskScreens,
  getPprTaskByIdForProfile,
  getPprTaskAttachmentsReadModelForProfile,
  listPprTaskAssigneeCandidatesForProfile,
  listPprTaskCommentsForProfile,
  listPprTaskWorkItemsForProfile,
} from "@/lib/ppr/queries";
import { listEquipmentComponentsForProfile } from "@/lib/warehouse/queries";
import { canCreatePurchaseRequests, canAccessPurchaseRequestsModule } from "@/lib/capabilities";
import {
  buildPprTaskActor,
  canAddPprTaskComment,
  canAssignPprTaskExecutor,
  canCancelPprTaskLifecycle,
  canClosePprTaskLifecycle,
  canCompletePprTask,
  canPausePprTaskLifecycle,
  canResumePprTaskLifecycle,
  canReschedulePprTaskLifecycle,
  canStartPprTask,
  canUploadPprTaskAttachment,
} from "@/lib/ppr/task-lifecycle";
import { PageHeader } from "@/components/ui/page-header";
import { BackButton } from "@/components/ui/back-button";
import { PprTaskDetails } from "@/components/ppr/tasks/ppr-task-details";

export default async function PprTaskDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile, supabase } = await requireProfile();

  if (!canAccessPprTaskScreens(profile.role)) {
    return (
      <section className="grid">
        <PageHeader title="ППР-заявка" description="Доступ к карточке ППР-заявки ограничен." />
        <div className="section-card">У вас нет доступа к карточке ППР-заявки.</div>
      </section>
    );
  }

  const task = await getPprTaskByIdForProfile(supabase, profile, id);

  if (!task) {
    notFound();
  }

  const actor = await buildPprTaskActor(supabase, profile);
  const canCreatePR = canCreatePurchaseRequests(profile.role);
  const canViewPR = canAccessPurchaseRequestsModule(profile.role);
  const canCloseLifecycle = canClosePprTaskLifecycle(actor, task);
  const needEquipmentComponents = canCreatePR || canViewPR || canCloseLifecycle;
  const [workItems, assigneeCandidates, comments, attachments, equipmentComponents] = await Promise.all([
    listPprTaskWorkItemsForProfile(supabase, profile, id),
    listPprTaskAssigneeCandidatesForProfile(supabase, profile, id),
    listPprTaskCommentsForProfile(supabase, profile, id),
    getPprTaskAttachmentsReadModelForProfile(supabase, profile, id),
    needEquipmentComponents
      ? listEquipmentComponentsForProfile(supabase, profile, task.equipment_id).catch(() => [])
      : Promise.resolve([]),
  ]);

  type LinkedRequestRow = {
    id: string;
    status: "new" | "in_progress" | "fulfilled" | "cancelled";
    description: string | null;
    created_at: string;
    items: { id: string }[] | null;
  };
  const { data: linkedRequestsRaw } = canViewPR
    ? await supabase
        .from("purchase_requests")
        .select("id,status,description,created_at,items:purchase_request_items(id)")
        .eq("source_task_id", id)
        .order("created_at", { ascending: false })
    : { data: null as LinkedRequestRow[] | null };
  const linkedPurchaseRequests = ((linkedRequestsRaw ?? []) as LinkedRequestRow[]).map((row) => ({
    id: row.id,
    status: row.status,
    description: row.description,
    created_at: row.created_at,
    items_count: row.items?.length ?? 0,
  }));

  // Если задача на паузе и привязана к заявке на закупку, которая НЕ была создана
  // из этой же задачи (source_task_id у PR может указывать на другую задачу или быть null),
  // догружаем её отдельно, чтобы StatusStrip показывал актуальный статус.
  let holdPurchaseRequestStatus:
    | { id: string; status: "new" | "in_progress" | "fulfilled" | "cancelled" }
    | null = null;
  if (task.hold_purchase_request_id && canViewPR) {
    const alreadyInLinked = linkedPurchaseRequests.find((pr) => pr.id === task.hold_purchase_request_id);
    if (alreadyInLinked) {
      holdPurchaseRequestStatus = { id: alreadyInLinked.id, status: alreadyInLinked.status };
    } else {
      const { data: holdPrRow } = await supabase
        .from("purchase_requests")
        .select("id,status")
        .eq("id", task.hold_purchase_request_id)
        .maybeSingle();
      if (holdPrRow) {
        holdPurchaseRequestStatus = {
          id: holdPrRow.id as string,
          status: holdPrRow.status as "new" | "in_progress" | "fulfilled" | "cancelled",
        };
      }
    }
  }

  const permissions = {
    canAssign: canAssignPprTaskExecutor(actor, task),
    canStart: canStartPprTask(actor, task),
    canComplete: canCompletePprTask(actor, task),
    canClose: canCloseLifecycle,
    canCancel: canCancelPprTaskLifecycle(actor, task),
    canReschedule: canReschedulePprTaskLifecycle(actor, task),
    canPause: canPausePprTaskLifecycle(actor, task),
    canResume: canResumePprTaskLifecycle(actor, task),
    canComment: canAddPprTaskComment(actor, task),
    canUpload: canUploadPprTaskAttachment(actor, task),
  };

  return (
    <section className="grid">
      <PageHeader
        title="Карточка ППР-заявки"
        description="Карточка ППР-заявки с действиями по этапам выполнения, комментариями, фото и сохраненным составом работ."
        actions={<BackButton fallback="/ppr/tasks" />}
      />
      <PprTaskDetails
        task={task}
        workItems={workItems}
        assigneeCandidates={assigneeCandidates}
        comments={comments}
        taskAttachments={attachments.taskAttachments}
        commentAttachmentsById={attachments.commentAttachmentsById}
        permissions={permissions}
        viewerRole={profile.role}
        equipmentComponents={equipmentComponents}
        linkedPurchaseRequests={linkedPurchaseRequests}
        holdPurchaseRequest={holdPurchaseRequestStatus}
        canCreatePurchaseRequest={canCreatePR}
        canViewPurchaseRequests={canViewPR}
      />
    </section>
  );
}
