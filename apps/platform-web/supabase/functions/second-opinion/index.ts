import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const labels = new Set(["battery", "biological", "cardboard", "clothes", "glass", "metal", "paper", "plastic", "shoes", "trash"]);
const cors = { "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const parseJson = (value: string) => JSON.parse(value.replace(/^```json\s*|\s*```$/g, "").trim());

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405, headers: cors });
  try {
    const authorization = request.headers.get("Authorization") ?? "";
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authorization } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return Response.json({ error: "Authentication required" }, { status: 401, headers: cors });
    const { image, predictedLabel, predictedConfidence } = await request.json();
    if (typeof image !== "string" || !/^data:image\/(jpeg|png|webp);base64,/.test(image) || image.length > 8_500_000) return Response.json({ error: "Provide a JPG, PNG, or WebP image below 6 MB." }, { status: 400, headers: cors });
    const apiKey = Deno.env.get("OPENROUTER_API_KEY");
    const model = Deno.env.get("OPENROUTER_SECOND_OPINION_MODEL") ?? Deno.env.get("OPENROUTER_REVIEW_MODEL");
    if (!apiKey || !model) throw new Error("Second opinion is not configured");
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", { method: "POST", signal: AbortSignal.timeout(30_000), headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model, temperature: 0, response_format: { type: "json_object" }, messages: [{ role: "system", content: "You are a cautious second-opinion image classifier. Return JSON only: label (one of battery, biological, cardboard, clothes, glass, metal, paper, plastic, shoes, trash), confidence (number 0-1), rationale (max 160 characters). If uncertain, use low confidence. Do not give local disposal advice and do not identify people." }, { role: "user", content: [{ type: "text", text: `The local classifier predicted ${String(predictedLabel).slice(0, 40)} at ${Number(predictedConfidence) || 0} confidence. Independently classify this image.` }, { type: "image_url", image_url: { url: image } }] }] }) });
    if (!response.ok) throw new Error(`AI provider returned ${response.status}`);
    const raw = (await response.json())?.choices?.[0]?.message?.content;
    const parsed = typeof raw === "string" ? parseJson(raw) : null;
    const label = typeof parsed?.label === "string" ? parsed.label.toLowerCase() : "";
    if (!labels.has(label)) throw new Error("AI returned an unsupported label");
    const confidence = Number(parsed.confidence);
    return Response.json({ label, confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0, rationale: String(parsed.rationale ?? "").slice(0, 160), model }, { headers: { ...cors, "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("second-opinion failed", error);
    return Response.json({ error: "Second opinion is temporarily unavailable." }, { status: 503, headers: cors });
  }
});
