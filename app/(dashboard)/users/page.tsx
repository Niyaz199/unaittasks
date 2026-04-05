import Link from "next/link";
import { canManageUsers, requireProfile } from "@/lib/auth";
import { listActorScopedObjectsForProfile } from "@/lib/access/object-scope";
import { listAvailableUserRoles } from "@/lib/access/users";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { UsersAdminList } from "@/components/dictionaries/users-admin-list";
import { PageHeader } from "@/components/ui/page-header";

export default async function UsersPage() {
  const { profile, user } = await requireProfile();
  if (!canManageUsers(profile.role)) {
    return <div className="empty-state">Доступ запрещен.</div>;
  }

  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  const [manageableObjects, availableRoles, usersResult, linksResult] = await Promise.all([
    listActorScopedObjectsForProfile(supabase, profile),
    Promise.resolve(listAvailableUserRoles(profile.role)),
    supabase.from("profiles").select("id,full_name,role").order("created_at", { ascending: false }),
    supabase.from("user_objects").select("user_id,object_id,objects(name)")
  ]);
  const { data: users } = usersResult;
  const { data: linksRaw } = linksResult;
  const emailEntries = await Promise.all(
    ((users ?? []) as Array<{ id: string }>).map(async (userRow) => {
      const { data, error } = await admin.auth.admin.getUserById(userRow.id);
      if (error) throw error;
      return [userRow.id, data.user?.email ?? null] as const;
    })
  );
  const emailById = new Map(emailEntries);

  const links = ((linksRaw ?? []) as Array<{ user_id: string; object_id: string; objects: { name: string } | null }>).map(
    (row) => ({
      user_id: row.user_id,
      object_id: row.object_id,
      object_name: row.objects?.name ?? ""
    })
  );

  return (
    <section className="grid">
      <PageHeader
        title="Пользователи"
        description="Справочник учетных записей и ролей. Создание и редактирование вынесены в отдельные потоки."
        actions={
          <Link className="btn btn-accent" href="/users/create">
            + Добавить пользователя
          </Link>
        }
      />

      <UsersAdminList
        users={
          ((users ?? []) as Array<{
            id: string;
            full_name: string;
            role: "admin" | "chief" | "lead" | "engineer" | "object_engineer" | "tech";
          }>).map((userRow) => ({
            ...userRow,
            email: emailById.get(userRow.id) ?? null
          }))
        }
        actorRole={profile.role}
        availableRoles={availableRoles as Array<"admin" | "chief" | "lead" | "engineer" | "object_engineer" | "tech">}
        objects={manageableObjects as Array<{ id: string; name: string }>}
        links={links}
        currentUserId={user.id}
      />
    </section>
  );
}
