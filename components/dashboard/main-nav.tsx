import Link from "next/link";
import type { Role } from "@/lib/types";

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
    <Link href={href} className={`side-nav-link${active ? " active" : ""}`}>
      {label}
    </Link>
  );
}

export function MainNav({ role, currentPath }: Props) {
  const canManageDirectories = role === "admin" || role === "chief";

  return (
    <nav className="side-nav">
      <section className="side-nav-section">
        <p className="side-nav-title">Задачи</p>
        <Item href="/my" label="Мои задачи" currentPath={currentPath} />
        <Item href="/new" label="Новые" currentPath={currentPath} />
        <Item href="/archive" label="Архив" currentPath={currentPath} />
      </section>

      {canManageDirectories ? (
        <section className="side-nav-section">
          <p className="side-nav-title">Справочники</p>
          <Item href="/users" label="Пользователи" currentPath={currentPath} />
          <Item href="/objects" label="Объекты" currentPath={currentPath} />
        </section>
      ) : null}

      <section className="side-nav-section">
        <p className="side-nav-title">Сервис</p>
        <Item href="/profile" label="Профиль" currentPath={currentPath} />
        {canManageDirectories ? <Item href="/audit" label="Журнал" currentPath={currentPath} /> : null}
      </section>
    </nav>
  );
}
