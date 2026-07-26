import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const cors = { "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-training-automation-token", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const labels = new Set(["battery", "biological", "cardboard", "clothes", "glass", "metal", "paper", "plastic", "shoes", "trash"]);
const authorized = (request: Request) => {
  const expected = Deno.env.get("TRAINING_AUTOMATION_TOKEN");
  const supplied = request.headers.get("x-training-automation-token");
  return Boolean(expected && supplied && supplied.length === expected.length && supplied === expected);
};

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405, headers: cors });
  if (!authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401, headers: cors });
  try {
    const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: batchId, error: claimError } = await service.rpc("claim_next_training_batch");
    if (claimError) throw claimError;
    if (!batchId) return Response.json({ batch: null }, { headers: { ...cors, "Cache-Control": "no-store" } });
    const { data, error } = await service.from("scan_feedback").select("id,user_id,normalized_label,image_path,model_version,reviewed_at").eq("training_batch_id", batchId).eq("review_status", "approved").eq("training_consent", true).not("image_path", "is", null);
    if (error) throw error;
    const examples = (await Promise.all((data ?? []).map(async (row) => {
      const label = String(row.normalized_label ?? "").toLowerCase();
      if (!labels.has(label) || !row.image_path) return null;
      const { data: signed } = await service.storage.from("training-feedback").createSignedUrl(row.image_path, 60 * 60);
      if (!signed?.signedUrl) return null;
      return { example_id: row.id, label, image_url: signed.signedUrl, source_group: await hash(String(row.user_id)), model_version: row.model_version, reviewed_at: row.reviewed_at };
    }))).filter(Boolean);
    if (!examples.length) {
      await service.rpc("finish_training_batch", { p_batch_id: batchId, p_status: "failed", p_error_message: "No valid signed training images in this batch." });
      return Response.json({ error: "Claimed batch had no valid images." }, { status: 409, headers: cors });
    }
    return Response.json({ batch: { id: batchId, examples, labels: [...labels], expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString() } }, { headers: { ...cors, "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("claim-training-batch failed", error);
    return Response.json({ error: "Training batch claim failed." }, { status: 503, headers: cors });
  }
});

async function hash(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 16);
}
