export const stockItemKindMeta = {
  material: { label: "Материал" },
  spare_part: { label: "ЗИП" },
  consumable: { label: "Расходник" },
  component: { label: "Компонент" },
} as const;

export const stockMovementTypeMeta = {
  receipt: { label: "Приход", tone: "success" as const },
  issue: { label: "Выдача", tone: "warning" as const },
  adjustment_in: { label: "Корректировка +", tone: "info" as const },
  adjustment_out: { label: "Корректировка -", tone: "danger" as const },
} as const;
