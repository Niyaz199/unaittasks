import { requireProfile } from "@/lib/auth";
import { ProfileSettings } from "@/components/dashboard/profile-settings";
import { PageHeader } from "@/components/ui/page-header";
import { PushOptInCard } from "@/components/pwa/push-opt-in-card";

export default async function ProfilePage() {
  const { profile, user } = await requireProfile();

  return (
    <section className="grid">
      <PageHeader title="Профиль" description="Данные вашей учетной записи." />
      <ProfileSettings initialFullName={profile.full_name} email={user.email ?? ""} role={profile.role} />
      <div className="text-soft">
        На мобильном можно установить приложение через меню браузера (Добавить на главный экран).
      </div>
      <PushOptInCard />
    </section>
  );
}
