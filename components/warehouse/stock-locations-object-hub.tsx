"use client";

import type { Route } from "next";
import { ObjectHub, type ObjectHubCard } from "@/components/ui/object-hub";
import type { StockLocationsObjectSummaryRow } from "@/lib/warehouse/queries";

export function StockLocationsObjectHub({
  summaries,
}: {
  summaries: StockLocationsObjectSummaryRow[];
}) {
  const metrics = [
    { label: "Объекты", value: summaries.length, tone: "info" as const },
    {
      label: "Активных мест",
      value: summaries.reduce((sum, item) => sum + item.active_count, 0),
      tone: "success" as const,
    },
    {
      label: "С QR-кодом",
      value: summaries.reduce((sum, item) => sum + item.with_qr_count, 0),
      tone: "neutral" as const,
    },
    {
      label: "Без QR",
      value: summaries.reduce(
        (sum, item) => sum + (item.total_count - item.with_qr_count),
        0
      ),
      tone: "warning" as const,
    },
  ];

  const cards: ObjectHubCard[] = summaries.map((item) => {
    const withoutQr = item.total_count - item.with_qr_count;
    return {
      id: item.object_id,
      name: item.object_name,
      subtitle: "Места хранения объекта",
      badge: {
        label: withoutQr > 0 ? `${withoutQr} без QR` : "Все с QR",
        variant: withoutQr > 0 ? "warning" : "success",
      },
      stats: [
        { label: "Всего", value: item.total_count },
        { label: "Активных", value: item.active_count },
        { label: "С QR", value: item.with_qr_count },
      ],
      href: `/warehouse/locations?objectId=${item.object_id}` as Route,
      ctaLabel: "Открыть склад",
    };
  });

  return (
    <ObjectHub
      cards={cards}
      metrics={metrics}
      hint="Выберите объект, чтобы открыть его места хранения."
      emptyHint="Когда для вас откроют объекты склада, здесь появится стартовый экран выбора."
    />
  );
}
