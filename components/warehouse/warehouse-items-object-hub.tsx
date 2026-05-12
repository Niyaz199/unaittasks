"use client";

import Link from "next/link";
import type { Route } from "next";
import { ObjectHub, type ObjectHubCard } from "@/components/ui/object-hub";

type WarehouseObjectSummary = {
  object_id: string;
  object_name: string;
  item_count: number;
  active_item_count: number;
  location_count: number;
  low_stock_count: number;
};

export function WarehouseItemsObjectHub({
  summaries,
}: {
  summaries: WarehouseObjectSummary[];
}) {
  const metrics = [
    { label: "Объекты", value: summaries.length, tone: "info" as const },
    {
      label: "Активные ТМЦ",
      value: summaries.reduce((sum, item) => sum + item.active_item_count, 0),
      tone: "success" as const,
    },
    {
      label: "Места хранения",
      value: summaries.reduce((sum, item) => sum + item.location_count, 0),
      tone: "neutral" as const,
    },
    {
      label: "Ниже минимума",
      value: summaries.reduce((sum, item) => sum + item.low_stock_count, 0),
      tone: "danger" as const,
    },
  ];

  const cards: ObjectHubCard[] = summaries.map((item) => ({
    id: item.object_id,
    name: item.object_name,
    subtitle: "Каталог ТМЦ и места хранения по объекту",
    badge: {
      label: item.low_stock_count > 0 ? `${item.low_stock_count} ниже минимума` : "Остатки в норме",
      variant: item.low_stock_count > 0 ? "danger" : "success",
    },
    stats: [
      { label: "ТМЦ", value: item.item_count },
      { label: "Активные", value: item.active_item_count },
      { label: "Склады", value: item.location_count },
    ],
    href: `/warehouse/items?objectId=${item.object_id}` as Route,
    ctaLabel: "Открыть каталог",
  }));

  return (
    <ObjectHub
      cards={cards}
      metrics={metrics}
      hint="Сначала выберите объект, а уже внутри него переключайтесь между местами хранения и фильтрами каталога."
      actions={
        <Link className="btn btn-ghost" href="/warehouse/items?showAll=1">
          Показать весь каталог
        </Link>
      }
      emptyHint="Когда для вас откроют объекты склада, здесь появится стартовый экран выбора."
      filteredEmptyHint="Попробуйте уточнить название объекта или переключитесь в обзорный режим."
    />
  );
}
