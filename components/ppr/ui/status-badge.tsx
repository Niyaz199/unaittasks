import { Badge } from "@/components/ui/badge";

type PprStatus = "active" | "repair" | "out_of_service" | "archived" | string;

interface StatusBadgeProps {
  isActive?: boolean;
  status?: PprStatus;
  labels?: Record<string, string>;
}

const DEFAULT_LABELS: Record<string, string> = {
  active: "Активен",
  repair: "В ремонте",
  out_of_service: "Выведен из эксплуатации",
  archived: "В архиве",
  true: "Активен",
  false: "Неактивен",
};

export function StatusBadge({ isActive, status, labels = DEFAULT_LABELS }: StatusBadgeProps) {
  // Handle boolean isActive
  if (isActive !== undefined) {
    return isActive ? (
      <Badge tone="success">{labels.true || "Активен"}</Badge>
    ) : (
      <Badge tone="neutral">{labels.false || "Неактивен"}</Badge>
    );
  }

  // Handle string status
  if (status) {
    let tone: "success" | "warning" | "danger" | "neutral" = "neutral";
    
    switch (status) {
      case "active":
        tone = "success";
        break;
      case "repair":
        tone = "warning";
        break;
      case "out_of_service":
        tone = "danger";
        break;
      case "archived":
        tone = "neutral";
        break;
      default:
        tone = "neutral";
    }

    return <Badge tone={tone}>{labels[status] || status}</Badge>;
  }

  return null;
}
