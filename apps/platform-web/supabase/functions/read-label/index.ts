import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const cors = { "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const parseJson = (value: string) => JSON.parse(value.replace(/^```json\s*|\s*```$/g, "").trim());

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405, headers: cors });
  try {
    const auth = request.headers.get("Authorization") ?? "";
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return Response.json({ error: "Authentication required" }, { status: 401, headers: cors });
    const { image } = await request.json();
    if (typeof image !== "string" || !/^data:image\/(jpeg|png|webp);base64,/.test(image) || image.length > 8_500_000) return Response.json({ error: "Provide a JPG, PNG, or WebP image below 6 MB." }, { status: 400, headers: cors });
    const apiKey = Deno.env.get("OPENROUTER_API_KEY");
    const model = Deno.env.get("OPENROUTER_LABEL_MODEL") ?? Deno.env.get("OPENROUTER_REVIEW_MODEL");
    if (!apiKey || !model) throw new Error("Label reading is not configured");
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", { method: "POST", signal: AbortSignal.timeout(30_000), headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model, temperature: 0, response_format: { type: "json_object" }, messages: [{ role: "system", content: "Read only visible package label text and recycling symbols. Return JSON only: text (max 500 chars), materials (array of max 6 strings), recyclingSymbols (array of max 6 strings), guidance (max 260 chars). State uncertainty plainly. Do not infer local recycling rules or identify people." }, { role: "user", content: [{ type: "text", text: "Read this product label. This image must not be stored or used for training." }, { type: "image_url", image_url: { url: image } }] }] }) });
    if (!response.ok) throw new Error(`AI provider returned ${response.status}`);
    const raw = (await response.json())?.choices?.[0]?.message?.content;
    const result = typeof raw === "string" ? parseJson(raw) : null;
    if (!result || typeof result !== "object") throw new Error("Invalid AI response");
    return Response.json({ text: String(result.text ?? "").slice(0, 500), materials: Array.isArray(result.materials) ? result.materials.map(String).slice(0, 6) : [], recyclingSymbols: Array.isArray(result.recyclingSymbols) ? result.recyclingSymbols.map(String).slice(0, 6) : [], guidance: String(result.guidance ?? "Check the label and local guidance before disposal.").slice(0, 260) }, { headers: { ...cors, "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("read-label failed", error);
    return Response.json({ error: "Label reading is temporarily unavailable." }, { status: 503, headers: cors });
  }
});
