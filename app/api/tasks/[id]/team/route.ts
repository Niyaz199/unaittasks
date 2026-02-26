import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiSession } from "@/lib/api-auth";
import { writeAudit } from "@/lib/audit";
import { canManageTaskTeam as canManageTaskTeamByRole } from "@/lib/task-permissions";

const schema = z.object({
  userId: z.string().uuid()
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { userId } = schema.parse(await request.json());
    const { supabase, profile } = await getApiSession();
    if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: task } = await supabase.from("tasks").select("id,object_id,objects(object_engineer_id)").eq("id", id).single();
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    const objectsRelation = task.objects as
      | { object_engineer_id: string | null }
      | Array<{ object_engineer_id: string | null }>
      | null;
    const objectEngineerId = Array.isArray(objectsRelation)
      ? objectsRelation[0]?.object_engineer_id ?? null
      : objectsRelation?.object_engineer_id ?? null;
    const canManage = canManageTaskTeamByRole(profile.role, { objectEngineerScoped: objectEngineerId === profile.id });
    if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { error } = await supabase.from("task_team_members").upsert({
      task_id: id,
      user_id: userId,
      added_by: profile.id
    });
    if (error) throw error;

    await writeAudit({
      actorId: profile.id,
      action: "team_add_member",
      entityType: "task",
      entityId: id,
      meta: { user_id: userId }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { userId } = schema.parse(await request.json());
    const { supabase, profile } = await getApiSession();
    if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: task } = await supabase.from("tasks").select("id,object_id,objects(object_engineer_id)").eq("id", id).single();
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    const objectsRelation = task.objects as
      | { object_engineer_id: string | null }
      | Array<{ object_engineer_id: string | null }>
      | null;
    const objectEngineerId = Array.isArray(objectsRelation)
      ? objectsRelation[0]?.object_engineer_id ?? null
      : objectsRelation?.object_engineer_id ?? null;
    const canManage = canManageTaskTeamByRole(profile.role, { objectEngineerScoped: objectEngineerId === profile.id });
    if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { error } = await supabase
      .from("task_team_members")
      .delete()
      .eq("task_id", id)
      .eq("user_id", userId);
    if (error) throw error;

    await writeAudit({
      actorId: profile.id,
      action: "team_remove_member",
      entityType: "task",
      entityId: id,
      meta: { user_id: userId }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
