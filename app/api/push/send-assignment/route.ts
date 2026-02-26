import { NextResponse } from "next/server";
import { z } from "zod";
import { canEditTasks } from "@/lib/auth";
import { getApiSession } from "@/lib/api-auth";
import { sendPushToUser } from "@/lib/push";

const schema = z.object({
  taskId: z.string().uuid(),
  assignedTo: z.string().uuid(),
  taskTitle: z.string().min(1),
  objectName: z.string().optional()
});

export async function POST(request: Request) {
  try {
    const { profile } = await getApiSession();
    if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!canEditTasks(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const payload = schema.parse(await request.json());
    await sendPushToUser(payload.assignedTo, {
      title: "Новая задача",
      body: `${payload.taskTitle}${payload.objectName ? ` (${payload.objectName})` : ""}`,
      taskId: payload.taskId,
      url: `/tasks/${payload.taskId}`
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
