"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import type { Route } from "next";
import { PprPageShell } from "@/components/ppr/ui/ppr-page-shell";

export type ObjectHubMetricTone = "info" | "success" | "warning" | "danger" | "neutral";

export type ObjectHubMetric = {
  label: string;
  value: number | string;
  tone?: ObjectHubMetricTone;
};

export type ObjectHubStat = {
  label: string;
  value: number | string;
};

export type ObjectHubBadge = {
  label: string;
  /** Соответствует CSS-классам badge: badge-success / badge-warning / badge-danger / badge-info / badge-accent. */
  variant: "success" | "warning" | "danger" | "info" | "accent" | "neutral";
};

export type ObjectHubCard = {
  /** Уникальный ключ для React-списка (обычно object_id). */
  id: string;
  /** Заголовок карточки — имя объекта. */
  name: string;
  /** Описание под заголовком (опционально). */
  subtitle?: string;
  /** Бейдж в правом верхнем углу (опционально). */
  badge?: ObjectHubBadge;
  /** 3-4 показателя в нижней части карточки. */
  stats: ObjectHubStat[];
  /** URL, по которому уходит пользователь при клике (с уже зашитым objectId в query). */
  href: Route;
  /** Текст CTA-ссылки в самом низу (по умолчанию «Открыть →»). */
  ctaLabel?: string;
};

export type ObjectHubProps = {
  /** Карточки — по одной на объект. */
  cards: ObjectHubCard[];
  /** Суммарные метрики, отображаются как top-line «Объекты / В работе / …». */
  metrics: ObjectHubMetric[];
  /** Placeholder поиска. */
  searchPlaceholder?: string;
  /** Текст-подсказка над сеткой карточек («Сначала выберите объект…»). */
  hint?: string;
  /** Кнопки рядом с поиском (например, «Показать весь каталог»). */
  actions?: ReactNode;
  /** Сообщения для пустого состояния (объектов нет). */
  emptyMessage?: string;
  emptyHint?: string;
  /** Сообщения, когда отфильтровали в ноль. */
  filteredEmptyMessage?: string;
  filteredEmptyHint?: string;
};

function badgeClassName(variant: ObjectHubBadge["variant"]) {
  switch (variant) {
    case "success":
      return "badge badge-success";
    case "warning":
      return "badge badge-warning";
    case "danger":
      return "badge badge-danger";
    case "info":
      return "badge badge-info";
    case "accent":
      return "badge badge-accent";
    default:
      return "badge";
  }
}

/**
 * Общий «хаб выбора объекта»: топ-метрики, поиск, карточки объектов с CTA-ссылкой.
 * Используется на страницах, где пользователь сначала выбирает объект,
 * а внутри уже работает с контентом этого объекта (оборудование, помещения, склад и т.д.).
 *
 * URL-конвенция: каждая карточка ведёт на ту же страницу с `?objectId=<id>` —
 * родительская page.tsx сама переключается между ObjectHub ↔ Admin по этому параметру.
 */
export function ObjectHub({
  cards,
  metrics,
  searchPlaceholder = "Найдите объект по названию...",
  hint,
  actions,
  emptyMessage = "Нет доступных объектов",
  emptyHint = "Когда для вас откроют объекты, здесь появится стартовый экран выбора.",
  filteredEmptyMessage = "Объекты не найдены",
  filteredEmptyHint = "Попробуйте уточнить название объекта.",
}: ObjectHubProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredCards = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return cards;
    return cards.filter((card) => card.name.toLowerCase().includes(query));
  }, [searchTerm, cards]);

  const statsColumns = useMemo(() => {
    // равномерные колонки под количество метрик карточек
    const counts = cards.map((card) => card.stats.length);
    const maxCount = counts.length ? Math.max(...counts) : 3;
    return Math.min(Math.max(maxCount, 1), 4);
  }, [cards]);

  return (
    <PprPageShell
      metrics={metrics.map((metric) => ({
        label: metric.label,
        value: metric.value,
        tone: metric.tone ?? "neutral",
      }))}
      onSearch={setSearchTerm}
      searchPlaceholder={searchPlaceholder}
      actions={actions}
      isEmpty={cards.length === 0}
      emptyState={{ message: emptyMessage, hint: emptyHint }}
      isFilteredEmpty={filteredCards.length === 0}
      filteredEmptyState={{ message: filteredEmptyMessage, hint: filteredEmptyHint }}
    >
      <div className="warehouse-items-hub">
        {hint ? <div className="text-soft">{hint}</div> : null}

        <div className="warehouse-items-hub-grid">
          {filteredCards.map((card) => (
            <Link
              key={card.id}
              href={card.href}
              className="warehouse-items-hub-card-link"
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <article
                className="section-card warehouse-items-hub-card"
                style={{ cursor: "pointer", transition: "box-shadow 0.15s" }}
              >
                <div className="warehouse-items-hub-head">
                  <div className="warehouse-items-hub-copy">
                    <div className="warehouse-items-hub-title">{card.name}</div>
                    {card.subtitle ? (
                      <div className="warehouse-items-hub-subtitle">{card.subtitle}</div>
                    ) : null}
                  </div>
                  {card.badge ? (
                    <span className={badgeClassName(card.badge.variant)}>{card.badge.label}</span>
                  ) : null}
                </div>

                <div
                  className="warehouse-items-hub-stats"
                  style={{ gridTemplateColumns: `repeat(${statsColumns}, minmax(0, 1fr))` }}
                >
                  {card.stats.map((stat, index) => (
                    <div className="warehouse-items-hub-stat" key={`${card.id}-stat-${index}`}>
                      <span className="warehouse-items-hub-stat-label">{stat.label}</span>
                      <strong>{stat.value}</strong>
                    </div>
                  ))}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span className="text-soft" style={{ fontSize: "0.82rem" }}>
                    {card.ctaLabel ?? "Открыть"}
                  </span>
                  <span className="text-soft" style={{ fontSize: "0.82rem" }}>
                    →
                  </span>
                </div>
              </article>
            </Link>
          ))}
        </div>
      </div>
    </PprPageShell>
  );
}
