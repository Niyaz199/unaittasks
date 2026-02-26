import { NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-auth";
import { getTaskHistoryForProfile } from "@/lib/tasks";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { supabase, profile } = await getApiSession();
    if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const history = await getTaskHistoryForProfile(supabase, profile, id);
    return NextResponse.json({ ok: true, history });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = /доступ/i.test(message) ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
