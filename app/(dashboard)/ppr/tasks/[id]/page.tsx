import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  canAccessPprTaskScreens,
  getPprTaskByIdForProfile,
  listPprTaskAssigneeCandidatesForProfile,
  listPprTaskCommentsForProfile,
  listPprTaskWorkItemsForProfile,
} from "@/lib/ppr/queries";
import {
  buildPprTaskActor,
  canAddPprTaskComment,
  canAssignPprTaskExecutor,
  canCancelPprTaskLifecycle,
  canClosePprTaskLifecycle,
  canCompletePprTask,
  canReschedulePprTaskLifecycle,
  canStartPprTask,
  canUploadPprTaskAttachment,
} from "@/lib/ppr/task-lifecycle";
import { PageHeader } from "@/components/ui/page-header";
import { BackButton } from "@/components/ui/back-button";
import { PprTaskDetails } from "@/components/ppr/tasks/ppr-task-details";

export default async function PprTaskDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile } = await requireProfile();

  if (!canAccessPprTaskScreens(profile.role)) {
    return (
      <section className="grid">
        <PageHeader title="ППР-заявка" description="Доступ к карточке ППР-заявки ограничен." />
        <div className="section-card">У вас нет доступа к карточке ППР-заявки.</div>
      </section>
    );
  }

  const supabase = await createSupabaseServerClient();
  const task = await getPprTaskByIdForProfile(supabase, profile, id);

  if (!task) {
    notFound();
  }

  const actor = await buildPprTaskActor(supabase, profile);
  const [workItems, assigneeCandidates, comments] = await Promise.all([
    listPprTaskWorkItemsForProfile(supabase, profile, id),
    listPprTaskAssigneeCandidatesForProfile(supabase, profile, id),
    listPprTaskCommentsForProfile(supabase, profile, id),
  ]);
  const permissions = {
    canAssign: canAssignPprTaskExecutor(actor, task),
    canStart: canStartPprTask(actor, task),
    canComplete: canCompletePprTask(actor, task),
    canClose: canClosePprTaskLifecycle(actor, task),
    canCancel: canCancelPprTaskLifecycle(actor, task),
    canReschedule: canReschedulePprTaskLifecycle(actor, task),
    canComment: canAddPprTaskComment(actor, task),
    canUpload: canUploadPprTaskAttachment(actor, task),
  };

  return (
    <section className="grid">
      <PageHeader
        title="Карточка ППР-заявки"
        description="Карточка ППР-заявки с lifecycle, комментариями, фото и snapshot work items."
        actions={<BackButton fallback="/ppr/tasks" />}
      />
      <PprTaskDetails
        task={task}
        workItems={workItems}
        assigneeCandidates={assigneeCandidates}
        comments={comments}
        permissions={permissions}
      />
    </section>
  );
}
