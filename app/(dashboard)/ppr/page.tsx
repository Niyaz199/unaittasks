import { requireProfile } from "@/lib/auth";
import { canAccessPprModule } from "@/lib/ppr/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { PprDashboardHome } from "@/components/ppr/dashboard/ppr-dashboard-home";

export default async function PprPage() {
  const { profile } = await requireProfile();

  if (!canAccessPprModule(profile.role)) {
    return (
      <section className="grid">
        <PageHeader title="ППР" description="Доступ к модулю ограничен." />
        <div className="section-card">У вас нет доступа к модулю ППР.</div>
      </section>
    );
  }

  return (
    <section className="grid">
      <PageHeader
        title="Модуль ППР"
        description="Управление регламентным обслуживанием: структура объектов, шаблоны, планирование, заявки и архив."
      />
      <PprDashboardHome role={profile.role} />
    </section>
  );
}
