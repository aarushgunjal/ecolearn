import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const fallback = (item: string) => ({
  item,
  recyclable: false,
  confidence: 0,
  category: "Needs local guidance",
  instructions: "Check your local recycling program before disposal.",
  tips: ["Avoid placing unknown items in recycling", "Check material labels", "Use a specialty drop-off when available"],
});

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });

  try {
    const { item } = await request.json();
    if (typeof item !== "string" || !item.trim() || item.length > 120) {
      return Response.json({ error: "Provide an item name up to 120 characters." }, { status: 400, headers: corsHeaders });
    }

    const apiKey = Deno.env.get("OPENROUTER_API_KEY");
    if (!apiKey) return Response.json(fallback(item.trim()), { headers: corsHeaders });

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: AbortSignal.timeout(15_000),
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: Deno.env.get("OPENROUTER_MODEL") ?? "openai/gpt-4o-mini",
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "Return valid JSON only with item (string), recyclable (boolean), confidence (number 0-100), category (string), instructions (string), and tips (array of 2-4 short strings). Give cautious, non-local disposal guidance and never invent municipal rules." },
          { role: "user", content: `Classify this household item: ${item.trim()}` },
        ],
      }),
    });
    if (!response.ok) return Response.json(fallback(item.trim()), { headers: corsHeaders });
    const content = (await response.json())?.choices?.[0]?.message?.content;
    const parsed = typeof content === "string" ? JSON.parse(content) : null;
    if (!parsed || typeof parsed !== "object") return Response.json(fallback(item.trim()), { headers: corsHeaders });
    return Response.json(parsed, { headers: { ...corsHeaders, "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Guidance is temporarily unavailable." }, { status: 503, headers: corsHeaders });
  }
});
