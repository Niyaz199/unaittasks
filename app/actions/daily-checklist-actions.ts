"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { canManageDailyChecklistTemplates } from "@/lib/daily-checklists/access";
import { buildScheduleLabel, sanitizeScheduleConfig } from "@/lib/daily-checklists/scheduler";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { DailyChecklistRole, DailyChecklistScheduleType } from "@/lib/types";

function asStringArray(value: FormDataEntryValue | FormDataEntryValue[] | null) {
  if (value == null) return [] as string[];
  return Array.isArray(value) ? value.map(String) : [String(value)];
}

function buildTemplateItems(formData: FormData) {
  const titles = asStringArray(formData.getAll("item_title"));
  const descriptions = asStringArray(formData.getAll("item_description"));
  const scheduleTypes = asStringArray(formData.getAll("item_schedule_type")) as DailyChecklistScheduleType[];
  const weekdays = asStringArray(formData.getAll("item_weekday"));
  const monthDays = asStringArray(formData.getAll("item_month_days"));
  const rangeStarts = asStringArray(formData.getAll("item_range_start"));
  const rangeEnds = asStringArray(formData.getAll("item_range_end"));
  const requiredIndexes = new Set(asStringArray(formData.getAll("item_is_required")));
  const escalationIndexes = new Set(asStringArray(formData.getAll("item_allow_task_escalation")));

  return titles
    .map((title, index) => {
      const trimmedTitle = title.trim();
      if (!trimmedTitle) return null;

      const scheduleType = scheduleTypes[index] ?? "daily";
      const rawConfig =
        scheduleType === "weekday"
          ? { weekday: Number(weekdays[index] || 1) }
          : scheduleType === "month_days"
            ? {
                days: (monthDays[index] ?? "")
                  .split(",")
                  .map((value) => Number(value.trim()))
                  .filter((value) => Number.isInteger(value)),
              }
            : scheduleType === "month_range"
              ? {
                  startDay: Number(rangeStarts[index] || 1),
                  endDay: Number(rangeEnds[index] || 1),
                }
              : {};

      const scheduleConfig = sanitizeScheduleConfig(scheduleType, rawConfig);
      return {
        sort_order: index + 1,
        title: trimmedTitle,
        description: descriptions[index]?.trim() || null,
        schedule_type: scheduleType,
        schedule_config: scheduleConfig,
        schedule_label: buildScheduleLabel(scheduleType, scheduleConfig),
        is_required: requiredIndexes.has(String(index)),
        allow_task_escalation: escalationIndexes.has(String(index)),
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
}

export async function saveDailyChecklistTemplateActionSafe(
  formData: FormData
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { profile } = await requireProfile();
    if (!canManageDailyChecklistTemplates(profile.role)) {
      return { ok: false, error: "Нет прав на управление шаблонами чек-листов" };
    }

    const profileId = String(formData.get("profile_id") ?? "").trim();
    if (!profileId) {
      return { ok: false, error: "Выберите сотрудника" };
    }

    const name = String(formData.get("name") ?? "").trim();
    if (!name) {
      return { ok: false, error: "Укажите название шаблона" };
    }

    const items = buildTemplateItems(formData);
    if (!items.length) {
      return { ok: false, error: "Добавьте хотя бы один пункт чек-листа" };
    }

    const supabase = await createSupabaseServerClient();
    const { data: targetProfile, error: targetProfileError } = await supabase
      .from("profiles")
      .select("id,role")
      .eq("id", profileId)
      .maybeSingle();
    if (targetProfileError) {
      return { ok: false, error: targetProfileError.message };
    }
    const targetRole = targetProfile?.role as DailyChecklistRole | undefined;
    if (!targetRole || !["lead", "engineer", "object_engineer"].includes(targetRole)) {
      return { ok: false, error: "Для выбранного сотрудника персональный чек-лист не поддерживается" };
    }

    const { data: latest, error: latestError } = await supabase
      .from("daily_checklist_templates")
      .select("version")
      .eq("profile_id", profileId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestError) {
      return { ok: false, error: latestError.message };
    }

    const nextVersion = Number(latest?.version ?? 0) + 1;

    const { data: template, error: templateError } = await supabase
      .from("daily_checklist_templates")
      .insert({
        profile_id: profileId,
        role_snapshot: targetRole,
        version: nextVersion,
        name,
        description: String(formData.get("description") ?? "").trim() || null,
        is_active: false,
        created_by: profile.id,
      })
      .select("id")
      .single();
    if (templateError || !template) {
      return { ok: false, error: templateError?.message ?? "Не удалось сохранить шаблон" };
    }

    const rows = items.map((item) => ({
      template_id: template.id,
      ...item,
    }));
    const { error: itemsError } = await supabase.from("daily_checklist_template_items").insert(rows);
    if (itemsError) {
      return { ok: false, error: itemsError.message };
    }

    const archivedAt = new Date().toISOString();
    const { error: deactivateError } = await supabase
      .from("daily_checklist_templates")
      .update({ is_active: false, archived_at: archivedAt })
      .eq("profile_id", profileId)
      .eq("is_active", true)
      .is("archived_at", null);
    if (deactivateError) {
      return { ok: false, error: deactivateError.message };
    }

    const { error: activateError } = await supabase
      .from("daily_checklist_templates")
      .update({ is_active: true })
      .eq("id", template.id);
    if (activateError) {
      return { ok: false, error: activateError.message };
    }

    revalidatePath("/checklists");
    revalidatePath("/checklists/templates");
    revalidatePath("/checklists/control");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Не удалось сохранить шаблон" };
  }
}
