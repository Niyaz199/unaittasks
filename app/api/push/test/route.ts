import { NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-auth";
import { sendPushToUser } from "@/lib/push";

export async function POST(request: Request) {
  const { user } = await getApiSession();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const vapidConfigured =
    !!process.env.VAPID_PUBLIC_KEY &&
    !!process.env.VAPID_PRIVATE_KEY &&
    !!process.env.VAPID_SUBJECT;

  if (!vapidConfigured) {
    return NextResponse.json(
      {
        ok: false,
        error: "VAPID keys are not configured. Set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT env variables.",
      },
      { status: 503 }
    );
  }

  const result = await sendPushToUser(user.id, {
    title: "Тест уведомлений",
    body: "Если вы видите это — Web Push работает корректно.",
    url: "/my",
  });

  const ok = result.total > 0 && result.sent > 0;
  const message =
    result.total === 0
      ? "No push subscriptions found for this user. Open the app in a browser that supports Web Push and grant notification permission."
      : ok
        ? `Sent ${result.sent} of ${result.total} notification(s).`
        : `Failed to send. ${result.failed} error(s), ${result.cleaned} stale subscription(s) removed.`;

  return NextResponse.json(
    { ok, message, result },
    { status: ok || result.total === 0 ? 200 : 500 }
  );
}

// Prevent accidental GET calls leaking info
export async function GET() {
  return NextResponse.json({ error: "Use POST" }, { status: 405 });
}
