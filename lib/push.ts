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

export async function sendPushToUser(userId: string, payload: Record<string, unknown>) {
  if (!ensureConfigured()) return;
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("push_subscriptions")
    .select("id,endpoint,p256dh,auth")
    .eq("user_id", userId);

  for (const row of data ?? []) {
    try {
      await webpush.sendNotification(
        {
          endpoint: row.endpoint,
          keys: { p256dh: row.p256dh, auth: row.auth }
        },
        JSON.stringify(payload)
      );
    } catch {
      // Unsubscribed endpoints can be cleaned later by housekeeping job.
    }
  }
}
