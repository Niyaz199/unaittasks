import { NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-auth";
import { getRoundsArchiveForProfile } from "@/lib/rounds/queries";

export async function GET(request: Request) {
  try {
    const { supabase, profile } = await getApiSession();
    if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(request.url);
    const result = await getRoundsArchiveForProfile(supabase, profile, {
      objectId: url.searchParams.get("objectId") ?? undefined,
      roomId: url.searchParams.get("roomId") ?? undefined,
      technicianId: url.searchParams.get("technicianId") ?? undefined,
      technicianQuery: url.searchParams.get("technician") ?? undefined,
      query: url.searchParams.get("q") ?? undefined,
      dateFrom: url.searchParams.get("dateFrom") ?? undefined,
      dateTo: url.searchParams.get("dateTo") ?? undefined,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
