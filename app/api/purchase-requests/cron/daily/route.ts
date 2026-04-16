import { NextResponse } from "next/server";
import { writeAudit } from "@/lib/audit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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
    const payload = rawText.trim().length ? JSON.parse(rawText) : {};
    const draftDate =
      typeof payload.draft_date === "string"
        ? payload.draft_date
        : new Date().toISOString().slice(0, 10);
    const runId = typeof payload.run_id === "string" ? payload.run_id : crypto.randomUUID();
    const supabase = createSupabaseAdminClient();

    await writeAudit({
      supabase,
      actorId: null,
      action: "system_cron_run_started",
      entityType: "ppr_cron_run",
      entityId: runId,
      meta: {
        source: "cron",
        job: "purchase_request_daily_draft",
        run_id: runId,
        draft_date: draftDate,
      },
    });

    const { data, error } = await supabase.rpc("stock_build_daily_purchase_drafts", {
      _draft_date: draftDate,
    });
    if (error) throw error;

    const result = Array.isArray(data) ? data[0] ?? null : data ?? null;

    await writeAudit({
      supabase,
      actorId: null,
      action: "system_cron_run_finished",
      entityType: "ppr_cron_run",
      entityId: runId,
      meta: {
        source: "cron",
        job: "purchase_request_daily_draft",
        run_id: runId,
        draft_date: draftDate,
        result,
      },
    });

    return NextResponse.json({
      ok: true,
      run_id: runId,
      draft_date: draftDate,
      result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
