import Link from "next/link";
import { takeTaskInWork } from "@/app/actions/task-actions";
import { canChangeStatus } from "@/lib/task-permissions";
import type { Role, TaskItem } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { taskPriorityMeta, taskStatusMeta } from "@/lib/task-presentation";

function formatDue(dueAt: string | null) {
  return dueAt ? new Date(dueAt).toLocaleString("ru-RU") : "—";
}

function formatResumeAt(resumeAt: string | null) {
  return resumeAt ? new Date(resumeAt).toLocaleString("ru-RU") : null;
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "??";
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function resolveAssignee(task: TaskItem) {
  const raw = task.assignee as { full_name: string } | Array<{ full_name: string }> | null | undefined;
  if (Array.isArray(raw)) return raw[0]?.full_name ?? "Не назначен";
  return raw?.full_name ?? "Не назначен";
}

function resolveTeamNames(task: TaskItem) {
  const members = task.team_members ?? [];
  return members
    .map((member) => member.member?.full_name ?? "")
    .filter(Boolean)
    .filter((value, index, array) => array.indexOf(value) === index);
}

export function TaskList({
  tasks,
  showTakeButton,
  currentUser
}: {
  tasks: TaskItem[];
  showTakeButton?: boolean;
  currentUser?: { id: string; role: Role };
}) {
  if (!tasks.length) {
    return (
      <EmptyState
        message="Задачи не найдены"
        hint="Измените фильтры или создайте новую задачу, если это разрешено вашей ролью."
      />
    );
  }

  return (
    <div className="grid task-list-stack">
      {tasks.map((task) => {
        const takeAction = takeTaskInWork.bind(null, task.id);
        const status = taskStatusMeta[task.status];
        const priority = taskPriorityMeta[task.priority];
        const assigneeName = resolveAssignee(task);
        const teamNames = resolveTeamNames(task);
        const previewTeam = teamNames.slice(0, 3);
        const hiddenTeamCount = Math.max(teamNames.length - previewTeam.length, 0);
        const dueLabel = formatDue(task.due_at);
        const resumeLabel = formatResumeAt(task.resume_at);
        const canTakeInWork = (() => {
          if (!showTakeButton || !currentUser || task.status !== "new") return false;
          return canChangeStatus(task, currentUser, {
            teamMemberIds: (task.team_members ?? []).map((member) => member.user_id)
          });
        })();
        return (
          <div className="section-card task-row-shell" key={task.id}>
            <Link className="task-row-main" href={`/tasks/${task.id}`}>
              <div className="task-row-left">
                <div className="task-row-title">{task.title}</div>
                <div className="task-row-meta">
                  <span className="task-row-object">Объект: {task.objects?.name ?? "Без объекта"}</span>
                  <span className="task-row-dot">•</span>
                  <span className="task-assignee">
                    <span className="task-assignee-avatar">{getInitials(assigneeName)}</span>
                    <span>Ответственный: {assigneeName}</span>
                  </span>
                  <span className="task-row-dot">•</span>
                  <span className="task-team-preview">
                    {previewTeam.length ? (
                      <>
                        {previewTeam.map((name) => (
                          <span key={`${task.id}-${name}`} className="task-team-avatar" title={name}>
                            {getInitials(name)}
                          </span>
                        ))}
                        {hiddenTeamCount ? <span className="text-soft">+{hiddenTeamCount}</span> : null}
                      </>
                    ) : (
                      <span className="text-soft">Команда: —</span>
                    )}
                  </span>
                </div>
              </div>
              <div className="task-row-right">
                <Badge tone={status.tone}>{status.label}</Badge>
                <Badge tone={priority.tone}>{priority.label}</Badge>
                <span className="task-due-chip" title={`Срок: ${dueLabel}`}>
                  <span aria-hidden>📅</span>
                  <span>{dueLabel}</span>
                </span>
                {task.status === "paused" && resumeLabel ? (
                  <span className="task-paused-chip" title={`Пауза до: ${resumeLabel}`}>
                    Пауза до: {resumeLabel}
                  </span>
                ) : null}
              </div>
            </Link>
            {canTakeInWork ? (
              <div className="row" style={{ marginTop: "0.55rem" }}>
                <form action={takeAction}>
                  <button className="btn btn-accent" type="submit">
                    В работу
                  </button>
                </form>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
