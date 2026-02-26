import Link from "next/link";
import { canManageObjects, requireProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ObjectsAdminList } from "@/components/dictionaries/objects-admin-list";
import { PageHeader } from "@/components/ui/page-header";

export default async function ObjectsPage() {
  const { profile } = await requireProfile();
  if (!canManageObjects(profile.role)) {
    return <div className="empty-state">Доступ запрещен.</div>;
  }

  const supabase = await createSupabaseServerClient();
  const [{ data: objects }, { data: objectEngineers }] = await Promise.all([
    supabase
      .from("objects")
      .select("id,name,created_at,object_engineer_id,object_engineer:profiles!objects_object_engineer_id_fkey(full_name)")
      .order("name"),
    supabase.from("profiles").select("id,full_name").eq("role", "object_engineer").order("full_name")
  ]);

  return (
    <section className="grid">
      <PageHeader
        title="Объекты"
        description="Справочник объектов эксплуатации. Создание и изменения вынесены из списка."
        actions={
          <Link className="btn btn-accent" href="/objects/create">
            + Добавить объект
          </Link>
        }
      />

      <ObjectsAdminList
        objects={
          (objects ?? []) as Array<{
            id: string;
            name: string;
            created_at: string;
            object_engineer_id: string | null;
            object_engineer: { full_name: string } | Array<{ full_name: string }> | null;
          }>
        }
        objectEngineers={(objectEngineers ?? []) as Array<{ id: string; full_name: string }>}
      />
    </section>
  );
}
