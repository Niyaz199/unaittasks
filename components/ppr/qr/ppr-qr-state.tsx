"use client";

import Link from "next/link";
import type { Route } from "next";
import { SectionCard } from "@/components/ui/section-card";

type State = "invalid" | "forbidden";

const stateMeta: Record<State, { title: string; description: string; actionHref: Route; actionLabel: string }> = {
  invalid: {
    title: "QR не найден",
    description:
      "Токен не существует, отключен или больше не привязан к активному QR-коду оборудования ППР.",
    actionHref: "/ppr/my",
    actionLabel: "Перейти к моим ППР",
  },
  forbidden: {
    title: "Нет доступа",
    description:
      "По этому QR не найден доступный для текущего пользователя маршрут. Доступ к чужим объектам и заявкам через QR не раскрывается.",
    actionHref: "/ppr",
    actionLabel: "Вернуться в модуль ППР",
  },
};

export function PprQrState({ state }: { state: State }) {
  const meta = stateMeta[state];

  return (
    <SectionCard>
      <div className="grid" style={{ gap: "0.75rem" }}>
        <div className="grid" style={{ gap: "0.35rem" }}>
          <h2 style={{ margin: 0 }}>{meta.title}</h2>
          <p className="text-soft" style={{ margin: 0 }}>
            {meta.description}
          </p>
        </div>
        <div>
          <Link className="btn btn-ghost" href={meta.actionHref}>
            {meta.actionLabel}
          </Link>
        </div>
      </div>
    </SectionCard>
  );
}
