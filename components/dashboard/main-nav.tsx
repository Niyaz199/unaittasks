"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import type { Role } from "@/lib/types";
import {
  canAccessDirectories,
  canAccessDailyChecklists,
  canManageObjectRooms,
  canManageObjects,
  canManageDailyChecklistTemplates,
  canManageUsers,
  canReadDailyChecklistControl,
  canReadFloorsDirectory,
  canReadRoomTypesDirectory,
} from "@/lib/capabilities";
import { canAccessRoundsModule, canManageRoundsConfig, canReadRoundsReports } from "@/lib/rounds/permissions";
import {
  canAccessPprCalendarScreens,
  canAccessPprStructureScreens,
  canAccessPprSystemGroupScreens,
  canAccessPprTaskScreens,
  canAccessPprTemplateScreens,
} from "@/lib/ppr/access";
import { canAccessPprModule } from "@/lib/ppr/permissions";

type Props = {
  role: Role;
  currentPath: string;
};

type NavItem = {
  href: string;
  label: string;
  show?: boolean;
};

type NavSection = {
  id: string;
  title: string;
  icon: React.ReactNode;
  show?: boolean;
  href?: string;
  items: NavItem[];
};

function isActiveItem(currentPath: string, href: string) {
  if (href === "/my") return currentPath === "/my" || currentPath.startsWith("/tasks/");
  if (href === "/ppr" || href === "/rounds") return currentPath === href;
  return currentPath === href || currentPath.startsWith(`${href}/`);
}

function isSectionActive(currentPath: string, section: NavSection) {
  if (section.href && isActiveItem(currentPath, section.href)) return true;
  return section.items.some((item) => isActiveItem(currentPath, item.href));
}

// Icons
const Icons = {
  Tasks: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 11 12 14 22 4"></polyline>
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
    </svg>
  ),
  Ppr: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
    </svg>
  ),
  Rounds: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
      <polyline points="9 22 9 12 15 12 15 22"></polyline>
    </svg>
  ),
  Dicts: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
    </svg>
  ),
  Service: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
      <circle cx="12" cy="7" r="4"></circle>
    </svg>
  ),
  Chevron: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6"></polyline>
    </svg>
  ),
};

