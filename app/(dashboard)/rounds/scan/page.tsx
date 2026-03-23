import { requireProfile } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page-header";
import { canUseRoundsScanner } from "@/lib/rounds/permissions";
import { RoundsScanScreen } from "@/components/rounds/rounds-scan-screen";

export default async function RoundsScanPage() {
  const { profile } = await requireProfile();

  if (!canUseRoundsScanner(profile.role)) {
    return (
      <section className="grid">
        <PageHeader title="Сканер обходов" description="Доступ к сканеру обходов ограничен." />
        <div className="section-card">У вас нет доступа к модулю обходов.</div>
      </section>
    );
  }

  return (
    <section className="grid">
      <RoundsScanScreen userId={profile.id} />
    </section>
  );
}
