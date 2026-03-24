import { NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-auth";
import { canManageRoundsConfig } from "@/lib/rounds/permissions";

export async function POST() {
  const { profile } = await getApiSession();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageRoundsConfig(profile.role)) {
    return NextResponse.json({ error: "Недостаточно прав для управления QR помещений" }, { status: 403 });
  }

  return NextResponse.json(
    {
      error: "QR помещений создаются автоматически при создании помещения. Для пересоздания используйте карточку помещения.",
    },
    { status: 410 }
  );
}
