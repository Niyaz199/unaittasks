"use client";

import type { Route } from "next";
import { ObjectHub, type ObjectHubCard } from "@/components/ui/object-hub";
import type { ObjectRoomsObjectSummaryRow } from "@/lib/object-rooms";

export function PprRoomsObjectHub({
  summaries,
}: {
  summaries: ObjectRoomsObjectSummaryRow[];
}) {
  const metrics = [
    { label: "Объекты", value: summaries.length, tone: "info" as const },
    {
      label: "Активных помещений",
      value: summaries.reduce((sum, item) => sum + item.active_count, 0),
      tone: "success" as const,
    },
    {
      label: "Этажей",
      value: summaries.reduce((sum, item) => sum + item.floor_count, 0),
      tone: "neutral" as const,
    },
    {
      label: "Неактивных",
      value: summaries.reduce((sum, item) => sum + item.inactive_count, 0),
      tone: "warning" as const,
    },
  ];

  const cards: ObjectHubCard[] = summaries.map((item) => {
    const inactive = item.inactive_count;
    return {
      id: item.object_id,
      name: item.object_name,
      subtitle: "Помещения объекта",
      badge: {
        label: inactive > 0 ? `${inactive} неактивных` : "Всё активно",
        variant: inactive > 0 ? "warning" : "success",
      },
      stats: [
        { label: "Всего", value: item.total_count },
        { label: "Активных", value: item.active_count },
        { label: "Этажей", value: item.floor_count },
      ],
      href: `/ppr/rooms?objectId=${item.object_id}` as Route,
      ctaLabel: "Открыть помещения",
    };
  });

  return (
    <ObjectHub
      cards={cards}
      metrics={metrics}
      hint="Выберите объект, чтобы открыть его помещения."
      emptyHint="Когда для вас откроют объекты, здесь появится стартовый экран выбора."
    />
  );
}
