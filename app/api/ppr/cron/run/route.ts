import { NextResponse } from "next/server";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { runPprCronOrchestration } from "@/lib/ppr/scheduler";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const schema = z
  .object({
    date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    run_id: z.string().uuid(),
  })
  .refine((value) => value.date_from <= value.date_to, {
    message: "`date_from` must be less than or equal to `date_to`",
    path: ["date_to"],
  });

function cronMeta(job: string, runId: string, dateFrom: string, dateTo: string, extra: Record<string, unknown> = {}) {
  return {
    source: "cron",
    job,
    run_id: runId,
    date_from: dateFrom,
    date_to: dateTo,
    ...extra,
  };
}

export async function POST(request: Request) {
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
  }

  const receivedSecret = request.headers.get("x-cron-secret");
  if (receivedSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const raw = await request.json();
    const payload = schema.parse(raw);
    const supabase = createSupabaseAdminClient();

    await writeAudit({
      supabase,
      actorId: null,
      action: "system_cron_run_started",
      entityType: "ppr_cron_run",
      entityId: payload.run_id,
      meta: cronMeta("cron_run", payload.run_id, payload.date_from, payload.date_to),
    });

    const input = {
      dateFrom: payload.date_from,
      dateTo: payload.date_to,
      runId: payload.run_id,
    };
    const result = await runPprCronOrchestration(supabase, input);
    const carryover = result.carryover;

    await writeAudit({
      supabase,
      actorId: null,
      action: "system_carryover_completed",
      entityType: "ppr_cron_run",
      entityId: payload.run_id,
      meta: cronMeta("carryover", payload.run_id, payload.date_from, payload.date_to, carryover),
    });

    const materialization = result.materialization;
    await writeAudit({
      supabase,
      actorId: null,
      action: "system_materialization_completed",
      entityType: "ppr_cron_run",
      entityId: payload.run_id,
      meta: cronMeta("materialization", payload.run_id, payload.date_from, payload.date_to, materialization),
    });

    const sync = result.sync;
    await writeAudit({
      supabase,
      actorId: null,
      action: "system_plan_item_sync_completed",
      entityType: "ppr_cron_run",
      entityId: payload.run_id,
      meta: cronMeta("plan_item_sync", payload.run_id, payload.date_from, payload.date_to, sync),
    });

    await writeAudit({
      supabase,
      actorId: null,
      action: "system_cron_run_finished",
      entityType: "ppr_cron_run",
      entityId: payload.run_id,
      meta: cronMeta("cron_run", payload.run_id, payload.date_from, payload.date_to, {
        steps: result,
      }),
    });

    return NextResponse.json({
      ok: true,
      run_id: payload.run_id,
      date_from: payload.date_from,
      date_to: payload.date_to,
      steps: result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid payload", details: error.flatten() }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
