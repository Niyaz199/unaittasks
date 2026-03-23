import Link from "next/link";
import type { Route } from "next";
import type { Role } from "@/lib/types";
import {
  canAccessDirectories,
  canManageObjects,
  canManageUsers,
  canReadFloorsDirectory,
  canReadRoomTypesDirectory,
} from "@/lib/capabilities";
import { canAccessRoundsModule, canManageRoundsConfig, canReadRoundsReports } from "@/lib/rounds/permissions";

type Props = {
  role: Role;
  currentPath: string;
};

function isActive(currentPath: string, href: string) {
  if (currentPath === href || currentPath.startsWith(`${href}/`)) return true;
  if (href === "/my") return currentPath === "/my" || currentPath.startsWith("/tasks/");
  return false;
}

function Item({ href, label, currentPath }: { href: string; label: string; currentPath: string }) {
  const active = isActive(currentPath, href);
  return (
    <Link href={href as Route} className={`side-nav-link${active ? " active" : ""}`}>
      {label}
    </Link>
  );
}

export function MainNav({ role, currentPath }: Props) {
  const canOpenDirectories = canAccessDirectories(role);
  const canManagePprSystemGroups = role === "admin" || role === "chief" || role === "lead";
  const canOpenRounds = canAccessRoundsModule(role);
  const canOpenRoundsReports = canReadRoundsReports(role);
  const canOpenRoundsConfig = canManageRoundsConfig(role);

  return (
    <nav className="side-nav">
      <section className="side-nav-section">
        <p className="side-nav-title">Задачи</p>
        <Item href="/my" label="Мои задачи" currentPath={currentPath} />
        <Item href="/new" label="Новые" currentPath={currentPath} />
        <Item href="/archive" label="Архив" currentPath={currentPath} />
      </section>

      <section className="side-nav-section">
        <p className="side-nav-title">ППР</p>
        <Item href="/ppr" label="Модуль ППР" currentPath={currentPath} />
        {canManagePprSystemGroups ? (
          <Item href="/ppr/system-groups" label="Группы систем ППР" currentPath={currentPath} />
        ) : null}
      </section>

      {canOpenRounds ? (
        <section className="side-nav-section">
          <p className="side-nav-title">Обходы</p>
          <Item href="/rounds" label="Модуль обходов" currentPath={currentPath} />
          <Item href="/rounds/scan" label="Сканер" currentPath={currentPath} />
          {canOpenRoundsReports ? <Item href="/rounds/today" label="Сегодня" currentPath={currentPath} /> : null}
          {canOpenRoundsReports ? <Item href="/rounds/archive" label="Архив" currentPath={currentPath} /> : null}
          {canOpenRoundsConfig ? <Item href="/rounds/config" label="Конфигуратор" currentPath={currentPath} /> : null}
          {canOpenRoundsConfig ? <Item href="/rounds/qr" label="QR помещений" currentPath={currentPath} /> : null}
        </section>
      ) : null}

      {canOpenDirectories ? (
        <section className="side-nav-section">
          <p className="side-nav-title">Справочники</p>
          {canManageUsers(role) ? <Item href="/users" label="Пользователи" currentPath={currentPath} /> : null}
          {canManageObjects(role) ? <Item href="/objects" label="Объекты" currentPath={currentPath} /> : null}
          {canReadFloorsDirectory(role) ? <Item href="/directories/floors" label="Этажи" currentPath={currentPath} /> : null}
          {canReadRoomTypesDirectory(role) ? (
            <Item href="/directories/room-types" label="Типы помещений" currentPath={currentPath} />
          ) : null}
        </section>
      ) : null}

      <section className="side-nav-section">
        <p className="side-nav-title">Сервис</p>
        <Item href="/profile" label="Профиль" currentPath={currentPath} />
        {canManageObjects(role) ? <Item href="/audit" label="Журнал" currentPath={currentPath} /> : null}
      </section>
    </nav>
  );
}
