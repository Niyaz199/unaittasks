import { requireProfile } from "@/lib/auth";
import { getDailyChecklistPendingCountForProfile } from "@/lib/daily-checklists/queries";
import { NavShell } from "@/components/dashboard/nav-shell";
import { OfflineSyncBootstrap } from "@/components/offline/offline-sync-bootstrap";
import { MobileTabs } from "@/components/dashboard/mobile-tabs";
import { RegisterSW } from "@/components/pwa/register-sw";
import { SignOutButton } from "@/components/dashboard/sign-out-button";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireProfile();
  const supabase = await createSupabaseServerClient();
  const checklistPendingCount = await getDailyChecklistPendingCountForProfile(supabase, profile);

  return (
    <div className="admin-shell">
      <RegisterSW />
      <OfflineSyncBootstrap />
      <aside className="admin-sidebar desktop-only">
        <div className="grid">
          <div className="admin-brand">Задачник эксплуатации</div>
          <div className="sidebar-user">
            <div className="sidebar-user-name">{profile.full_name}</div>
            <div className="sidebar-user-role">{profile.role}</div>
          </div>
          <NavShell role={profile.role} checklistPendingCount={checklistPendingCount} />
        </div>
      </aside>

      <div className="admin-content">
        <header className="admin-topbar">
          <div className="admin-topbar-inner">
            <div className="topbar-user">
              <div className="topbar-user-name">{profile.full_name}</div>
            </div>
            <div className="row">
              <SignOutButton />
            </div>
          </div>
        </header>
        <main className="admin-page">{children}</main>
      </div>

      <MobileTabs role={profile.role} />
    </div>
  );
}
