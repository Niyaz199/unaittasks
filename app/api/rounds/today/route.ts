import { NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-auth";
import { getRoundsTodayForProfile } from "@/lib/rounds/queries";

export async function GET(request: Request) {
  try {
    const { supabase, profile } = await getApiSession();
    if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(request.url);
    const result = await getRoundsTodayForProfile(supabase, profile, {
      objectId: url.searchParams.get("objectId") ?? undefined,
      operationalDate: url.searchParams.get("operationalDate") ?? undefined,
      query: url.searchParams.get("q") ?? undefined,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
