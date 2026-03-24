import Link from "next/link";
import type { Route } from "next";
import type { Role } from "@/lib/types";
import { canManageRoundsConfig, canReadRoundsReports } from "@/lib/rounds/permissions";

const roleLabelMap: Record<Role, string> = {
  admin: "Администратор",
  chief: "Главный инженер",
  lead: "Ведущий инженер",
  engineer: "Инженер",
  object_engineer: "Объектовый инженер",
  tech: "Техник",
};

type NavCard = {
  href: string;
  label: string;
  description: string;
  icon: string;
  group: "work" | "reports" | "admin";
  show: boolean;
};

const GROUPS: { key: NavCard["group"]; label: string }[] = [
  { key: "work", label: "Выполнение" },
  { key: "reports", label: "Отчетность" },
  { key: "admin", label: "Настройки" },
];

function RoundsNavCard({ card }: { card: NavCard }) {
  return (
    <Link
      href={card.href as Route}
      className="ppr-nav-card"
    >
      <span className="ppr-nav-card-icon">{card.icon}</span>
      <span className="ppr-nav-card-body">
        <span className="ppr-nav-card-label">{card.label}</span>
        <span className="ppr-nav-card-desc">{card.description}</span>
      </span>
      <span className="ppr-nav-card-arrow">→</span>
    </Link>
  );
}

export function RoundsDashboardHome({ role }: { role: Role }) {
  const canOpenReports = canReadRoundsReports(role);
  const canOpenConfig = canManageRoundsConfig(role);

  const NAV_CARDS: NavCard[] = [
    // Выполнение
    {
      href: "/rounds/scan",
      label: "Сканер",
      description: "Сканирование QR и фиксация обходов",
      icon: "📱",
      group: "work",
      show: true,
    },
    // Отчетность
    {
      href: "/rounds/today",
      label: "Сегодня",
      description: "Статус обходов за текущий день",
      icon: "📋",
      group: "reports",
      show: canOpenReports,
    },
    {
      href: "/rounds/archive",
      label: "Архив",
      description: "История всех выполненных обходов",
      icon: "📚",
      group: "reports",
      show: canOpenReports,
    },
    // Настройки
    {
      href: "/rounds/config",
      label: "Конфигуратор",
      description: "Настройка помещений для обходов",
      icon: "⚙️",
      group: "admin",
      show: canOpenConfig,
    },
    {
      href: "/rounds/qr",
      label: "QR помещений",
      description: "Печать и выгрузка QR-кодов",
      icon: "🖨️",
      group: "admin",
      show: canOpenConfig,
    },
  ];

  return (
    <div className="grid" style={{ gap: "1.5rem" }}>
      {/* Информационная плашка о модуле */}
      <section className="ppr-intro-card">
        <div className="ppr-intro-inner">
          <div className="grid">
            <h1 className="ppr-intro-title">
              Модуль Обходов
            </h1>
            <p className="text-soft" style={{ margin: "0.5rem 0 0", fontSize: "0.95rem", maxWidth: "800px" }}>
              Модуль для контроля состояния помещений. 
              Сканируйте QR-коды на местах, фиксируйте состояние, прикрепляйте фотоотчеты и отслеживайте выполнение обходов в реальном времени.
            </p>
            <div className="ppr-role-badge">
              Ваша роль: <strong>{roleLabelMap[role]}</strong>
            </div>
          </div>
        </div>
      </section>

      {/* Навигационные группы */}
      {GROUPS.map(({ key, label }) => {
        const cards = NAV_CARDS.filter((c) => c.group === key && c.show);
        if (cards.length === 0) return null;
        return (
          <section key={key} className="grid" style={{ gap: "0.6rem" }}>
            <p className="ppr-group-label">{label}</p>
            <div className="ppr-nav-grid">
              {cards.map((card) => (
                <RoundsNavCard key={card.href} card={card} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}