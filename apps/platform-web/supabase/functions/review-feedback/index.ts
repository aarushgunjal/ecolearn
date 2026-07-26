import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const allowedLabels = new Set(["battery", "biological", "cardboard", "clothes", "glass", "metal", "paper", "plastic", "shoes", "trash"]);
const protectedLabels = new Set(["battery", "biological", "clothes", "shoes"]);
const cors = { "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const toBase64 = (bytes: Uint8Array) => {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  return btoa(binary);
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405, headers: cors });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return Response.json({ error: "Authentication required" }, { status: 401, headers: cors });
    const { feedbackId } = await req.json();
    if (typeof feedbackId !== "string") return Response.json({ error: "feedbackId is required" }, { status: 400, headers: cors });
    const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: feedback } = await service.from("scan_feedback").select("*").eq("id", feedbackId).single();
    const { data: admin } = await service.from("app_admins").select("user_id").eq("user_id", user.id).maybeSingle();
    if (!feedback || (feedback.user_id !== user.id && !admin) || !feedback.ai_review_consent || !feedback.image_path) return Response.json({ error: "Feedback is not eligible for AI review" }, { status: 403, headers: cors });
    const { data: image, error: imageError } = await service.storage.from("training-feedback").download(feedback.image_path);
    if (imageError || !image) throw new Error("Private image unavailable");
    const base64 = toBase64(new Uint8Array(await image.arrayBuffer()));
    const model = Deno.env.get("OPENROUTER_REVIEW_MODEL");
    const apiKey = Deno.env.get("OPENROUTER_API_KEY");
    if (!model || !apiKey) throw new Error("Missing OPENROUTER_REVIEW_MODEL or OPENROUTER_API_KEY secret");
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", { method: "POST", signal: AbortSignal.timeout(30_000), headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model, temperature: 0, response_format: { type: "json_object" }, messages: [{ role: "system", content: "You are a conservative waste-image quality reviewer. Return JSON only: label (one of battery, biological, cardboard, clothes, glass, metal, paper, plastic, shoes, trash), confidence (0-1), image_usable (boolean), rationale (max 240 chars). Never infer a label when uncertain." }, { role: "user", content: [{ type: "text", text: `Original classifier label: ${feedback.predicted_label}. User verdict: ${feedback.verdict}. Review the image.` }, { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64}` } }] }] }) });
    if (!response.ok) throw new Error(`AI provider returned ${response.status}: ${(await response.text()).slice(0, 300)}`);
    const raw = (await response.json())?.choices?.[0]?.message?.content;
    const review = JSON.parse(raw);
    const label = typeof review.label === "string" ? review.label.toLowerCase() : "";
    const confidence = Number(review.confidence);
    const predicted = String(feedback.predicted_label).toLowerCase();
    const autoApprove = allowedLabels.has(label) && review.image_usable === true && confidence >= 0.95 && feedback.verdict === "correct" && label === predicted && !protectedLabels.has(label);
    await service.from("scan_feedback").update({ normalized_label: allowedLabels.has(label) ? label : null, reviewer_kind: "llm", review_confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : null, review_rationale: String(review.rationale ?? "").slice(0, 240), review_model: model, reviewed_at: new Date().toISOString(), review_status: autoApprove ? "approved" : "pending" }).eq("id", feedbackId);
    return Response.json({ status: autoApprove ? "approved" : "pending" }, { headers: cors });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown AI review error";
    console.error("review-feedback failed", message);
    return Response.json({ status: "pending", error: message }, { status: 502, headers: cors });
  }
});
