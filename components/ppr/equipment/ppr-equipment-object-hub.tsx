"use client";

import type { Route } from "next";
import { ObjectHub, type ObjectHubCard } from "@/components/ui/object-hub";
import type { PprEquipmentObjectSummaryRow } from "@/lib/ppr/structure-queries";

export function PprEquipmentObjectHub({
  summaries,
}: {
  summaries: PprEquipmentObjectSummaryRow[];
}) {
  const metrics = [
    { label: "Объекты", value: summaries.length, tone: "info" as const },
    {
      label: "В эксплуатации",
      value: summaries.reduce((sum, item) => sum + item.active_count, 0),
      tone: "success" as const,
    },
    {
      label: "В ремонте",
      value: summaries.reduce((sum, item) => sum + item.repair_count, 0),
      tone: "warning" as const,
    },
    {
      label: "Выведено",
      value: summaries.reduce((sum, item) => sum + item.out_of_service_count, 0),
      tone: "danger" as const,
    },
  ];

  const cards: ObjectHubCard[] = summaries.map((item) => {
    const issueCount = item.repair_count + item.out_of_service_count;
    const hasIssues = issueCount > 0;
    return {
      id: item.object_id,
      name: item.object_name,
      subtitle: "Оборудование ППР по объекту",
      badge: {
        label: hasIssues ? `${issueCount} не в работе` : "Всё в норме",
        variant: hasIssues ? "warning" : "success",
      },
      stats: [
        { label: "Всего", value: item.total_count },
        { label: "В работе", value: item.active_count },
        { label: "В ремонте", value: item.repair_count },
        { label: "Выведено", value: item.out_of_service_count },
      ],
      href: `/ppr/equipment?objectId=${item.object_id}` as Route,
      ctaLabel: "Открыть оборудование",
    };
  });

  return (
    <ObjectHub
      cards={cards}
      metrics={metrics}
      hint="Выберите объект, чтобы просмотреть оборудование, системы и помещения только для него."
      emptyHint="Когда для вас откроют объекты ППР, здесь появится стартовый экран выбора."
    />
  );
}
