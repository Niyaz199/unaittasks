import { requireProfile } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";

export default async function ProfilePage() {
  const { profile, user } = await requireProfile();

  return (
    <section className="grid">
      <PageHeader title="Профиль" description="Данные вашей учетной записи." />
      <div className="section-card profile-card grid">
        <div className="profile-name">{profile.full_name}</div>
        <div className="profile-email text-soft">{user.email}</div>
        <div className="row">
          <Badge tone="info">{profile.role}</Badge>
        </div>
        <div className="text-soft">
          На мобильном можно установить приложение через меню браузера (Добавить на главный экран).
        </div>
      </div>
    </section>
  );
}
