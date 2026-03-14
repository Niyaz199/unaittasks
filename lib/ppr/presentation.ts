import type { PprEquipmentStatus, PprMonthPlanItemStatus, PprTaskStatus } from "@/lib/ppr/types";

type BadgeTone = "neutral" | "info" | "warning" | "success" | "danger" | "violet";

export const pprTaskStatusMeta: Record<PprTaskStatus, { label: string; tone: BadgeTone }> = {
  new: { label: "Новая", tone: "info" },
  in_progress: { label: "В работе", tone: "warning" },
  done: { label: "Выполнена", tone: "success" },
  closed: { label: "Закрыта", tone: "neutral" },
  cancelled: { label: "Отменена", tone: "danger" },
};

export const pprEquipmentStatusMeta: Record<PprEquipmentStatus, { label: string; tone: BadgeTone }> = {
  active: { label: "В эксплуатации", tone: "success" },
  repair: { label: "В ремонте", tone: "warning" },
  out_of_service: { label: "Выведено", tone: "danger" },
  archived: { label: "В архиве", tone: "neutral" },
};

export const pprMonthPlanItemStatusMeta: Record<PprMonthPlanItemStatus, { label: string; tone: BadgeTone }> = {
  pending: { label: "Ожидает", tone: "info" },
  materialized: { label: "Материализована", tone: "violet" },
  carried_over: { label: "Перенесена", tone: "warning" },
  closed: { label: "Закрыта", tone: "success" },
  cancelled: { label: "Отменена", tone: "danger" },
};

export const pprTaskViewMeta = {
  active: { label: "Активные" },
  review: { label: "На ознакомлении" },
  archive: { label: "Архив" },
};
