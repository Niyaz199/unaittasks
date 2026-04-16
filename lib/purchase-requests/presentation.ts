export const purchaseRequestStatusMeta = {
  new: { label: "Новая", tone: "warning" as const },
  in_progress: { label: "В работе", tone: "info" as const },
  fulfilled: { label: "Закуплено", tone: "success" as const },
  cancelled: { label: "Отменена", tone: "neutral" as const },
} as const;

export const purchaseRequestKindMeta = {
  draft: { label: "Черновик" },
  final: { label: "Итоговая заявка" },
} as const;

export const purchaseRequestExecutorMeta = {
  engineer: { label: "Инженер объекта" },
  procurement_manager: { label: "Менеджер по закупкам" },
} as const;
