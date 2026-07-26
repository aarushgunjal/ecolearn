import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const cors = { "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-training-automation-token", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const authorized = (request: Request) => { const expected = Deno.env.get("TRAINING_AUTOMATION_TOKEN"); const supplied = request.headers.get("x-training-automation-token"); return Boolean(expected && supplied && supplied.length === expected.length && supplied === expected); };

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405, headers: cors });
  if (!authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401, headers: cors });
  try {
    const { batch_id, status, model_version, metrics, error_message } = await request.json();
    if (typeof batch_id !== "string" || !["succeeded", "failed", "rejected"].includes(status)) return Response.json({ error: "Invalid completion payload." }, { status: 400, headers: cors });
    const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const safeMetrics = metrics && typeof metrics === "object" ? metrics : null;
    const { error } = await service.rpc("finish_training_batch", { p_batch_id: batch_id, p_status: status, p_model_version: typeof model_version === "string" ? model_version.slice(0, 120) : null, p_metrics: safeMetrics, p_error_message: typeof error_message === "string" ? error_message.slice(0, 1000) : null });
    if (error) throw error;
    return Response.json({ ok: true }, { headers: cors });
  } catch (error) {
    console.error("complete-training-batch failed", error);
    return Response.json({ error: "Training batch completion failed." }, { status: 503, headers: cors });
  }
});
