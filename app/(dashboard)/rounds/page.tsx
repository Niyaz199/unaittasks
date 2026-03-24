import { requireProfile } from "@/lib/auth";
import { canAccessRoundsModule } from "@/lib/rounds/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { RoundsDashboardHome } from "@/components/rounds/dashboard/rounds-dashboard-home";

export default async function RoundsPage() {
  const { profile } = await requireProfile();

  if (!canAccessRoundsModule(profile.role)) {
    return (
      <section className="grid">
        <PageHeader title="Обходы" description="Доступ к модулю ограничен." />
        <div className="section-card">У вас нет доступа к модулю обходов.</div>
      </section>
    );
  }

  return (
    <section className="grid">
      <PageHeader
        title="Модуль Обходов"
        description="Управление обходами помещений, сканирование QR-кодов, фиксация состояния и фотоотчеты."
      />
      <RoundsDashboardHome role={profile.role} />
    </section>
  );
}