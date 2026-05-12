"use client";

import type { Route } from "next";
import { ObjectHub, type ObjectHubCard } from "@/components/ui/object-hub";
import type { PprSystemsObjectSummaryRow } from "@/lib/ppr/structure-queries";

export function PprSystemsObjectHub({
  summaries,
}: {
  summaries: PprSystemsObjectSummaryRow[];
}) {
  const metrics = [
    { label: "Объекты", value: summaries.length, tone: "info" as const },
    {
      label: "Активных систем",
      value: summaries.reduce((sum, item) => sum + item.active_count, 0),
      tone: "success" as const,
    },
    {
      label: "Групп систем",
      value: summaries.reduce((sum, item) => sum + item.group_count, 0),
      tone: "neutral" as const,
    },
    {
      label: "Без ответственного",
      value: summaries.reduce(
        (sum, item) => sum + (item.total_count - item.with_responsible_count),
        0
      ),
      tone: "warning" as const,
    },
  ];

  const cards: ObjectHubCard[] = summaries.map((item) => {
    const withoutResp = item.total_count - item.with_responsible_count;
    return {
      id: item.object_id,
      name: item.object_name,
      subtitle: "Системы ППР по объекту",
      badge: {
        label: withoutResp > 0 ? `${withoutResp} без ответственного` : "Все назначены",
        variant: withoutResp > 0 ? "warning" : "success",
      },
      stats: [
        { label: "Всего", value: item.total_count },
        { label: "Активных", value: item.active_count },
        { label: "Групп", value: item.group_count },
      ],
      href: `/ppr/systems?objectId=${item.object_id}` as Route,
      ctaLabel: "Открыть системы",
    };
  });

  return (
    <ObjectHub
      cards={cards}
      metrics={metrics}
      hint="Выберите объект, чтобы работать с его системами ППР."
      emptyHint="Когда для вас откроют объекты ППР, здесь появится стартовый экран выбора."
    />
  );
}
