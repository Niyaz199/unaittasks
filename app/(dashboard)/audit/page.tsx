import { canViewAudit, requireProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

type Search = Record<string, string | string[] | undefined>;

export default async function AuditPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { profile } = await requireProfile();
  if (!canViewAudit(profile.role)) return <div className="empty-state">Доступ запрещен.</div>;

  const params = await searchParams;
  const action = typeof params.action === "string" ? params.action : "all";
  const entityType = typeof params.entity_type === "string" ? params.entity_type : "all";

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("audit_log")
    .select("id,actor_id,action,entity_type,entity_id,meta,created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (action !== "all") query = query.eq("action", action);
  if (entityType !== "all") query = query.eq("entity_type", entityType);

  const { data: rows } = await query;

  return (
    <section className="grid">
      <PageHeader title="Журнал действий" description="Лента изменений по задачам и справочникам." />

      <form className="section-card grid">
        <div className="field-row">
        <select className="select" name="action" defaultValue={action}>
          <option value="all">Любое действие</option>
          <option value="create_task">create_task</option>
          <option value="update_task">update_task</option>
          <option value="assign_task">assign_task</option>
          <option value="assign">assign</option>
          <option value="accept">accept</option>
          <option value="status_change">status_change</option>
          <option value="pause_task">pause_task</option>
          <option value="comment">comment</option>
          <option value="team_add_member">team_add_member</option>
          <option value="team_remove_member">team_remove_member</option>
          <option value="create_object">create_object</option>
          <option value="update_object">update_object</option>
          <option value="delete_object">delete_object</option>
          <option value="create_user">create_user</option>
          <option value="update_user">update_user</option>
          <option value="delete_user">delete_user</option>
        </select>
        <select className="select" name="entity_type" defaultValue={entityType}>
          <option value="all">Любая сущность</option>
          <option value="task">task</option>
          <option value="object">object</option>
          <option value="user">user</option>
          <option value="comment">comment</option>
        </select>
        </div>
        <div className="row">
          <button className="btn" type="submit">
            Фильтр
          </button>
        </div>
      </form>

      {!rows?.length ? (
        <EmptyState
          message="Записей в журнале не найдено"
          hint="Проверьте фильтры или повторите позже после новых действий в системе."
        />
      ) : (
        <>
          <div className="desktop-only">
            <DataTable
              columns={[
                { key: "dt", label: "Дата" },
                { key: "action", label: "Действие" },
                { key: "entity", label: "Сущность" },
                { key: "actor", label: "Actor" },
                { key: "meta", label: "Meta" }
              ]}
            >
              {(rows ?? []).map((row) => (
                <tr key={row.id}>
                  <td>{new Date(row.created_at).toLocaleString("ru-RU")}</td>
                  <td>
                    <Badge tone="neutral">{row.action}</Badge>
                  </td>
                  <td>
                    <Badge tone="info">{row.entity_type}</Badge>
                  </td>
                  <td>{row.actor_id}</td>
                  <td>
                    <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{JSON.stringify(row.meta)}</pre>
                  </td>
                </tr>
              ))}
            </DataTable>
          </div>

          <div className="mobile-cards mobile-only">
            {(rows ?? []).map((row) => (
              <div key={row.id} className="section-card mobile-card">
                <div className="grid" style={{ gap: "0.45rem" }}>
                  <div className="text-soft">{new Date(row.created_at).toLocaleString("ru-RU")}</div>
                  <div className="row">
                    <Badge tone="neutral">{row.action}</Badge>
                    <Badge tone="info">{row.entity_type}</Badge>
                  </div>
                  <div className="text-soft">actor: {row.actor_id}</div>
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{JSON.stringify(row.meta)}</pre>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
