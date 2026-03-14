"use client";

import Link from "next/link";
import type { Route } from "next";
import { useState } from "react";
import { createPprWorkTemplateAction } from "@/app/actions/ppr-template-actions";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { PprModal } from "@/components/ppr/ui/ppr-modal";
import { Badge } from "@/components/ui/badge";
import { PprTemplateEditor } from "@/components/ppr/templates/ppr-template-editor";

type TemplateRow = {
  id: string;
  object_id: string;
  subsystem_id: string;
  name: string;
  description: string | null;
  period_months: number;
  base_start_date: string;
  norm_hours: number | null;
  methodology: string | null;
  is_active: boolean;
  created_at: string;
  object: { name: string } | Array<{ name: string }> | null;
  subsystem: { name: string } | Array<{ name: string }> | null;
};

type ObjectOption = { id: string; name: string };
type SubsystemOption = { id: string; object_id: string; system_id: string; name: string };

function resolveName(raw: { name: string } | Array<{ name: string }> | null | undefined) {
  if (Array.isArray(raw)) return raw[0]?.name ?? "—";
  return raw?.name ?? "—";
}

export function PprTemplatesAdmin({
  templates,
  objects,
  subsystems,
}: {
  templates: TemplateRow[];
  objects: ObjectOption[];
  subsystems: SubsystemOption[];
}) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const hasPrerequisites = objects.length > 0 && subsystems.length > 0;

  return (
    <>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <div className="text-soft">Шаблоны ППР создаются на уровне подсистем и содержат базовую периодичность с чек-листом.</div>
        <button className="btn btn-accent" type="button" onClick={() => setIsCreateOpen(true)} disabled={!hasPrerequisites}>
          + Добавить шаблон
        </button>
      </div>

      {!hasPrerequisites ? (
        <EmptyState
          message="Недостаточно структуры для создания шаблонов"
          hint="Для шаблона ППР нужны доступные объекты и хотя бы одна подсистема из предыдущих батчей."
        />
      ) : !templates.length ? (
        <EmptyState message="Шаблоны ППР пока не созданы" hint="Создайте первый шаблон и заполните его чек-лист." />
      ) : (
        <>
          <div className="desktop-only">
            <DataTable
              columns={[
                { key: "name", label: "Шаблон" },
                { key: "object", label: "Объект" },
                { key: "subsystem", label: "Подсистема" },
                { key: "period", label: "Период" },
                { key: "status", label: "Статус" },
                { key: "actions", label: "Действия" },
              ]}
            >
              {templates.map((template) => (
                <tr key={template.id}>
                  <td>{template.name}</td>
                  <td>{resolveName(template.object)}</td>
                  <td>{resolveName(template.subsystem)}</td>
                  <td>{template.period_months} мес.</td>
                  <td>
                    <Badge tone={template.is_active ? "success" : "neutral"}>
                      {template.is_active ? "Активен" : "Отключен"}
                    </Badge>
                  </td>
                  <td>
                    <div className="ppr-table-actions">
                      <Link className="btn btn-ghost ppr-action-btn" href={`/ppr/templates/${template.id}` as Route}>
                        Открыть
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </DataTable>
          </div>

          <div className="mobile-cards mobile-only">
            {templates.map((template) => (
              <div key={template.id} className="section-card mobile-card">
                <div className="grid" style={{ gap: "0.45rem" }}>
                  <div>{template.name}</div>
                  <div className="text-soft">Объект: {resolveName(template.object)}</div>
                  <div className="text-soft">Подсистема: {resolveName(template.subsystem)}</div>
                  <div className="text-soft">Период: {template.period_months} мес.</div>
                  <div>
                    <Badge tone={template.is_active ? "success" : "neutral"}>
                      {template.is_active ? "Активен" : "Отключен"}
                    </Badge>
                  </div>
                  <div className="ppr-table-actions">
                    <Link className="btn btn-ghost ppr-action-btn" href={`/ppr/templates/${template.id}` as Route}>
                      Открыть
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <PprModal open={isCreateOpen} onClose={() => { setIsCreateOpen(false); setIsDirty(false); }} title="Новый шаблон ППР" isDirty={isDirty}>
        <PprTemplateEditor
          action={createPprWorkTemplateAction}
          objects={objects}
          subsystems={subsystems}
          submitLabel="Создать"
          onChange={() => setIsDirty(true)}
          onSubmitted={() => { setIsCreateOpen(false); setIsDirty(false); }}
          inModal={true}
        />
      </PprModal>
    </>
  );
}
