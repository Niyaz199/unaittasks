import { NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-auth";
import { getOrCreateDailyChecklistDayForProfile } from "@/lib/daily-checklists/queries";

export async function GET(request: Request) {
  try {
    const { supabase, profile } = await getApiSession();
    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const operationalDate = url.searchParams.get("date");
    const data = await getOrCreateDailyChecklistDayForProfile(supabase, profile, operationalDate);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
