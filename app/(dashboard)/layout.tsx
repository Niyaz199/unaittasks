import { requireProfile } from "@/lib/auth";
import { signOutAction } from "@/app/actions/auth-actions";
import { NavShell } from "@/components/dashboard/nav-shell";
import { OfflineSyncBootstrap } from "@/components/offline/offline-sync-bootstrap";
import { MobileTabs } from "@/components/dashboard/mobile-tabs";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireProfile();

  return (
    <div className="admin-shell">
      <OfflineSyncBootstrap />
      <aside className="admin-sidebar desktop-only">
        <div className="grid">
          <div className="admin-brand">Задачник эксплуатации</div>
          <div className="sidebar-user">
            <div className="sidebar-user-name">{profile.full_name}</div>
            <div className="sidebar-user-role">{profile.role}</div>
          </div>
          <NavShell role={profile.role} />
        </div>
      </aside>

      <div className="admin-content">
        <header className="admin-topbar">
          <div className="admin-topbar-inner">
            <div className="topbar-user">
              <div className="topbar-user-name">{profile.full_name}</div>
            </div>
            <div className="row">
              <form action={signOutAction}>
                <button className="btn" type="submit">
                  Выйти
                </button>
              </form>
            </div>
          </div>
        </header>
        <main className="admin-page">{children}</main>
      </div>

      <MobileTabs role={profile.role} />
    </div>
  );
}
