import Link from "next/link";
import { notFound } from "next/navigation";
import { canManageTaskTeam, requireProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTaskByIdForProfile, getTaskHistoryForProfile } from "@/lib/tasks";
import { StatusControl } from "@/components/tasks/status-control";
import { CommentForm } from "@/components/tasks/comment-form";
import { TaskTeamManager } from "@/components/tasks/task-team-manager";
import { Badge } from "@/components/ui/badge";
import { canChangeStatus } from "@/lib/task-permissions";
import { taskPriorityMeta, taskStatusMeta } from "@/lib/task-presentation";
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
    return "Взял задачу в работу";
  }
  if (event.action === "status_change") {
    const from = typeof meta.from === "string" ? meta.from : "—";
    const to = typeof meta.to === "string" ? meta.to : "—";
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
    <section className="grid">
      <div className="section-card task-details-hero">
        <div className="task-details-hero-main">
          <h1 className="task-details-title">{task.title}</h1>
          <div className="task-details-meta">
            <span>Объект: {task.objects?.name ?? "—"}</span>
            <span className="task-row-dot">•</span>
            <span>Ответственный: {assigneeName}</span>
            <span className="task-row-dot">•</span>
            <span>Срок: {dueLabel}</span>
            {task.status === "paused" && resumeLabel ? (
              <>
                <span className="task-row-dot">•</span>
                <span>Пауза до: {resumeLabel}</span>
              </>
            ) : null}
          </div>
        </div>
        <div className="task-details-hero-badges">
          <Badge tone={status.tone}>Статус: {status.label}</Badge>
          <Badge tone={priority.tone}>Приоритет: {priority.label}</Badge>
        </div>
      </div>

      <div className="section-card task-description-panel">
        <h2 className="task-panel-title">Описание</h2>
        {task.description ? (
          <p className="task-description-text">{task.description}</p>
        ) : (
          <p className="task-description-empty">Описание не заполнено.</p>
        )}
      </div>

      <div className="section-card task-status-panel">
        <h2 className="task-panel-title">Статус и действия</h2>
        {task.status === "paused" && resumeLabel ? (
          <div className="task-paused-inline">Пауза до: {resumeLabel}</div>
        ) : null}
        {canEdit ? (
          <StatusControl taskId={task.id} currentStatus={task.status} canEdit={canEdit} />
        ) : (
          <div className="text-soft">Статус может менять только ответственный или участник команды.</div>
        )}
      </div>

      <div className="section-card task-team-panel">
        <h2 className="task-panel-title">Команда задачи</h2>
        <div className="task-team-list">
          <div className="task-team-item">
            <div className="task-team-person">
              <span className="task-assignee-avatar">{getInitials(assigneeName)}</span>
              <div className="task-team-person-info">
                <span>{assigneeName}</span>
                <span className="text-soft">Ответственный</span>
              </div>
            </div>
            <Badge tone="info">Owner</Badge>
          </div>
        </div>

        <TaskTeamManager
          taskId={task.id}
          canManage={canManageTeam}
          currentUserId={profile.id}
          assigneeId={task.assigned_to}
          initialMembers={teamMembers}
          allCandidates={(teamCandidatesData.data ?? []).map((item) => ({ id: item.id, full_name: item.full_name }))}
        />
      </div>

      <div className="section-card grid comment-block">
        <div className="task-tabs">
          <Link className={`task-tab${activeTab === "comments" ? " active" : ""}`} href={`/tasks/${task.id}?tab=comments`}>
            Комментарии
          </Link>
          {canViewHistory ? (
            <Link className={`task-tab${activeTab === "history" ? " active" : ""}`} href={`/tasks/${task.id}?tab=history`}>
              История
            </Link>
          ) : null}
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
            {!history.length ? <div className="text-soft">История по задаче пока отсутствует.</div> : null}
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
                </div>
              ))}
              {!comments.length ? <div className="text-soft">Комментариев пока нет.</div> : null}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
