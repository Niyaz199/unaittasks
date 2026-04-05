"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/audit";
import { canManagePprTemplates } from "@/lib/ppr/permissions";
import { canAccessPprTemplateScreens, listPprManageableObjectsForProfile } from "@/lib/ppr/queries";
import { pprWorkTemplateFormSchema } from "@/lib/ppr/validators";

type SupabaseServer = Awaited<ReturnType<typeof createSupabaseServerClient>>;

type ChecklistItemPayload = {
  sortOrder: number;
  title: string;
  description?: string | null;
};

async function requireTemplateManager() {
  const { profile } = await requireProfile();
  if (!canAccessPprTemplateScreens(profile.role)) {
    throw new Error("Нет доступа к шаблонам ППР");
  }

  const supabase = await createSupabaseServerClient();
  const objects = await listPprManageableObjectsForProfile(supabase, profile);
  return { profile, supabase, managedObjectIds: objects.map((item) => item.id) };
}

function assertTemplateObjectAllowed(role: string, managedObjectIds: string[], objectId: string) {
  if (role === "admin" || role === "chief") return;
  if (!managedObjectIds.includes(objectId)) {
    throw new Error("Объект недоступен для изменения шаблонов ППР");
  }
}

async function assertTemplateSystemBelongsToObject(supabase: SupabaseServer, systemId: string, objectId: string) {
  const { data: system, error } = await supabase.from("ppr_systems").select("object_id").eq("id", systemId).single();
  if (error) throw error;
  if (!system || system.object_id !== objectId) {
    throw new Error("Система шаблона должна принадлежать выбранному объекту");
  }
}

function parseChecklistItems(formData: FormData): ChecklistItemPayload[] {
  const titles = formData.getAll("checklist_title").map((value) => String(value ?? "").trim());
  const descriptions = formData.getAll("checklist_description").map((value) => {
    const raw = String(value ?? "").trim();
    return raw ? raw : null;
  });

  return titles
    .map((title, index) => ({
      sortOrder: index + 1,
      title,
      description: descriptions[index] ?? null,
    }))
    .filter((item) => item.title.length > 0);
}

function parseOptionalNumber(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const parsed = Number(raw.replace(",", "."));
  if (Number.isNaN(parsed)) {
    throw new Error("Некорректное значение нормо-часов");
  }
  return parsed;
}

async function replaceTemplateChecklist(
  supabase: SupabaseServer,
  templateId: string,
  objectId: string,
  checklistItems: ChecklistItemPayload[]
) {
  const { error: deleteError } = await supabase.from("ppr_work_checklist_items").delete().eq("template_id", templateId);
  if (deleteError) throw deleteError;

  if (!checklistItems.length) return;

  const { error: insertError } = await supabase.from("ppr_work_checklist_items").insert(
    checklistItems.map((item) => ({
      object_id: objectId,
      template_id: templateId,
      sort_order: item.sortOrder,
      title: item.title,
      description: item.description ?? null,
    }))
  );
  if (insertError) throw insertError;
}

export async function createPprWorkTemplateAction(formData: FormData) {
  const { profile, supabase, managedObjectIds } = await requireTemplateManager();
  const checklistItems = parseChecklistItems(formData);
  const payload = pprWorkTemplateFormSchema.parse({
    objectId: String(formData.get("object_id") ?? ""),
    systemId: String(formData.get("system_id") ?? ""),
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? "") || null,
    periodMonths: Number(formData.get("period_months") ?? 0),
    baseStartDate: String(formData.get("base_start_date") ?? ""),
    normHours: parseOptionalNumber(formData.get("norm_hours")),
    methodology: String(formData.get("methodology") ?? "") || null,
    isActive: formData.get("is_active") === "on",
    checklistItems,
  });

  assertTemplateObjectAllowed(profile.role, managedObjectIds, payload.objectId);
  if (!canManagePprTemplates({ id: profile.id, role: profile.role, accessibleObjectIds: managedObjectIds }, payload.objectId)) {
    throw new Error("Нет прав на создание шаблона ППР");
  }

  await assertTemplateSystemBelongsToObject(supabase, payload.systemId, payload.objectId);

  const { data, error } = await supabase
    .from("ppr_work_templates")
    .insert({
      object_id: payload.objectId,
      system_id: payload.systemId,
      name: payload.name.trim(),
      description: payload.description?.trim() || null,
      period_months: payload.periodMonths,
      base_start_date: payload.baseStartDate,
      norm_hours: payload.normHours ?? null,
      methodology: payload.methodology?.trim() || null,
      is_active: payload.isActive,
    })
    .select("id")
    .single();
  if (error) throw error;

  await replaceTemplateChecklist(supabase, data.id, payload.objectId, payload.checklistItems);

  await writeAudit({
    actorId: profile.id,
    action: "create_ppr_template",
    entityType: "ppr_template",
    entityId: data.id,
    meta: {
      object_id: payload.objectId,
      system_id: payload.systemId,
      period_months: payload.periodMonths,
      checklist_count: payload.checklistItems.length,
    },
  });

  revalidatePath("/ppr/templates");
}

export async function updatePprWorkTemplateAction(formData: FormData) {
  const { profile, supabase, managedObjectIds } = await requireTemplateManager();
  const templateId = String(formData.get("template_id") ?? "");
  const checklistItems = parseChecklistItems(formData);
  const payload = pprWorkTemplateFormSchema.parse({
    objectId: String(formData.get("object_id") ?? ""),
    systemId: String(formData.get("system_id") ?? ""),
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? "") || null,
    periodMonths: Number(formData.get("period_months") ?? 0),
    baseStartDate: String(formData.get("base_start_date") ?? ""),
    normHours: parseOptionalNumber(formData.get("norm_hours")),
    methodology: String(formData.get("methodology") ?? "") || null,
    isActive: formData.get("is_active") === "on",
    checklistItems,
  });

  assertTemplateObjectAllowed(profile.role, managedObjectIds, payload.objectId);
  if (!canManagePprTemplates({ id: profile.id, role: profile.role, accessibleObjectIds: managedObjectIds }, payload.objectId)) {
    throw new Error("Нет прав на изменение шаблона ППР");
  }

  await assertTemplateSystemBelongsToObject(supabase, payload.systemId, payload.objectId);

  const { error } = await supabase
    .from("ppr_work_templates")
    .update({
      object_id: payload.objectId,
      system_id: payload.systemId,
      name: payload.name.trim(),
      description: payload.description?.trim() || null,
      period_months: payload.periodMonths,
      base_start_date: payload.baseStartDate,
      norm_hours: payload.normHours ?? null,
      methodology: payload.methodology?.trim() || null,
      is_active: payload.isActive,
    })
    .eq("id", templateId);
  if (error) throw error;

  await replaceTemplateChecklist(supabase, templateId, payload.objectId, payload.checklistItems);

  await writeAudit({
    actorId: profile.id,
    action: "update_ppr_template",
    entityType: "ppr_template",
    entityId: templateId,
    meta: {
      object_id: payload.objectId,
      system_id: payload.systemId,
      period_months: payload.periodMonths,
      checklist_count: payload.checklistItems.length,
    },
  });

  revalidatePath("/ppr/templates");
  revalidatePath(`/ppr/templates/${templateId}`);
}
