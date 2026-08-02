import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { DNREC_RECYLOPEDIA_URL, findDelawareGuidance, findLiveDelawareGuidance, toGuidancePayload } from "../_shared/dnrec.ts";

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

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: officialTopics, error: topicsError } = await admin
      .from("delaware_guidance_items")
      .select("title")
      .order("title");
    if (topicsError || !officialTopics?.length) {
      throw new Error("The official Delaware guidance catalog has not been synced");
    }
    const allowedTitles = officialTopics
      .map((topic) => String(topic.title ?? "").trim())
      .filter(Boolean);

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
            content: `You are a strict visual matcher for Delaware DNREC Recyclopedia. Return JSON only: {"official_topic_title": string | null}. Inspect the image and select exactly one title from the allowed list only when the visible object clearly matches it. Copy the selected title character-for-character. Return null when the item is unclear, more than one item is visible, or no allowed title is a clear match. Never provide explanation, disposal advice, recycling claims, or a title that is not in the list. Do not identify people or read private information. Allowed official Delaware DNREC titles:\n${allowedTitles.map((title) => `- ${title}`).join("\n")}`,
          },
          {
            role: "user",
            content: [
              { type: "text", text: `An internal image classifier suggested the material family "${label}" at ${Number(predictedConfidence) || 0}% confidence. Treat that only as a weak hint; select an allowed official title only when the pixels support it. This image was supplied only for this user-requested Delaware lookup and must not be stored or used for training.` },
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

    let localLookup: Awaited<ReturnType<typeof findDelawareGuidance>> | null = null;
    const selectedTitle = typeof parsed.official_topic_title === "string"
      ? parsed.official_topic_title.trim()
      : "";
    try {
      // The model cannot introduce a new item name: only an exact title from the
      // server-provided DNREC catalog is eligible for a local rule.
      if (allowedTitles.includes(selectedTitle)) {
        try {
          localLookup = await findLiveDelawareGuidance(selectedTitle);
        } catch (liveError) {
          console.warn("Live DNREC lookup unavailable; using mirrored official data", liveError);
          localLookup = await findDelawareGuidance(admin, selectedTitle);
        }
      }
    } catch (lookupError) {
      console.warn("DNREC guidance lookup unavailable", lookupError);
    }
    const guidance = localLookup?.match?.row.title === selectedTitle
      ? toGuidancePayload(localLookup.match)
      : null;

    return Response.json({
      verified: Boolean(guidance),
      guidance,
      sourceUrl: DNREC_RECYLOPEDIA_URL,
      model,
    }, { headers: { ...cors, "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("explain-scan failed", error);
    return Response.json({ error: "AI explanation is temporarily unavailable." }, { status: 503, headers: cors });
  }
});
