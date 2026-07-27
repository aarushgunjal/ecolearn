import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const labels = new Set([
  "battery",
  "biological",
  "cardboard",
  "clothes",
  "glass",
  "metal",
  "paper",
  "plastic",
  "shoes",
  "trash",
]);

const parseJson = (value: string) =>
  JSON.parse(value.replace(/^```json\s*|\s*```$/g, "").trim());

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405, headers: cors });
  }

  try {
    const authorization = request.headers.get("Authorization") ?? "";
    const client = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authorization } } },
    );
    const { data: { user } } = await client.auth.getUser();
    if (!user) return Response.json({ error: "Authentication required" }, { status: 401, headers: cors });

    const { image, predictedLabel, predictedConfidence } = await request.json();
    if (
      typeof image !== "string" ||
      !/^data:image\/(jpeg|png|webp);base64,/.test(image) ||
      image.length > 8_500_000
    ) {
      return Response.json(
        { error: "Provide a JPG, PNG, or WebP image below 6 MB." },
        { status: 400, headers: cors },
      );
    }

    const label = typeof predictedLabel === "string" ? predictedLabel.toLowerCase() : "";
    if (!labels.has(label)) {
      return Response.json({ error: "Unsupported scanner label." }, { status: 400, headers: cors });
    }

    const apiKey = Deno.env.get("OPENROUTER_API_KEY");
    const model = Deno.env.get("OPENROUTER_EXPLAIN_MODEL") ?? Deno.env.get("OPENROUTER_SECOND_OPINION_MODEL") ?? Deno.env.get("OPENROUTER_REVIEW_MODEL");
    if (!apiKey || !model) throw new Error("AI explanation is not configured");

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: AbortSignal.timeout(30_000),
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "You explain a waste-scanner result cautiously. Return JSON only with: observed_item (string, max 80 chars), explanation (string, max 320 chars), disposal_action (string, max 220 chars), caution (string, max 180 chars). Explain the visible object and why the classifier label may be broad. For electronics or batteries, say to use an e-waste or battery collection program rather than curbside recycling; do not invent local rules. If the image is unclear, say so. Do not identify people, read private information, or claim certainty.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: `EcoLearn's image classifier returned the broad label "${label}" at ${Number(predictedConfidence) || 0}% confidence. Explain this result and give safe general disposal direction for the visible item. This image was supplied only for this user-requested explanation and must not be stored or used for training.` },
              { type: "image_url", image_url: { url: image } },
            ],
          },
        ],
      }),
    });
    if (!response.ok) throw new Error(`AI provider returned ${response.status}`);
    const raw = (await response.json())?.choices?.[0]?.message?.content;
    const parsed = typeof raw === "string" ? parseJson(raw) : null;
    if (!parsed || typeof parsed !== "object") throw new Error("AI returned invalid JSON");

    return Response.json({
      observedItem: String(parsed.observed_item ?? "").slice(0, 80),
      explanation: String(parsed.explanation ?? "").slice(0, 320),
      disposalAction: String(parsed.disposal_action ?? "").slice(0, 220),
      caution: String(parsed.caution ?? "").slice(0, 180),
      model,
    }, { headers: { ...cors, "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("explain-scan failed", error);
    return Response.json({ error: "AI explanation is temporarily unavailable." }, { status: 503, headers: cors });
  }
});
