import Link from "next/link";
import { canManageObjects, requireProfile } from "@/lib/auth";
import { createObjectFormAction } from "@/app/actions/task-actions";
import { PageHeader } from "@/components/ui/page-header";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function CreateObjectPage() {
  const { profile } = await requireProfile();
  if (!canManageObjects(profile.role)) {
    return <div className="empty-state">Доступ запрещен.</div>;
  }

  const supabase = await createSupabaseServerClient();
  const { data: objectEngineers } = await supabase
    .from("profiles")
    .select("id,full_name")
    .eq("role", "object_engineer")
    .order("full_name");

  return (
    <section className="grid">
      <PageHeader
        title="Добавить объект"
        description="Создайте новый объект, чтобы назначать по нему задачи."
        actions={
          <Link className="btn btn-ghost" href="/objects">
            К списку объектов
          </Link>
        }
      />

      <form action={createObjectFormAction} className="section-card grid">
        <input className="input" name="name" placeholder="Название объекта" required />
        <select className="select" name="object_engineer_id" defaultValue="">
          <option value="">Без инженера объекта</option>
          {(objectEngineers ?? []).map((engineer) => (
            <option key={engineer.id} value={engineer.id}>
              {engineer.full_name}
            </option>
          ))}
        </select>
        <div className="row">
          <button className="btn btn-accent" type="submit">
            Создать объект
          </button>
        </div>
      </form>
    </section>
  );
}
