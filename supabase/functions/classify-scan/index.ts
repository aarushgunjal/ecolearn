import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = { "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });
  try {
    const form = await request.formData(); const file = form.get("file");
    if (!(file instanceof File) || !file.type.startsWith("image/")) throw new Error("A valid image is required.");
    if (file.size > 8 * 1024 * 1024) throw new Error("Please upload an image smaller than 8 MB.");
    const classifierUrl = Deno.env.get("CLASSIFIER_URL"); if (!classifierUrl) throw new Error("Classifier service is not configured.");
    const body = new FormData(); body.append("file", file, file.name || "scan.jpg");
    const response = await fetch(classifierUrl, { method: "POST", body, signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error("Classifier service is temporarily unavailable.");
    return Response.json(await response.json(), { headers: { ...corsHeaders, "Cache-Control": "no-store" } });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Could not process image." }, { status: 400, headers: corsHeaders }); }
});
