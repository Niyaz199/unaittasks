import Link from "next/link";
import { canManageUsers, requireProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createUserAction } from "@/app/actions/user-actions";
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
  const { data: objects } = await supabase.from("objects").select("id,name").order("name");

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

      <form className="section-card grid" action={createUserAction}>
        <div className="field-row">
          <input className="input" name="email" placeholder="Email" type="email" required />
          <input className="input" name="password" placeholder="Пароль (>=8)" required />
        </div>
        <div className="field-row">
          <input className="input" name="full_name" placeholder="ФИО" required />
          <select className="select" name="role" defaultValue="engineer">
            <option value="admin">admin</option>
            <option value="chief">chief</option>
            <option value="lead">lead</option>
            <option value="engineer">engineer</option>
            <option value="object_engineer">object_engineer</option>
            <option value="tech">tech</option>
          </select>
        </div>
        <div className="grid">
          <div className="text-soft">Объекты для инженера:</div>
          <div className="row" style={{ flexWrap: "wrap" }}>
            {(objects ?? []).map((objectItem) => (
              <label
                key={objectItem.id}
                className="badge badge-neutral"
                style={{ display: "inline-flex", gap: 6, alignItems: "center" }}
              >
                <input type="checkbox" name="object_ids" value={objectItem.id} />
                {objectItem.name}
              </label>
            ))}
          </div>
        </div>
        <div className="row">
          <button className="btn btn-accent" type="submit">
            Создать пользователя
          </button>
        </div>
      </form>
    </section>
  );
}
