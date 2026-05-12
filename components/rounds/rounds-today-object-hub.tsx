"use client";

import type { Route } from "next";
import { ObjectHub, type ObjectHubCard } from "@/components/ui/object-hub";
import type { RoundsTodayObjectSummaryRow } from "@/lib/rounds/queries";

export function RoundsTodayObjectHub({
  summaries,
  operationalDate,
}: {
  summaries: RoundsTodayObjectSummaryRow[];
  operationalDate: string;
}) {
  const metrics = [
    { label: "Объекты", value: summaries.length, tone: "info" as const },
    {
      label: "Всего помещений",
      value: summaries.reduce((sum, item) => sum + item.total_rooms, 0),
      tone: "neutral" as const,
    },
    {
      label: "Проверено сегодня",
      value: summaries.reduce((sum, item) => sum + item.checked_count, 0),
      tone: "success" as const,
    },
    {
      label: "Не проверено",
      value: summaries.reduce((sum, item) => sum + item.missing_count, 0),
      tone: "warning" as const,
    },
  ];

  const cards: ObjectHubCard[] = summaries.map((item) => {
    const allDone = item.total_rooms > 0 && item.missing_count === 0;
    const noRooms = item.total_rooms === 0;
    return {
      id: item.object_id,
      name: item.object_name,
      subtitle: noRooms ? "Помещения для обхода не настроены" : "Обходы за операционную дату",
      badge: noRooms
        ? { label: "Не настроено", variant: "neutral" as const }
        : allDone
          ? { label: "Все проверены", variant: "success" as const }
          : { label: `${item.missing_count} не проверено`, variant: "warning" as const },
      stats: [
        { label: "Всего", value: item.total_rooms },
        { label: "Проверено", value: item.checked_count },
        { label: "Не проверено", value: item.missing_count },
      ],
      href: `/rounds/today?objectId=${item.object_id}&operationalDate=${operationalDate}` as Route,
      ctaLabel: "Открыть обходы",
    };
  });

  return (
    <ObjectHub
      cards={cards}
      metrics={metrics}
      hint={`Операционная дата: ${operationalDate}. Выберите объект, чтобы увидеть список помещений и статус проверки.`}
      emptyHint="Когда для вас откроют объекты с настроенными обходами, здесь появится стартовый экран."
    />
  );
}
