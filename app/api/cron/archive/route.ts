import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const received = request.headers.get("x-cron-secret");
    if (received !== expected) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.rpc("archive_done_tasks", { hours_threshold: 36 });
    if (error) throw error;
    return NextResponse.json({ ok: true, archived: data ?? 0 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
