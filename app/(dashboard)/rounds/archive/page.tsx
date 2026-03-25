import { requireProfile } from "@/lib/auth";
import { BackButton } from "@/components/ui/back-button";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { canReadRoundsReports } from "@/lib/rounds/permissions";
import { getRoundsArchiveForProfile } from "@/lib/rounds/queries";

export default async function RoundsArchivePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const search = searchParams ? await searchParams : {};
  const { profile, supabase } = await requireProfile();

  if (!canReadRoundsReports(profile.role)) {
    return (
      <section className="grid">
        <PageHeader title="Архив обходов" description="Доступ к архиву обходов ограничен." />
        <div className="section-card">У вас нет доступа к архиву обходов.</div>
      </section>
    );
  }

  const data = await getRoundsArchiveForProfile(supabase, profile, {
    objectId: typeof search.objectId === "string" ? search.objectId : undefined,
    roomId: typeof search.roomId === "string" ? search.roomId : undefined,
    technicianQuery: typeof search.technician === "string" ? search.technician : undefined,
    query: typeof search.q === "string" ? search.q : undefined,
    dateFrom: typeof search.dateFrom === "string" ? search.dateFrom : undefined,
    dateTo: typeof search.dateTo === "string" ? search.dateTo : undefined,
  });

  return (
    <section className="grid">
      <PageHeader
        title="Архив обходов"
        description="История отметок помещений по датам, техникам, объектам и помещениям."
        actions={<BackButton fallback="/rounds/today" label="← К сегодняшним обходам" />}
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
        <input className="input" type="date" name="dateFrom" defaultValue={typeof search.dateFrom === "string" ? search.dateFrom : ""} />
        <input className="input" type="date" name="dateTo" defaultValue={typeof search.dateTo === "string" ? search.dateTo : ""} />
        <input className="input" type="search" name="technician" placeholder="Техник" defaultValue={typeof search.technician === "string" ? search.technician : ""} />
        <input className="input" type="search" name="q" placeholder="Поиск по помещению" defaultValue={typeof search.q === "string" ? search.q : ""} />
        <button className="btn btn-accent" type="submit">Применить</button>
      </form>

      <div className="desktop-only">
        <DataTable
          columns={[
            { key: "date", label: "Дата" },
            { key: "object", label: "Объект" },
            { key: "room", label: "Помещение" },
            { key: "user", label: "Техник" },
            { key: "time", label: "Время" },
            { key: "comment", label: "Комментарий" },
            { key: "photo", label: "Фото" },
          ]}
        >
          {data.rows.map((row) => (
            <tr key={row.id}>
              <td>{new Date(`${row.operational_date}T00:00:00`).toLocaleDateString("ru-RU")}</td>
              <td>{row.object_name}</td>
              <td>{row.room_name}</td>
              <td>{row.checked_in_by_display_name}</td>
              <td>{new Date(row.scanned_at_device).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</td>
              <td>{row.comment ? row.comment : <span className="text-soft">Без комментария</span>}</td>
              <td>
                {row.photo_url ? (
                  <a href={row.photo_url} target="_blank" rel="noreferrer" className="btn btn-ghost">
                    Открыть фото
                  </a>
                ) : (
                  <Badge tone="neutral">Нет фото</Badge>
                )}
              </td>
            </tr>
          ))}
        </DataTable>
      </div>

      <div className="mobile-cards mobile-only">
        {data.rows.map((row) => (
          <div key={row.id} className="section-card mobile-card grid" style={{ gap: "0.4rem" }}>
            <div style={{ fontWeight: 700 }}>{row.room_name}</div>
            <div className="text-soft">
              {new Date(`${row.operational_date}T00:00:00`).toLocaleDateString("ru-RU")} • {row.object_name}
            </div>
            <div className="text-soft">
              {row.checked_in_by_display_name} • {new Date(row.scanned_at_device).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
            </div>
            <div>{row.comment ? row.comment : <span className="text-soft">Без комментария</span>}</div>
            <div>{row.photo_url ? <a href={row.photo_url} target="_blank" rel="noreferrer" className="btn btn-ghost">Открыть фото</a> : <Badge tone="neutral">Нет фото</Badge>}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
