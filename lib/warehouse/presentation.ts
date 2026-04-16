export const stockItemKindMeta = {
  zip: { label: "ЗИП" },
  component: { label: "Компонент" },
} as const;

export const procurementMethodMeta = {
  engineer: { label: "Покупает инженер объекта" },
  procurement: { label: "Покупает менеджер по закупкам" },
} as const;

export const stockMovementTypeMeta = {
  receipt: { label: "Приход", tone: "success" as const },
  issue: { label: "Выдача", tone: "warning" as const },
  adjustment_in: { label: "Корректировка +", tone: "info" as const },
  adjustment_out: { label: "Корректировка -", tone: "danger" as const },
} as const;
