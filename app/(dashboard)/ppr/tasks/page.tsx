import Link from "next/link";
import type { Route } from "next";
import { requireProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { canAccessPprTaskScreens, listPprTasksForProfile } from "@/lib/ppr/queries";
import { pprTaskViewMeta } from "@/lib/ppr/presentation";
import { PageHeader } from "@/components/ui/page-header";
import { BackButton } from "@/components/ui/back-button";
import { PprTasksAdmin } from "@/components/ppr/tasks/ppr-tasks-admin";

type Search = Record<string, string | string[] | undefined>;

export default async function PprTasksPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const { profile } = await requireProfile();

  if (!canAccessPprTaskScreens(profile.role)) {
    return (
      <section className="grid">
        <PageHeader title="ППР-заявки" description="Доступ к ППР-заявкам ограничен." />
        <div className="section-card">У вас нет доступа к списку ППР-заявок.</div>
      </section>
    );
  }

  const rawView = typeof params.view === "string" ? params.view : "active";
  const view = rawView === "review" ? "review" : "active";
  const supabase = await createSupabaseServerClient();
  const tasks = await listPprTasksForProfile(supabase, profile, {
    kind: "active",
    view: view === "review" ? "review" : "all",
  });

  return (
    <section className="grid">
      <PageHeader
        title="Реестр заявок ППР"
        description={view === "review" ? "Выполненные заявки, ожидающие проверки ответственным инженером." : "Все активные заявки планово-предупредительного ремонта."}
        actions={
          <>
            <BackButton fallback="/ppr" label="← Назад к ППР" />
            <Link
              href={"/ppr/tasks?view=active" as Route}
              className={`btn ${view === "active" ? "btn-accent" : "btn-ghost"}`}
            >
              {pprTaskViewMeta.active.label}
            </Link>
            <Link
              href={"/ppr/tasks?view=review" as Route}
              className={`btn ${view === "review" ? "btn-accent" : "btn-ghost"}`}
            >
              {pprTaskViewMeta.review.label}
            </Link>
            <Link href={"/ppr/archive" as Route} className="btn btn-ghost">
              {pprTaskViewMeta.archive.label}
            </Link>
          </>
        }
      />
      <PprTasksAdmin
        tasks={tasks}
        emptyMessage={view === "review" ? "Заявок на ознакомлении нет" : "Активных ППР-заявок нет"}
        emptyHint={
          view === "review"
            ? "Сюда попадают выполненные заявки, где исполнитель и ответственный различаются."
            : "После формирования месяца и создания ППР-заявок они появятся в этом списке."
        }
      />
    </section>
  );
}
