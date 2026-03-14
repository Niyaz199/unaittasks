"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/audit";
import { canManagePprCalendar } from "@/lib/ppr/permissions";
import { listPprCalendarSystemsForProfile } from "@/lib/ppr/queries";
import { defaultPlannedFor, generateMonthPlanForSystem, normalizePlanMonth } from "@/lib/ppr/scheduler";
import { pprMonthPlanGenerateFormSchema, pprMonthPlanItemScheduleFormSchema } from "@/lib/ppr/validators";

type SupabaseServer = Awaited<ReturnType<typeof createSupabaseServerClient>>;

async function requireCalendarManager() {
  const { profile } = await requireProfile();
  const supabase = await createSupabaseServerClient();
  const systems = await listPprCalendarSystemsForProfile(supabase, profile);
  return { profile, supabase, systems };
}

async function assertCalendarSystemManageable(
  supabase: SupabaseServer,
  actor: { id: string; role: string },
  allowedSystems: Array<{ id: string }>,
  systemId: string
) {
  if (!allowedSystems.some((item) => item.id === systemId)) {
    throw new Error("Система недоступна для календаря ППР");
  }

  const { data: system, error } = await supabase
    .from("ppr_systems")
    .select("object_id,responsible_user_id")
    .eq("id", systemId)
    .single();
  if (error) throw error;

  const accessibleObjectIds =
    actor.role === "lead" || actor.role === "object_engineer"
      ? (
          await supabase
            .from("user_objects")
            .select("object_id")
            .eq("user_id", actor.id)
        ).data?.map((item) => item.object_id) ?? []
      : [];

  const allowed = canManagePprCalendar(
    { id: actor.id, role: actor.role as never, accessibleObjectIds },
    { objectId: system.object_id, isResponsibleForSystem: system.responsible_user_id === actor.id }
  );
  if (!allowed) {
    throw new Error("Нет прав на управление календарем ППР для выбранной системы");
  }

  return system;
}

export async function generatePprMonthPlanAction(formData: FormData) {
  const { profile, supabase, systems } = await requireCalendarManager();
  const payload = pprMonthPlanGenerateFormSchema.parse({
    systemId: String(formData.get("system_id") ?? ""),
    planMonth: String(formData.get("plan_month") ?? ""),
  });

  const normalizedPlanMonth = normalizePlanMonth(payload.planMonth);
  const system = await assertCalendarSystemManageable(supabase, profile, systems, payload.systemId);
  const result = await generateMonthPlanForSystem(supabase, {
    systemId: payload.systemId,
    planMonth: payload.planMonth,
  });

  await writeAudit({
    actorId: profile.id,
    action: "generate_ppr_month_plan",
    entityType: "ppr_month_plan",
    entityId: result.monthPlanId,
    meta: {
      object_id: system.object_id,
      system_id: payload.systemId,
      plan_month: normalizedPlanMonth,
      generated_items: result.generatedItems,
    },
  });

  revalidatePath("/ppr/calendar");
}

export async function reschedulePprMonthPlanItemAction(formData: FormData) {
  const { profile, supabase, systems } = await requireCalendarManager();
  const payload = pprMonthPlanItemScheduleFormSchema.parse({
    itemId: String(formData.get("item_id") ?? ""),
    plannedFor: String(formData.get("planned_for") ?? "") || undefined,
  });

  const { data: item, error: itemError } = await supabase
    .from("ppr_month_plan_items")
    .select("id,object_id,month_plan_id,system_id,planned_for,source_due_date,status,task_id,month_plan:ppr_month_plans(plan_month)")
    .eq("id", payload.itemId)
    .single();
  if (itemError) throw itemError;

  const system = await assertCalendarSystemManageable(supabase, profile, systems, item.system_id);
  if (item.status !== "pending" && item.status !== "carried_over") {
    throw new Error("Перенос даты доступен только для pending или carried_over позиций");
  }
  if (item.task_id) {
    throw new Error("Нельзя менять дату после materialization");
  }

  const monthPlan = Array.isArray(item.month_plan) ? item.month_plan[0] : item.month_plan;
  const plannedFor = payload.plannedFor?.trim() ? payload.plannedFor : defaultPlannedFor(monthPlan?.plan_month ?? item.planned_for);

  const { error } = await supabase
    .from("ppr_month_plan_items")
    .update({
      planned_for: plannedFor,
      is_overdue: plannedFor < new Date().toISOString().slice(0, 10),
    })
    .eq("id", payload.itemId);
  if (error) throw error;

  await writeAudit({
    actorId: profile.id,
    action: "reschedule_ppr_month_plan_item",
    entityType: "ppr_month_plan_item",
    entityId: payload.itemId,
    meta: {
      object_id: system.object_id,
      system_id: item.system_id,
      planned_for: plannedFor,
      source_due_date: item.source_due_date,
    },
  });

  revalidatePath("/ppr/calendar");
}