export function MainNav({ role, currentPath }: Props) {
  const router = useRouter();
  const canOpenDirectories = canAccessDirectories(role);
  const canOpenPpr = canAccessPprModule(role);
  const canOpenPprStructure = canAccessPprStructureScreens(role);
  const canOpenPprSystemGroups = canAccessPprSystemGroupScreens(role);
  const canOpenPprTemplates = canAccessPprTemplateScreens(role);
  const canOpenPprCalendar = canAccessPprCalendarScreens(role);
  const canOpenPprTasks = canAccessPprTaskScreens(role);
  const canOpenPprTaskRegistry = canOpenPprTasks && role !== "tech";
  const canOpenChecklists = canAccessDailyChecklists(role);
  const canOpenChecklistTemplates = canManageDailyChecklistTemplates(role);
  const canOpenChecklistControl = canReadDailyChecklistControl(role);
  const canOpenMyChecklist = role === "lead" || role === "engineer" || role === "object_engineer";
  const pprHref = role === "tech" ? "/ppr/my" : "/ppr";
  const canOpenRounds = canAccessRoundsModule(role);
  const canOpenRoundsReports = canReadRoundsReports(role);
  const canOpenRoundsConfig = canManageRoundsConfig(role);
  const roundsHref = role === "tech" ? "/rounds/scan" : "/rounds";

  const sections: NavSection[] = [
    {
      id: "tasks",
      title: "Задачи",
      icon: Icons.Tasks,
      show: true,
      items: [
        { href: "/my", label: "Мои задачи", show: true },
        { href: "/checklists", label: "Мой чек-лист", show: canOpenChecklists && canOpenMyChecklist },
        { href: "/checklists/control", label: "Контроль чек-листов", show: canOpenChecklists && canOpenChecklistControl },
        { href: "/checklists/templates", label: "Шаблоны чек-листов", show: canOpenChecklists && canOpenChecklistTemplates },
        { href: "/new", label: "Новые", show: true },
        { href: "/archive", label: "Архив", show: true },
      ],
    },
    {
      id: "ppr",
      title: "ППР",
      icon: Icons.Ppr,
      show: canOpenPpr,
      href: pprHref,
      items: [
        { href: "/ppr/system-groups", label: "Группы систем ППР", show: canOpenPprSystemGroups },
        { href: "/ppr/systems", label: "Системы", show: canOpenPprStructure },
        { href: "/ppr/equipment", label: "Оборудование", show: canOpenPprStructure },
        { href: "/ppr/templates", label: "Шаблоны", show: canOpenPprTemplates },
        { href: "/ppr/calendar", label: "Календарь", show: canOpenPprCalendar },
        { href: "/ppr/tasks", label: "Все заявки", show: canOpenPprTaskRegistry },
        { href: "/ppr/my", label: "Мои работы", show: canOpenPprTasks },
        { href: "/ppr/archive", label: "Архив работ", show: canOpenPprTaskRegistry },
      ],
    },
    {
      id: "rounds",
      title: "Обходы",
      icon: Icons.Rounds,
      show: canOpenRounds,
      href: roundsHref,
      items: [
        { href: "/rounds/scan", label: "Сканер", show: true },
        { href: "/rounds/today", label: "Сегодня", show: canOpenRoundsReports },
        { href: "/rounds/archive", label: "Архив", show: canOpenRoundsReports },
        { href: "/rounds/config", label: "Конфигуратор", show: canOpenRoundsConfig },
        { href: "/rounds/qr", label: "QR помещений", show: canOpenRoundsConfig },
      ],
    },
    {
      id: "directories",
      title: "Справочники",
      icon: Icons.Dicts,
      show: canOpenDirectories,
      items: [
        { href: "/users", label: "Пользователи", show: canManageUsers(role) },
        { href: "/objects", label: "Объекты", show: canManageObjects(role) },
        { href: "/directories/floors", label: "Этажи", show: canReadFloorsDirectory(role) },
        { href: "/directories/room-types", label: "Типы помещений", show: canReadRoomTypesDirectory(role) },
        { href: "/ppr/rooms", label: "\u041f\u043e\u043c\u0435\u0449\u0435\u043d\u0438\u044f", show: canManageObjectRooms(role) },
      ],
    },
    {
      id: "service",
      title: "Сервис",
      icon: Icons.Service,
      show: true,
      items: [
        { href: "/profile", label: "Профиль", show: true },
        { href: "/audit", label: "Журнал", show: canManageObjects(role) },
      ],
    },
  ];

  // Filter out hidden sections and items
  const visibleSections = sections
    .filter((s) => s.show !== false)
    .map((s) => ({
      ...s,
      items: s.items.filter((item) => item.show !== false),
    }))
    .filter((s) => s.items.length > 0);

  // Find initially active section
  const initialActiveSection = visibleSections.find((s) => isSectionActive(currentPath, s))?.id || visibleSections[0]?.id;

  const [expandedSection, setExpandedSection] = useState<string | null>(initialActiveSection);

  // Auto-expand when path changes
  useEffect(() => {
    const active = visibleSections.find((s) => isSectionActive(currentPath, s));
    if (active && active.id !== expandedSection) {
      setExpandedSection(active.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPath]);

  const toggleSection = (id: string) => {
    setExpandedSection((prev) => (prev === id ? null : id));
  };

  const handleSectionClick = (section: NavSection) => {
    if (section.href) {
      router.push(section.href as Route);
      setExpandedSection(section.id);
    } else {
      toggleSection(section.id);
    }
  };

  return (
    <nav className="side-nav">
      {visibleSections.map((section) => {
        const isExpanded = expandedSection === section.id;
        const isActive = isSectionActive(currentPath, section);

        return (
          <div key={section.id} className="side-nav-group">
            <button
              type="button"
              className={`side-nav-group-btn ${isActive ? "active" : ""}`}
              onClick={() => handleSectionClick(section)}
            >
              <span className="side-nav-group-title">
                <span className="side-nav-group-icon">{section.icon}</span>
                {section.title}
              </span>
              <span
                className={`side-nav-chevron ${isExpanded ? "expanded" : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleSection(section.id);
                }}
              >
                {Icons.Chevron}
              </span>
            </button>
            <div className={`side-nav-content ${isExpanded ? "expanded" : ""}`}>
              <div className="side-nav-content-inner">
                {section.items.map((item) => {
                  const itemActive = isActiveItem(currentPath, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href as Route}
                      className={`side-nav-link ${itemActive ? "active" : ""}`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </nav>
  );
}
