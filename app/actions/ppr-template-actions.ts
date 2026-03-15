"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/audit";
import { canManagePprAssignments, canManagePprTemplates } from "@/lib/ppr/permissions";
import { canAccessPprAssignmentScreens, canAccessPprTemplateScreens, listPprManageableObjectsForProfile } from "@/lib/ppr/queries";
import { pprEquipmentAssignmentFormSchema, pprWorkTemplateFormSchema } from "@/lib/ppr/validators";

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

async function requireAssignmentManager() {
  const { profile } = await requireProfile();
  if (!canAccessPprAssignmentScreens(profile.role)) {
    throw new Error("Нет доступа к назначениям ППР");
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

function assertAssignmentObjectAllowed(role: string, managedObjectIds: string[], objectId: string) {
  if (role === "admin" || role === "chief") return;
  if (!managedObjectIds.includes(objectId)) {
    throw new Error("Объект недоступен для изменения назначений ППР");
  }
}

async function assertTemplateSystemBelongsToObject(supabase: SupabaseServer, systemId: string, objectId: string) {
  const { data: system, error } = await supabase.from("ppr_systems").select("object_id").eq("id", systemId).single();
  if (error) throw error;
  if (!system || system.object_id !== objectId) {
    throw new Error("Система шаблона должна принадлежать выбранному объекту");
  }
}

async function assertAssignmentCompatibility(
  supabase: SupabaseServer,
  equipmentId: string,
  templateId: string,
  objectId: string
) {
  const [{ data: equipment, error: equipmentError }, { data: template, error: templateError }] = await Promise.all([
    supabase.from("ppr_equipment").select("object_id,system_id,status").eq("id", equipmentId).single(),
    supabase
      .from("ppr_work_templates")
      .select("object_id,system_id,is_active")
      .eq("id", templateId)
      .single(),
  ]);

  if (equipmentError) throw equipmentError;
  if (templateError) throw templateError;

  if (!equipment || equipment.object_id !== objectId) {
    throw new Error("Оборудование должно принадлежать выбранному объекту");
  }

  if (!template || template.object_id !== objectId) {
    throw new Error("Шаблон должен принадлежать выбранному объекту");
  }

  if (equipment.system_id !== template.system_id) {
    throw new Error("Шаблон можно назначать только на оборудование той же системы");
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

function parseRequiredPositiveInteger(value: FormDataEntryValue | null, errorMessage: string) {
  const raw = String(value ?? "").trim();
  const parsed = Number(raw);
  if (!raw || !Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(errorMessage);
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

export async function createPprEquipmentAssignmentAction(formData: FormData) {
  const { profile, supabase, managedObjectIds } = await requireAssignmentManager();
  const payload = pprEquipmentAssignmentFormSchema.parse({
    objectId: String(formData.get("object_id") ?? ""),
    equipmentId: String(formData.get("equipment_id") ?? ""),
    templateId: String(formData.get("template_id") ?? ""),
    startDate: String(formData.get("start_date") ?? ""),
    periodMonths: parseRequiredPositiveInteger(formData.get("period_months"), "Периодичность назначения должна быть больше 0"),
    isActive: formData.get("is_active") === "on",
  });

  assertAssignmentObjectAllowed(profile.role, managedObjectIds, payload.objectId);
  if (!canManagePprAssignments({ id: profile.id, role: profile.role, accessibleObjectIds: managedObjectIds }, payload.objectId)) {
    throw new Error("Нет прав на создание назначения ППР");
  }

  await assertAssignmentCompatibility(supabase, payload.equipmentId, payload.templateId, payload.objectId);

  const { data, error } = await supabase
    .from("ppr_equipment_work_assignments")
    .insert({
      object_id: payload.objectId,
      equipment_id: payload.equipmentId,
      template_id: payload.templateId,
      start_date: payload.startDate,
      period_months: payload.periodMonths,
      is_active: payload.isActive,
    })
    .select("id")
    .single();
  if (error) throw error;

  await writeAudit({
    actorId: profile.id,
    action: "create_ppr_assignment",
    entityType: "ppr_assignment",
    entityId: data.id,
    meta: {
      object_id: payload.objectId,
      equipment_id: payload.equipmentId,
      template_id: payload.templateId,
      start_date: payload.startDate,
      period_months: payload.periodMonths,
      is_active: payload.isActive,
    },
  });

  revalidatePath("/ppr/assignments");
}

export async function updatePprEquipmentAssignmentAction(formData: FormData) {
  const { profile, supabase, managedObjectIds } = await requireAssignmentManager();
  const assignmentId = String(formData.get("assignment_id") ?? "");
  const payload = pprEquipmentAssignmentFormSchema.parse({
    objectId: String(formData.get("object_id") ?? ""),
    equipmentId: String(formData.get("equipment_id") ?? ""),
    templateId: String(formData.get("template_id") ?? ""),
    startDate: String(formData.get("start_date") ?? ""),
    periodMonths: parseRequiredPositiveInteger(formData.get("period_months"), "Периодичность назначения должна быть больше 0"),
    isActive: formData.get("is_active") === "on",
  });

  assertAssignmentObjectAllowed(profile.role, managedObjectIds, payload.objectId);
  if (!canManagePprAssignments({ id: profile.id, role: profile.role, accessibleObjectIds: managedObjectIds }, payload.objectId)) {
    throw new Error("Нет прав на изменение назначения ППР");
  }

  await assertAssignmentCompatibility(supabase, payload.equipmentId, payload.templateId, payload.objectId);

  const { error } = await supabase
    .from("ppr_equipment_work_assignments")
    .update({
      object_id: payload.objectId,
      equipment_id: payload.equipmentId,
      template_id: payload.templateId,
      start_date: payload.startDate,
      period_months: payload.periodMonths,
      is_active: payload.isActive,
    })
    .eq("id", assignmentId);
  if (error) throw error;

  await writeAudit({
    actorId: profile.id,
    action: "update_ppr_assignment",
    entityType: "ppr_assignment",
    entityId: assignmentId,
    meta: {
      object_id: payload.objectId,
      equipment_id: payload.equipmentId,
      template_id: payload.templateId,
      start_date: payload.startDate,
      period_months: payload.periodMonths,
      is_active: payload.isActive,
    },
  });

  revalidatePath("/ppr/assignments");
}
