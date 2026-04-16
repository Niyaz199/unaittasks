import Link from "next/link";
import { canManageUsers, requireProfile } from "@/lib/auth";
import { listActorScopedObjectsForProfile } from "@/lib/access/object-scope";
import { listAvailableUserRoles } from "@/lib/access/users";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CreateUserForm } from "@/components/dictionaries/create-user-form";
import { PageHeader } from "@/components/ui/page-header";

export default async function CreateUserPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { profile } = await requireProfile();
  if (!canManageUsers(profile.role)) {
    return <div className="empty-state">Доступ запрещен.</div>;
  }

  const params = await searchParams;
  const errorRaw = params.error;
  const errorMessage = typeof errorRaw === "string" ? errorRaw : "";

  const supabase = await createSupabaseServerClient();
  const [availableRoles, objects] = await Promise.all([
    Promise.resolve(listAvailableUserRoles(profile.role)),
    listActorScopedObjectsForProfile(supabase, profile),
  ]);

  return (
    <section className="grid">
      <PageHeader
        title="Создать пользователя"
        description="Создайте аккаунт в Supabase Auth и назначьте роль/объекты инженера."
        actions={
          <Link className="btn btn-ghost" href="/users">
            К списку пользователей
          </Link>
        }
      />

      {errorMessage ? (
        <div className="section-card">
          <div className="badge badge-danger">Ошибка: {errorMessage}</div>
        </div>
      ) : null}

      <CreateUserForm
        availableRoles={availableRoles as Array<"admin" | "chief" | "lead" | "engineer" | "object_engineer" | "tech" | "procurement_manager">}
        objects={(objects ?? []).map((objectItem) => ({ id: objectItem.id, name: objectItem.name }))}
      />
    </section>
  );
}
