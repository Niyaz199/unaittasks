import { NextResponse } from "next/server";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { runPprMonthlyCycle } from "@/lib/ppr/scheduler";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  anchor_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  run_id: z.string().uuid().optional(),
});

function cronMeta(job: string, runId: string, extra: Record<string, unknown> = {}) {
  return {
    source: "cron",
    job,
    run_id: runId,
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
    const rawText = await request.text();
    const raw = rawText.trim().length ? JSON.parse(rawText) : {};
    const payload = schema.parse(raw);
    const runId = payload.run_id ?? crypto.randomUUID();
    const supabase = createSupabaseAdminClient();

    await writeAudit({
      supabase,
      actorId: null,
      action: "system_cron_run_started",
      entityType: "ppr_cron_run",
      entityId: runId,
      meta: cronMeta("monthly_cycle", runId, {
        anchor_date: payload.anchor_date ?? null,
      }),
    });

    const result = await runPprMonthlyCycle(supabase, {
      anchorDate: payload.anchor_date,
      runId,
    });

    await writeAudit({
      supabase,
      actorId: null,
      action: "system_cron_run_finished",
      entityType: "ppr_cron_run",
      entityId: runId,
      meta: cronMeta("monthly_cycle", runId, result),
    });

    return NextResponse.json({
      ok: true,
      run_id: runId,
      ...result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid payload", details: error.flatten() }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
