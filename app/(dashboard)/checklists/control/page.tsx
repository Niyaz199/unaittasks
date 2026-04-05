import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { canReadDailyChecklistControl } from "@/lib/daily-checklists/access";
import {
  listDailyChecklistControlProfilesForProfile,
  listDailyChecklistControlRowsForProfile,
} from "@/lib/daily-checklists/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { BackButton } from "@/components/ui/back-button";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import type { DailyChecklistRole } from "@/lib/types";

const ROLE_LABELS: Record<DailyChecklistRole, string> = {
  lead: "Ведущий инженер",
  engineer: "Инженер",
  object_engineer: "Инженер объекта",
};

export default async function DailyChecklistControlPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const search = searchParams ? await searchParams : {};
  const { profile } = await requireProfile();
  if (!canReadDailyChecklistControl(profile.role)) {
    return (
      <section className="grid">
        <PageHeader title="Контроль чек-листов" description="Доступ к контролю выполнения ограничен." />
        <div className="section-card">У вас нет доступа к контролю выполнения чек-листов.</div>
      </section>
    );
  }

  const supabase = await createSupabaseServerClient();
  const selectedRole =
    typeof search.role === "string" && ["lead", "engineer", "object_engineer"].includes(search.role)
      ? (search.role as DailyChecklistRole)
      : "all";
  const selectedProfileId = typeof search.profileId === "string" ? search.profileId : "all";
  const selectedDate = typeof search.date === "string" ? search.date : "";

  const [profiles, rows] = await Promise.all([
    listDailyChecklistControlProfilesForProfile(supabase, profile),
    listDailyChecklistControlRowsForProfile(supabase, profile, {
      operationalDate: selectedDate || undefined,
      role: selectedRole,
      profileId: selectedProfileId,
    }),
  ]);

  return (
    <section className="grid" style={{ gap: "1rem" }}>
      <PageHeader
        title="Контроль чек-листов"
        description="Сводка выполнения персональных чек-листов по сотрудникам, ролям и операционным датам."
        actions={<BackButton fallback="/checklists" label="← К чек-листам" />}
      />

      <form className="section-card row" style={{ gap: "0.75rem", flexWrap: "wrap", padding: "1rem" }}>
        <label className="grid" style={{ gap: "0.35rem", minWidth: "12rem" }}>
          <span className="text-soft">Дата</span>
          <input className="input" type="date" name="date" defaultValue={selectedDate} />
        </label>

        <label className="grid" style={{ gap: "0.35rem", minWidth: "12rem" }}>
          <span className="text-soft">Роль</span>
          <select className="select" name="role" defaultValue={selectedRole}>
            <option value="all">Все роли</option>
            <option value="lead">Ведущий инженер</option>
            <option value="engineer">Инженер</option>
            <option value="object_engineer">Инженер объекта</option>
          </select>
        </label>

        <label className="grid" style={{ gap: "0.35rem", minWidth: "14rem" }}>
          <span className="text-soft">Сотрудник</span>
          <select className="select" name="profileId" defaultValue={selectedProfileId}>
            <option value="all">Все сотрудники</option>
            {profiles.map((item) => (
              <option key={item.id} value={item.id}>
                {item.full_name}
              </option>
            ))}
          </select>
        </label>

        <div className="row" style={{ alignItems: "flex-end" }}>
          <button className="btn btn-accent" type="submit">
            Применить
          </button>
        </div>
      </form>

      {rows.length ? (
        <DataTable
          columns={[
            { key: "full_name", label: "Сотрудник" },
            { key: "role", label: "Роль" },
            { key: "date", label: "Дата" },
            { key: "status", label: "Статус" },
            { key: "metrics", label: "Метрики" },
            { key: "actions", label: "" },
          ]}
        >
          {rows.map((row) => (
            <tr key={row.run_id}>
              <td>{row.full_name}</td>
              <td>{ROLE_LABELS[row.role]}</td>
              <td>{new Date(`${row.operational_date}T00:00:00Z`).toLocaleDateString("ru-RU")}</td>
              <td>
                <Badge tone={row.status === "completed" ? "success" : "warning"}>
                  {row.status === "completed" ? "День закрыт" : "В работе"}
                </Badge>
              </td>
              <td>
                <div className="row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
                  <Badge tone="info">Всего: {row.total_items}</Badge>
                  <Badge tone="success">Ок: {row.completed_items}</Badge>
                  <Badge tone="danger">Проблем: {row.problem_items}</Badge>
                  <Badge tone="warning">Хвосты: {row.pending_required_items}</Badge>
                  <Badge tone="neutral">Задачи: {row.linked_tasks}</Badge>
                </div>
              </td>
              <td>
                <Link className="btn btn-ghost" href={`/checklists/runs/${row.run_id}`}>
                  Подробнее
                </Link>
              </td>
            </tr>
          ))}
        </DataTable>
      ) : (
        <div className="section-card text-soft">По выбранным фильтрам данных нет.</div>
      )}
    </section>
  );
}
