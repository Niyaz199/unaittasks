import { NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-auth";
import { getDailyChecklistItemRunForProfile, recomputeDailyChecklistRunStatus } from "@/lib/daily-checklists/queries";
import type { DailyChecklistItemStatus } from "@/lib/types";

const ALLOWED_STATUSES: DailyChecklistItemStatus[] = ["pending", "done", "problem"];

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { supabase, profile } = await getApiSession();
    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const bundle = await getDailyChecklistItemRunForProfile(supabase, profile, id);
    if (!bundle) {
      return NextResponse.json({ error: "Checklist item not found" }, { status: 404 });
    }
    if (bundle.run.profile_id !== profile.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json()) as { status?: string; comment?: string };
    const status = ALLOWED_STATUSES.includes(body.status as DailyChecklistItemStatus)
      ? (body.status as DailyChecklistItemStatus)
      : null;
    if (!status) {
      return NextResponse.json({ error: "Некорректный статус пункта" }, { status: 400 });
    }

    const now = new Date().toISOString();
    const { error } = await supabase
      .from("daily_checklist_item_runs")
      .update({
        status,
        comment: body.comment?.trim() || null,
        completed_at: status === "pending" ? null : now,
        completed_by: status === "pending" ? null : profile.id,
        updated_at: now,
      })
      .eq("id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    await recomputeDailyChecklistRunStatus(supabase, bundle.run.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
