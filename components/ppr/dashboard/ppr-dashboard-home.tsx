import Link from "next/link";
import type { Route } from "next";
import type { Role } from "@/lib/types";

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
  group: "structure" | "work" | "admin";
};

const NAV_CARDS: NavCard[] = [
  // Структура
  {
    href: "/ppr/system-groups",
    label: "Группы систем",
    description: "Классификация систем ППР",
    icon: "📁",
    group: "structure",
  },
  {
    href: "/ppr/systems",
    label: "Системы",
    description: "Инженерные системы объектов",
    icon: "⚙️",
    group: "structure",
  },
  {
    href: "/ppr/rooms",
    label: "Помещения",
    description: "Общий справочник помещений объектов",
    icon: "🏠",
    group: "structure",
  },
  {
    href: "/ppr/equipment",
    label: "Оборудование",
    description: "Единицы оборудования и QR-коды",
    icon: "📦",
    group: "structure",
  },
  // Планирование
  {
    href: "/ppr/templates",
    label: "Шаблоны",
    description: "Регламентные работы и чеклисты",
    icon: "📋",
    group: "admin",
  },
  {
    href: "/ppr/assignments",
    label: "Назначения",
    description: "Связь шаблонов с оборудованием",
    icon: "🔗",
    group: "admin",
  },
  {
    href: "/ppr/calendar",
    label: "Календарь",
    description: "Месячный план и переносы",
    icon: "📅",
    group: "admin",
  },
  // Заявки
  {
    href: "/ppr/tasks",
    label: "Все заявки",
    description: "Общий список работ по ППР",
    icon: "⚡",
    group: "work",
  },
  {
    href: "/ppr/my",
    label: "Мои работы",
    description: "Заявки в моей ответственности",
    icon: "👤",
    group: "work",
  },
  {
    href: "/ppr/archive",
    label: "Архив работ",
    description: "История выполненных задач",
    icon: "📚",
    group: "work",
  },
];

const GROUPS: { key: NavCard["group"]; label: string }[] = [
  { key: "structure", label: "Структура объектов" },
  { key: "admin", label: "Планирование" },
  { key: "work", label: "Заявки" },
];

function PprNavCard({ card }: { card: NavCard }) {
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

export function PprDashboardHome({ role }: { role: Role }) {
  return (
    <div className="grid" style={{ gap: "1.5rem" }}>
      {/* Информационная плашка о модуле */}
      <section className="ppr-intro-card">
        <div className="ppr-intro-inner">
          <div className="grid">
            <h1 className="ppr-intro-title">
              Планово-предупредительные работы
            </h1>
            <p className="text-soft" style={{ margin: "0.5rem 0 0", fontSize: "0.95rem", maxWidth: "800px" }}>
              Модуль регламентного обслуживания объектов, управления системами и оборудованием.
              Планируйте работы по шаблонам, используя общий справочник помещений, и отслеживайте выполнение заявок.
            </p>
            <div className="ppr-role-badge">
              Ваша роль: <strong>{roleLabelMap[role]}</strong>
            </div>
          </div>
        </div>
      </section>

      {/* Навигационные группы */}
      {GROUPS.map(({ key, label }) => {
        const cards = NAV_CARDS.filter((c) => c.group === key);
        return (
          <section key={key} className="grid" style={{ gap: "0.6rem" }}>
            <p className="ppr-group-label">{label}</p>
            <div className="ppr-nav-grid">
              {cards.map((card) => (
                <PprNavCard key={card.href} card={card} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
