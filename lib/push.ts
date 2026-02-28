import webpush from "web-push";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

let isConfigured = false;

function ensureConfigured() {
  if (isConfigured) return true;

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return false;

  webpush.setVapidDetails(subject, publicKey, privateKey);
  isConfigured = true;
  return true;
}

export type PushResult = {
  total: number;
  sent: number;
  failed: number;
  cleaned: number;
  errors: string[];
};

export async function sendPushToUser(
  userId: string,
  payload: Record<string, unknown>
): Promise<PushResult> {
  const result: PushResult = { total: 0, sent: 0, failed: 0, cleaned: 0, errors: [] };

  if (!ensureConfigured()) return result;

  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("push_subscriptions")
    .select("id,endpoint,p256dh,auth")
    .eq("user_id", userId);

  const rows = data ?? [];
  result.total = rows.length;

  for (const row of rows) {
    try {
      await webpush.sendNotification(
        { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
        JSON.stringify(payload)
      );
      result.sent++;
    } catch (err: unknown) {
      const statusCode =
        err && typeof err === "object" && "statusCode" in err
          ? (err as { statusCode: number }).statusCode
          : 0;

      // 410 Gone / 404 Not Found — браузер отписался, удаляем запись
      if (statusCode === 410 || statusCode === 404) {
        await supabase.from("push_subscriptions").delete().eq("id", row.id);
        result.cleaned++;
      } else {
        result.failed++;
        const message = err instanceof Error ? err.message : String(err);
        result.errors.push(message);
      }
    }
  }

  return result;
}
