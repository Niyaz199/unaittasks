import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function describeError(error: unknown): {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
  raw?: string;
} {
  if (!error) return { message: "Empty error" };
  if (error instanceof Error) {
    return { message: error.message };
  }
  if (typeof error === "object") {
    const e = error as Record<string, unknown>;
    return {
      message: typeof e.message === "string" ? e.message : "Unknown PostgREST error",
      code: typeof e.code === "string" ? e.code : undefined,
      details: typeof e.details === "string" ? e.details : undefined,
      hint: typeof e.hint === "string" ? e.hint : undefined,
      raw: JSON.stringify(error),
    };
  }
  return { message: String(error) };
}

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
    if (error) {
      const described = describeError(error);
      console.error("[cron/archive] RPC failed:", described);
      return NextResponse.json({ error: described.message, ...described }, { status: 400 });
    }
    return NextResponse.json({ ok: true, archived: data ?? 0 });
  } catch (error) {
    const described = describeError(error);
    console.error("[cron/archive] caught:", described);
    return NextResponse.json({ error: described.message, ...described }, { status: 400 });
  }
}
