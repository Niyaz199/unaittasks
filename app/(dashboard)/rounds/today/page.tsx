import { requireProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BackButton } from "@/components/ui/back-button";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { canReadRoundsReports } from "@/lib/rounds/permissions";
import { getRoundsTodayForProfile } from "@/lib/rounds/queries";
import { formatDateLabel } from "@/lib/rounds/date";

export default async function RoundsTodayPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const search = searchParams ? await searchParams : {};
  const { profile } = await requireProfile();

  if (!canReadRoundsReports(profile.role)) {
    return (
      <section className="grid">
        <PageHeader title="Обходы: сегодня" description="Доступ к странице ограничен." />
        <div className="section-card">У вас нет доступа к журналу обходов.</div>
      </section>
    );
  }

  const supabase = await createSupabaseServerClient();
  const data = await getRoundsTodayForProfile(supabase, profile, {
    objectId: typeof search.objectId === "string" ? search.objectId : undefined,
    operationalDate: typeof search.operationalDate === "string" ? search.operationalDate : undefined,
    query: typeof search.q === "string" ? search.q : undefined,
  });

  return (
    <section className="grid">
      <PageHeader
        title="Обходы: сегодня"
        description={`Операционная дата: ${formatDateLabel(data.operationalDate)}. В списке только помещения, включенные в обходы.`}
        actions={<BackButton fallback="/rounds" label="← К обходам" />}
      />

      <form className="section-card filters-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        <select className="select" name="objectId" defaultValue={typeof search.objectId === "string" ? search.objectId : ""}>
          <option value="">Все объекты</option>
          {data.objects.map((objectItem) => (
            <option key={objectItem.id} value={objectItem.id}>
              {objectItem.name}
            </option>
          ))}
        </select>
        <input className="input" type="date" name="operationalDate" defaultValue={data.operationalDate} />
        <input className="input" type="search" name="q" placeholder="Поиск по помещению" defaultValue={typeof search.q === "string" ? search.q : ""} />
        <button className="btn btn-accent" type="submit">Применить</button>
      </form>

      <div className="desktop-only">
        <DataTable
          columns={[
            { key: "object", label: "Объект" },
            { key: "room", label: "Помещение" },
            { key: "status", label: "Статус" },
            { key: "user", label: "Кто отметил" },
            { key: "time", label: "Время" },
            { key: "flags", label: "Комментарий / фото" },
          ]}
        >
          {data.rows.map((row) => (
            <tr key={row.room_id}>
              <td>{row.object_name}</td>
              <td>
                <div style={{ fontWeight: 600 }}>{row.room_name}</div>
                <div className="text-soft">{row.floor_name}</div>
              </td>
              <td>{row.status === "checked_in" ? <Badge tone="success">Отмечено</Badge> : <Badge tone="warning">Не отмечено</Badge>}</td>
              <td>{row.checked_in_by ?? "—"}</td>
              <td>{row.checked_in_at ? new Date(row.checked_in_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) : "—"}</td>
              <td>
                <div className="row" style={{ flexWrap: "wrap" }}>
                  <Badge tone={row.has_comment ? "info" : "neutral"}>{row.has_comment ? "Есть комментарий" : "Без комментария"}</Badge>
                  <Badge tone={row.has_photo ? "info" : "neutral"}>{row.has_photo ? "Есть фото" : "Без фото"}</Badge>
                </div>
              </td>
            </tr>
          ))}
        </DataTable>
      </div>

      <div className="mobile-cards mobile-only">
        {data.rows.map((row) => (
          <div key={row.room_id} className="section-card mobile-card grid" style={{ gap: "0.45rem" }}>
            <div style={{ fontWeight: 700 }}>{row.room_name}</div>
            <div className="text-soft">{row.object_name} • {row.floor_name}</div>
            <div>{row.status === "checked_in" ? <Badge tone="success">Отмечено</Badge> : <Badge tone="warning">Не отмечено</Badge>}</div>
            <div className="text-soft">
              {row.checked_in_by ? `${row.checked_in_by} • ${new Date(row.checked_in_at ?? "").toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}` : "Сегодня отметки нет"}
            </div>
            <div className="row" style={{ flexWrap: "wrap" }}>
              <Badge tone={row.has_comment ? "info" : "neutral"}>{row.has_comment ? "Комментарий" : "Без комм."}</Badge>
              <Badge tone={row.has_photo ? "info" : "neutral"}>{row.has_photo ? "Фото" : "Без фото"}</Badge>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
