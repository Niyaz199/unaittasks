"use client";

import { SectionCard } from "@/components/ui/section-card";
import { PprTemplateEditor } from "@/components/ppr/templates/ppr-template-editor";

type TemplateDetails = {
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

type ChecklistItem = {
  id: string;
  sort_order: number;
  title: string;
  description: string | null;
};

type ObjectOption = { id: string; name: string };
type SystemOption = { id: string; object_id: string; name: string };

function resolveName(raw: { name: string } | Array<{ name: string }> | null | undefined) {
  if (Array.isArray(raw)) return raw[0]?.name ?? "—";
  return raw?.name ?? "—";
}

export function PprTemplateDetails({
  template,
  checklistItems,
  objects,
  systems,
  onSave,
}: {
  template: TemplateDetails;
  checklistItems: ChecklistItem[];
  objects: ObjectOption[];
  systems: SystemOption[];
  onSave: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <div className="grid">
      <SectionCard>
        <div className="grid" style={{ gap: "0.5rem" }}>
          <h2 style={{ margin: 0 }}>{template.name}</h2>
          <div className="text-soft">Объект: {resolveName(template.object)}</div>
          <div className="text-soft">Система: {resolveName(template.system)}</div>
          <div className="text-soft">Создан: {new Date(template.created_at).toLocaleString("ru-RU")}</div>
        </div>
      </SectionCard>

      <SectionCard>
        <PprTemplateEditor
          action={onSave}
          templateId={template.id}
          objects={objects}
          systems={systems}
          submitLabel="Сохранить"
          initialValues={{
            object_id: template.object_id,
            system_id: template.system_id,
            name: template.name,
            description: template.description ?? "",
            period_months: template.period_months,
            base_start_date: template.base_start_date,
            norm_hours: template.norm_hours?.toString() ?? "",
            methodology: template.methodology ?? "",
            is_active: template.is_active,
            checklist_items:
              checklistItems.map((item) => ({
                title: item.title,
                description: item.description ?? "",
              })) || [],
          }}
        />
      </SectionCard>
    </div>
  );
}
