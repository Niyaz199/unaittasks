import Link from "next/link";
import { notFound } from "next/navigation";
import { canManageTaskTeam, requireProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTaskByIdForProfile, getTaskHistoryForProfile } from "@/lib/tasks";
import { StatusControl } from "@/components/tasks/status-control";
import { CommentForm } from "@/components/tasks/comment-form";
import { TaskTeamManager } from "@/components/tasks/task-team-manager";
import { AttachmentsGallery } from "@/components/tasks/attachments-gallery";
import { Badge } from "@/components/ui/badge";
import { canArchiveTask, canChangeStatus } from "@/lib/task-permissions";
import { taskPriorityMeta, taskStatusMeta, humanStatus } from "@/lib/task-presentation";
import type { TaskComment, TaskHistoryEvent } from "@/lib/types";

function resolveAssigneeName(raw: unknown) {
  const assignee = raw as { full_name: string } | Array<{ full_name: string }> | null | undefined;
  if (Array.isArray(assignee)) return assignee[0]?.full_name ?? "Не назначен";
  return assignee?.full_name ?? "Не назначен";
}

function resolveTeamMembers(raw: unknown) {
  const members = (raw as Array<{ user_id: string; member?: { full_name: string } | null }>) ?? [];
  return members.map((member) => ({
    user_id: member.user_id,
    full_name: member.member?.full_name ?? "Пользователь"
  }));
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "??";
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function formatDate(value: unknown) {
  if (typeof value !== "string") return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleString("ru-RU");
}

function describeHistoryEvent(event: TaskHistoryEvent) {
  const meta = (event.meta ?? {}) as Record<string, unknown>;
  if (event.action === "create_task") {
    return "Создал задачу";
  }
  if (event.action === "accept") {
    return "Принял задачу";
  }
  if (event.action === "status_change") {
    const from = typeof meta.from === "string" ? humanStatus(meta.from) : "—";
    const to = typeof meta.to === "string" ? humanStatus(meta.to) : "—";
    return `Изменил статус: ${from} → ${to}`;
  }
  if (event.action === "pause_task") {
    const resumeAt = formatDate(meta.resume_at);
    const reason = typeof meta.reason === "string" ? meta.reason : "Причина не указана";
    return `Поставил на паузу до ${resumeAt}. Причина: ${reason}`;
  }
  if (event.action === "assign_task") {
    const assigneeName =
      typeof meta.assigned_to_name === "string"
        ? meta.assigned_to_name
        : typeof meta.assigned_to === "string"
          ? meta.assigned_to
          : "—";
    return `Назначил исполнителя: ${assigneeName}`;
  }
  if (event.action === "team_add_member") {
    const userName =
      typeof meta.user_name === "string" ? meta.user_name : typeof meta.user_id === "string" ? meta.user_id : "—";
    return `Добавил в команду: ${userName}`;
  }
  if (event.action === "team_remove_member") {
    const userName =
      typeof meta.user_name === "string" ? meta.user_name : typeof meta.user_id === "string" ? meta.user_id : "—";
    return `Удалил из команды: ${userName}`;
  }
  if (event.action === "task_archived_manual") {
    return "Перенес задачу в архив";
  }
  if (event.action === "task_archived_auto") {
    return "Автоархив задачи";
  }
  return event.action;
}

export default async function TaskDetailsPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const search = await searchParams;
  const activeTab = typeof search.tab === "string" && search.tab === "history" ? "history" : "comments";
  const { profile } = await requireProfile();
  const supabase = await createSupabaseServerClient();

  let task;
  try {
    task = await getTaskByIdForProfile(supabase, profile, id);
  } catch {
    notFound();
  }
  if (!task) notFound();

  const { data: commentsData } = await supabase
    .from("task_comments")
    .select("id,task_id,author_id,body,created_at,client_msg_id,author:profiles(full_name)")
    .eq("task_id", task.id)
    .order("created_at", { ascending: true });
  const comments = (commentsData ?? []) as unknown as TaskComment[];
  const canViewHistory = ["admin", "chief", "lead", "engineer"].includes(profile.role);
  const history = canViewHistory ? await getTaskHistoryForProfile(supabase, profile, id).catch(() => []) : [];

  const teamMembers = resolveTeamMembers(task.team_members);
  const teamMemberIds = teamMembers.map((member) => member.user_id);
  const objectEngineerScoped =
    profile.role !== "object_engineer" || task.objects?.object_engineer_id === profile.id;
  const canEdit = canChangeStatus(task, { id: profile.id, role: profile.role }, { teamMemberIds });
  const canArchive = canArchiveTask(profile.role, task);
  const canManageTeam = canManageTaskTeam(profile.role) && objectEngineerScoped;

  const teamCandidatesData = canManageTeam
    ? await supabase.from("profiles").select("id,full_name").order("full_name")
    : { data: [] as Array<{ id: string; full_name: string }> };

  const status = taskStatusMeta[task.status];
  const priority = taskPriorityMeta[task.priority];
  const dueLabel = task.due_at ? new Date(task.due_at).toLocaleString("ru-RU") : "Без срока";
  const resumeLabel = task.resume_at ? new Date(task.resume_at).toLocaleString("ru-RU") : null;
  const assigneeName = resolveAssigneeName(task.assignee);

  return (
    <section className="td-page grid">
      {/* ── Шапка задачи ── */}
      <div className="section-card td-hero">
        <div className="td-hero-top">
          <h1 className="task-details-title">{task.title}</h1>
          <div className="td-hero-badges">
            <Badge tone={status.tone}>{status.label}</Badge>
            <Badge tone={priority.tone}>{priority.label}</Badge>
          </div>
        </div>
        <div className="td-meta-grid">
          <span className="td-meta-item">
            <span className="td-meta-label">Объект</span>
            <span className="td-meta-value">{task.objects?.name ?? "—"}</span>
          </span>
          <span className="td-meta-item">
            <span className="td-meta-label">Ответственный</span>
            <span className="td-meta-value td-meta-assignee">
              <span className="task-assignee-avatar td-avatar-sm" aria-hidden="true">{getInitials(assigneeName)}</span>
              {assigneeName}
            </span>
          </span>
          <span className="td-meta-item">
            <span className="td-meta-label">Срок</span>
            <span className="td-meta-value">{dueLabel}</span>
          </span>
          {task.status === "paused" && resumeLabel ? (
            <span className="td-meta-item">
              <span className="td-meta-label">Пауза до</span>
              <span className="td-meta-value td-meta-paused">{resumeLabel}</span>
            </span>
          ) : null}
        </div>
      </div>

      {/* ── Описание ── */}
      {(task.description || true) ? (
        <div className="section-card task-description-panel">
          <h2 className="task-panel-title">Описание</h2>
          {task.description ? (
            <p className="task-description-text">{task.description}</p>
          ) : (
            <p className="task-description-empty">Описание не заполнено.</p>
          )}
          <AttachmentsGallery taskId={task.id} />
        </div>
      ) : null}

      {/* ── Статус и действия ── */}
      <div className="section-card td-status-panel">
        <h2 className="task-panel-title">Действия</h2>
        {canEdit || canArchive ? (
          <StatusControl taskId={task.id} currentStatus={task.status} canEdit={canEdit} canArchive={canArchive} />
        ) : (
          <div className="text-soft td-no-edit">Статус может менять только ответственный или участник команды.</div>
        )}
      </div>

      {/* ── Комментарии / История ── */}
      <div className="section-card grid comment-block">
        <div className="td-tabs-row">
          <div className="task-tabs">
            <Link className={`task-tab${activeTab === "comments" ? " active" : ""}`} href={`/tasks/${task.id}?tab=comments`}>
              Комментарии
              {comments.length > 0 ? <span className="td-tab-count">{comments.length}</span> : null}
            </Link>
            {canViewHistory ? (
              <Link className={`task-tab${activeTab === "history" ? " active" : ""}`} href={`/tasks/${task.id}?tab=history`}>
                История
              </Link>
            ) : null}
          </div>
        </div>

        {activeTab === "history" && canViewHistory ? (
          <div className="comment-feed">
            {history.map((event) => (
              <div key={event.id} className="comment-item task-history-item">
                <div className="comment-item-head">
                  <span className="comment-author">{event.actor_name}</span>
                  <span className="text-soft">{new Date(event.created_at).toLocaleString("ru-RU")}</span>
                </div>
                <div className="comment-body">{describeHistoryEvent(event)}</div>
              </div>
            ))}
            {!history.length ? <div className="text-soft td-feed-empty">История по задаче пока отсутствует.</div> : null}
          </div>
        ) : (
          <>
            <CommentForm taskId={task.id} />
            <div className="comment-feed">
              {comments.map((comment) => (
                <div key={comment.id} className="comment-item">
                  <div className="comment-item-head">
                    <span className="comment-author">{comment.author?.full_name ?? "Пользователь"}</span>
                    <span className="text-soft">{new Date(comment.created_at).toLocaleString("ru-RU")}</span>
                  </div>
                  <div className="comment-body">{comment.body}</div>
                  <AttachmentsGallery taskId={task.id} commentId={comment.id} />
                </div>
              ))}
              {!comments.length ? <div className="text-soft td-feed-empty">Комментариев пока нет.</div> : null}
            </div>
          </>
        )}
      </div>

      {/* ── Команда задачи — после комментариев ── */}
      <div className="section-card td-team-panel">
        <h2 className="task-panel-title">Команда</h2>
        <div className="td-team-list">
          <div className="td-team-item">
            <div className="task-team-person">
              <span className="task-assignee-avatar" aria-hidden="true">{getInitials(assigneeName)}</span>
              <div className="task-team-person-info">
                <span>{assigneeName}</span>
                <span className="text-soft">Ответственный</span>
              </div>
            </div>
            <Badge tone="info">Владелец</Badge>
          </div>
          {teamMembers.map((member) => (
            <div key={member.user_id} className="td-team-item td-team-item--member">
              <div className="task-team-person">
                <span className="task-team-avatar" aria-hidden="true">{getInitials(member.full_name)}</span>
                <span>{member.full_name}</span>
              </div>
            </div>
          ))}
        </div>

        {canManageTeam ? (
          <TaskTeamManager
            taskId={task.id}
            canManage={canManageTeam}
            currentUserId={profile.id}
            assigneeId={task.assigned_to}
            initialMembers={teamMembers}
            allCandidates={(teamCandidatesData.data ?? []).map((item) => ({ id: item.id, full_name: item.full_name }))}
          />
        ) : null}
      </div>
    </section>
  );
}
