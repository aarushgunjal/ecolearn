import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Scheduler-only endpoint. Never accepts recipients or message contents from a caller.
Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const secret = Deno.env.get("NOTIFICATION_CRON_SECRET");
  if (!secret || request.headers.get("Authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const reminder = await db.rpc("ecolearn_enqueue_reminders");
  if (reminder.error) return Response.json({ error: "Unable to enqueue reminders" }, { status: 500 });
  const { data: jobs, error } = await db.rpc("ecolearn_claim_deliveries");
  if (error) return Response.json({ error: "Unable to claim deliveries" }, { status: 500 });
  let accepted = 0; let failed = 0;
  for (let offset = 0; offset < (jobs ?? []).length; offset += 5) {
    await Promise.all(jobs.slice(offset, offset + 5).map(async (job) => {
    try {
      let providerId: string | null = null;
      if (job.channel === "email") {
        const key = Deno.env.get("RESEND_API_KEY"); const from = Deno.env.get("NOTIFICATION_FROM_EMAIL");
        if (!key || !from) throw new Error("Email provider not configured");
        // No names or private classroom content in email or lock-screen notifications.
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST", signal: AbortSignal.timeout(15000),
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": `ecolearn-${job.id}` },
          body: JSON.stringify({ from, to: [job.destination], subject: "You have an EcoLearn update", text: "You have a new learning or community update. Sign in to view it:\nhttps://ecolearn.dev/notifications\n\nTo stop these emails, turn off Email notifications in your EcoLearn notification preferences:\nhttps://ecolearn.dev/notifications" }),
        });
        if (!response.ok) throw new Error(`Email provider HTTP ${response.status}`);
        const result = await response.json();
        if (!result.id) throw new Error("Email provider returned no message ID");
        providerId = result.id;
      } else {
        const response = await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST", signal: AbortSignal.timeout(15000),
          headers: { "Content-Type": "application/json", ...(Deno.env.get("EXPO_ACCESS_TOKEN") ? { Authorization: `Bearer ${Deno.env.get("EXPO_ACCESS_TOKEN")}` } : {}) },
          body: JSON.stringify({ to: job.destination, title: "EcoLearn", body: "You have a new learning or community update.", sound: "default", data: { notificationId: job.notification_id, path: "/notifications" } }),
        });
        if (!response.ok) throw new Error(`Push provider HTTP ${response.status}`);
        const result = await response.json();
        if (result.data?.status !== "ok") {
          if (result.data?.details?.error === "DeviceNotRegistered") await db.from("ecolearn_push_devices").delete().eq("token", job.destination);
          throw new Error(`Push rejected: ${result.data?.details?.error ?? "unknown"}`);
        }
        providerId = result.data.id;
      }
      const saved = await db.from("ecolearn_notification_deliveries").update({ delivered_at: new Date().toISOString(), provider_id: providerId, last_error: null }).eq("id", job.id).eq("lease_id", job.lease_id);
      if (saved.error) throw new Error("Unable to record provider acceptance");
      accepted++;
    } catch (error) {
      failed++;
      await db.from("ecolearn_notification_deliveries").update({ last_error: error instanceof Error ? error.message : "Delivery failed", available_at: new Date(Date.now() + 15 * 60000).toISOString() }).eq("id", job.id).eq("lease_id", job.lease_id);
    }
    }));
  }
  // Check older push tickets so uninstalled devices are removed even after initial acceptance.
  const { data: tickets } = await db.from("ecolearn_notification_deliveries").select("id,provider_id,destination").eq("channel", "push").not("provider_id", "is", null).gt("delivered_at", new Date(Date.now() - 24 * 3600000).toISOString()).lt("delivered_at", new Date(Date.now() - 15 * 60000).toISOString()).limit(100);
  if (tickets?.length) {
    try {
      const response = await fetch("https://exp.host/--/api/v2/push/getReceipts", { method: "POST", signal: AbortSignal.timeout(15000), headers: { "Content-Type": "application/json", ...(Deno.env.get("EXPO_ACCESS_TOKEN") ? { Authorization: `Bearer ${Deno.env.get("EXPO_ACCESS_TOKEN")}` } : {}) }, body: JSON.stringify({ ids: tickets.map((t) => t.provider_id) }) });
      if (!response.ok) throw new Error(`Push receipts HTTP ${response.status}`);
      {
        const receipts = (await response.json()).data ?? {};
        for (const t of tickets) {
          const receipt = receipts[t.provider_id];
          if (!receipt) continue;
          if (receipt.details?.error === "DeviceNotRegistered") await db.from("ecolearn_push_devices").delete().eq("token", t.destination);
          await db.from("ecolearn_notification_deliveries").update({ provider_id: null, last_error: receipt.status === "ok" ? null : `Push receipt: ${receipt.details?.error ?? "unknown"}` }).eq("id", t.id);
        }
      }
    } catch { failed++; }
  }
  return Response.json({ accepted, failed }, { status: failed ? 502 : 200 });
});
