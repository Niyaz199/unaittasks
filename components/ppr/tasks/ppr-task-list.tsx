import Link from "next/link";
import type { Route } from "next";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { pprTaskStatusMeta } from "@/lib/ppr/presentation";
import type { PprTaskSummaryRow } from "@/lib/ppr/queries";

function unwrapRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString("ru-RU");
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleString("ru-RU");
}

function describeTask(task: PprTaskSummaryRow) {
  const object = unwrapRelation(task.object);
  const system = unwrapRelation(task.system);
  const equipment = unwrapRelation(task.equipment);
  const responsible = unwrapRelation(task.responsible);
  const assignee = unwrapRelation(task.assignee);

  return {
    objectName: object?.name ?? "Без объекта",
    systemName: system?.name ?? "Без системы",
    equipmentName: equipment?.name ?? "Без оборудования",
    inventoryNo: equipment?.inventory_no ?? "—",
    responsibleName: responsible?.full_name ?? "Не назначен",
    assigneeName: assignee?.full_name ?? "Не назначен",
  };
}

export function PprTaskList({
  tasks,
  emptyMessage,
  emptyHint,
}: {
  tasks: PprTaskSummaryRow[];
  emptyMessage: string;
  emptyHint?: string;
}) {
  if (!tasks.length) {
    return <EmptyState message={emptyMessage} hint={emptyHint} />;
  }

  return (
    <div className="tl-list">
      {tasks.map((task) => {
        const meta = pprTaskStatusMeta[task.status];
        const item = describeTask(task);

        return (
          <Link
            key={task.id}
            href={`/ppr/tasks/${task.id}` as Route}
            className="tl-card"
          >
            <div className="tl-card-inner">
              <div className="tl-card-main">
                <div className="tl-card-header">
                  <span className="tl-card-title">{item.equipmentName}</span>
                </div>
                
                <div className="tl-card-sub">
                  <span className="tl-card-object">{item.objectName}</span>
                  <span className="tl-card-dot">·</span>
                  <span>{item.systemName}</span>
                </div>

                <div className="tl-card-sub">
                  <span>Инв. №: {item.inventoryNo}</span>
                  <span className="tl-card-dot">·</span>
                  <span>{item.assigneeName}</span>
                </div>

                <div className="tl-card-footer">
                  <Badge tone={meta.tone}>{meta.label}</Badge>
                  {task.is_overdue ? <Badge tone="danger">Просрочена</Badge> : null}
                  {task.is_rescheduled ? <Badge tone="warning">Перенесена</Badge> : null}
                  
                  <span className="tl-due-label">
                    План: {formatDate(task.planned_for)}
                  </span>
                </div>

                {task.general_comment ? (
                  <p className="text-soft" style={{ 
                    fontSize: "0.85rem", 
                    margin: "0.4rem 0 0", 
                    padding: "0.5rem", 
                    background: "color-mix(in srgb, var(--panel-soft) 40%, transparent)", 
                    borderRadius: "6px" 
                  }}>
                    {task.general_comment}
                  </p>
                ) : null}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
