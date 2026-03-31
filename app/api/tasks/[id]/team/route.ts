import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiSession } from "@/lib/api-auth";
import { hasActorScopedObjectAccessForProfile } from "@/lib/access/object-scope";
import { writeAudit } from "@/lib/audit";
import { canCreateOrAssignTask, canManageTaskTeam as canManageTaskTeamByRole } from "@/lib/task-permissions";
import type { Role } from "@/lib/types";

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
    const objectEngineerScoped = objectEngineerId === profile.id;
    const canManage = canManageTaskTeamByRole(profile.role, { objectEngineerScoped });
    if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { data: memberProfile } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
    const memberRole = memberProfile?.role as Role | undefined;
    if (!memberRole) return NextResponse.json({ error: "\u041d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d \u043f\u0440\u043e\u0444\u0438\u043b\u044c \u0443\u0447\u0430\u0441\u0442\u043d\u0438\u043a\u0430 \u043a\u043e\u043c\u0430\u043d\u0434\u044b" }, { status: 400 });
    if (!canCreateOrAssignTask(profile.role, memberRole, { objectEngineerScoped })) {
      return NextResponse.json({ error: "\u041d\u0435\u0434\u043e\u0441\u0442\u0430\u0442\u043e\u0447\u043d\u043e \u043f\u0440\u0430\u0432 \u0434\u043b\u044f \u0434\u043e\u0431\u0430\u0432\u043b\u0435\u043d\u0438\u044f \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u043e\u0433\u043e \u0443\u0447\u0430\u0441\u0442\u043d\u0438\u043a\u0430 \u043a\u043e\u043c\u0430\u043d\u0434\u044b" }, { status: 403 });
    }
    const hasObjectAccess = await hasActorScopedObjectAccessForProfile(
      supabase,
      { id: userId, role: memberRole },
      task.object_id
    );
    if (!hasObjectAccess) {
      return NextResponse.json({ error: "\u0412\u044b\u0431\u0440\u0430\u043d\u043d\u044b\u0439 \u0443\u0447\u0430\u0441\u0442\u043d\u0438\u043a \u043a\u043e\u043c\u0430\u043d\u0434\u044b \u043d\u0435 \u0438\u043c\u0435\u0435\u0442 \u0434\u043e\u0441\u0442\u0443\u043f\u0430 \u043a \u043e\u0431\u044a\u0435\u043a\u0442\u0443 \u0437\u0430\u0434\u0430\u0447\u0438" }, { status: 403 });
    }

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
