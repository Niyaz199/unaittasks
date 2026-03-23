"use client";

import Link from "next/link";
import type { Route } from "next";
import { useState, useMemo } from "react";
import { createPprWorkTemplateAction } from "@/app/actions/ppr-template-actions";
import { DataTable } from "@/components/ui/data-table";
import { PprModal } from "@/components/ppr/ui/ppr-modal";
import { Badge } from "@/components/ui/badge";
import { PprTemplateEditor } from "@/components/ppr/templates/ppr-template-editor";
import { PprPageShell } from "@/components/ppr/ui/ppr-page-shell";

type TemplateRow = {
  id: string;
  object_id: string;
  system_id: string;
  name: string;
  description: string | null;
  period_months: number;
  base_start_date: string;
  norm_hours: number | null;
  methodology: string | null;
  is_active: boolean;
  created_at: string;
  object: { name: string } | Array<{ name: string }> | null;
  system: { name: string } | Array<{ name: string }> | null;
};

type ObjectOption = { id: string; name: string };
type SystemOption = { id: string; object_id: string; name: string };

function resolveName(raw: { name: string } | Array<{ name: string }> | null | undefined) {
  if (Array.isArray(raw)) return raw[0]?.name ?? "—";
  return raw?.name ?? "—";
}

export function PprTemplatesAdmin({
  templates,
  objects,
  systems,
}: {
  templates: TemplateRow[];
  objects: ObjectOption[];
  systems: SystemOption[];
}) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [filterObjectId, setFilterObjectId] = useState("");
  const [filterSystemId, setFilterSystemId] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");

  const hasPrerequisites = objects.length > 0 && systems.length > 0;

  const filteredTemplates = useMemo(() => {
    return templates.filter((template) => {
      const matchesSearch = searchTerm === "" || template.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesObject = filterObjectId === "" || template.object_id === filterObjectId;
      const matchesSystem = filterSystemId === "" || template.system_id === filterSystemId;
      const matchesStatus =
        filterStatus === "all" ||
        (filterStatus === "active" && template.is_active) ||
        (filterStatus === "inactive" && !template.is_active);

      return matchesSearch && matchesObject && matchesSystem && matchesStatus;
    });
  }, [templates, searchTerm, filterObjectId, filterSystemId, filterStatus]);

  const metrics = useMemo(() => {
    return [
      { label: "Всего шаблонов", value: templates.length, tone: "neutral" as const },
      { label: "Активных", value: templates.filter((t) => t.is_active).length, tone: "success" as const },
    ];
  }, [templates]);

  return (
    <>
      <PprPageShell
        metrics={metrics}
        onSearch={setSearchTerm}
        searchPlaceholder="Поиск по названию..."
        isEmpty={!hasPrerequisites || templates.length === 0}
        emptyState={{
          message: !hasPrerequisites ? "Недостаточно структуры для создания шаблонов" : "Шаблоны ППР пока не созданы",
          hint: !hasPrerequisites ? "Для шаблона ППР нужны доступные объекты и хотя бы одна система." : "Создайте первый шаблон и заполните его чек-лист.",
        }}
        isFilteredEmpty={filteredTemplates.length === 0}
        filters={
          <>
            <select
              className="select"
              value={filterObjectId}
              onChange={(e) => {
                setFilterObjectId(e.target.value);
                setFilterSystemId("");
              }}
              style={{ maxWidth: "200px" }}
            >
              <option value="">Все объекты</option>
              {objects.map((obj) => (
                <option key={obj.id} value={obj.id}>
                  {obj.name}
                </option>
              ))}
            </select>

            <select
              className="select"
              value={filterSystemId}
              onChange={(e) => setFilterSystemId(e.target.value)}
              style={{ maxWidth: "200px" }}
            >
              <option value="">Все системы</option>
              {systems
                .filter((sys) => !filterObjectId || sys.object_id === filterObjectId)
                .map((sys) => (
                  <option key={sys.id} value={sys.id}>
                    {sys.name}
                  </option>
                ))}
            </select>

            <select
              className="select"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as "all" | "active" | "inactive")}
              style={{ maxWidth: "150px" }}
            >
              <option value="all">Все статусы</option>
              <option value="active">Активные</option>
              <option value="inactive">Неактивные</option>
            </select>

            <button className="btn btn-accent" type="button" onClick={() => setIsCreateOpen(true)} disabled={!hasPrerequisites}>
              + Добавить
            </button>
          </>
        }
      >
        <div className="desktop-only">
          <DataTable
            columns={[
              { key: "name", label: "Шаблон" },
              { key: "object", label: "Объект" },
              { key: "system", label: "Система" },
              { key: "period", label: "Период" },
              { key: "status", label: "Статус" },
              { key: "actions", label: "Действия" },
            ]}
          >
            {filteredTemplates.map((template) => (
              <tr key={template.id}>
                <td style={{ fontWeight: 600 }}>{template.name}</td>
                <td>{resolveName(template.object)}</td>
                <td>{resolveName(template.system)}</td>
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
          {filteredTemplates.map((template) => (
            <div key={template.id} className="section-card mobile-card">
              <div className="grid" style={{ gap: "0.45rem" }}>
                <div style={{ fontWeight: 600 }}>{template.name}</div>
                <div className="text-soft">Объект: {resolveName(template.object)}</div>
                <div className="text-soft">Система: {resolveName(template.system)}</div>
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
      </PprPageShell>

      <PprModal open={isCreateOpen} onClose={() => { setIsCreateOpen(false); setIsDirty(false); }} title="Новый шаблон ППР" isDirty={isDirty}>
        <PprTemplateEditor
          action={createPprWorkTemplateAction}
          objects={objects}
          systems={systems}
          submitLabel="Создать"
          onChange={() => setIsDirty(true)}
          onSubmitted={() => { setIsCreateOpen(false); setIsDirty(false); }}
          inModal={true}
        />
      </PprModal>
    </>
  );
}
