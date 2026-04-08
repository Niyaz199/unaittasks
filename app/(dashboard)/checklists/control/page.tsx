import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { canReadDailyChecklistControl } from "@/lib/daily-checklists/access";
import {
  listDailyChecklistControlProfilesForProfile,
  listDailyChecklistControlRowsForProfile,
} from "@/lib/daily-checklists/queries";
import { toDailyChecklistOperationalDate } from "@/lib/daily-checklists/scheduler";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { BackButton } from "@/components/ui/back-button";
import { PageHeader } from "@/components/ui/page-header";
import { ChecklistControlFilters } from "@/components/checklists/checklist-control-filters";
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
  
  const today = toDailyChecklistOperationalDate(new Date());
  const selectedDate = typeof search.date === "string" ? search.date : today;

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

      <ChecklistControlFilters 
        selectedDate={selectedDate}
        selectedRole={selectedRole}
        selectedProfileId={selectedProfileId}
        profiles={profiles}
      />

      {rows.length ? (
        <div className="grid" style={{ gap: "0.75rem" }}>
          {rows.map((row) => {
            const hasProblems = row.problem_items > 0;
            const hasPending = row.pending_required_items > 0;
            const borderColor = hasProblems ? "var(--danger)" : hasPending ? "var(--warning)" : "transparent";
            const isCompleted = row.status === "completed";

            return (
              <Link 
                key={row.run_id} 
                href={`/checklists/runs/${row.run_id}`}
                className="section-card grid"
                style={{ 
                  padding: "1rem", 
                  gap: "0.75rem", 
                  textDecoration: "none", 
                  color: "inherit",
                  borderLeft: `4px solid ${borderColor}`,
                  transition: "background 0.2s"
                }}
              >
                <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
                  <div className="grid" style={{ gap: "0.25rem" }}>
                    <strong style={{ fontSize: "1.05rem" }}>{row.full_name}</strong>
                    <span className="text-soft" style={{ fontSize: "0.85rem" }}>
                      {ROLE_LABELS[row.role]} • {new Date(`${row.operational_date}T00:00:00Z`).toLocaleDateString("ru-RU")}
                    </span>
                  </div>
                  <div className="row" style={{ alignItems: "center", gap: "0.5rem" }}>
                    <Badge tone={isCompleted ? "success" : "neutral"}>
                      {isCompleted ? "День закрыт" : "В работе"}
                    </Badge>
                    <span className="text-soft">›</span>
                  </div>
                </div>

                <div className="row" style={{ gap: "1rem", flexWrap: "wrap", fontSize: "0.9rem" }}>
                  <span className="text-soft">
                    Выполнено: <strong style={{ color: "var(--text)" }}>{row.completed_items} / {row.total_items}</strong>
                  </span>
                  
                  {hasProblems ? (
                    <span style={{ color: "var(--danger)", fontWeight: 500 }}>⚠️ {row.problem_items} проблем</span>
                  ) : null}

                  {hasPending ? (
                    <span style={{ color: "var(--warning)", fontWeight: 500 }}>⏳ {row.pending_required_items} хвостов</span>
                  ) : null}

                  {row.linked_tasks > 0 ? (
                    <span style={{ color: "var(--info)" }}>🔗 {row.linked_tasks} задач</span>
                  ) : null}
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="section-card text-soft" style={{ padding: "1.5rem", textAlign: "center" }}>
          По выбранным фильтрам данных нет.
        </div>
      )}
    </section>
  );
}
