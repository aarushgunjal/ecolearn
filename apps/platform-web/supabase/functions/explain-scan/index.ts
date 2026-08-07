import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  DNREC_RECYLOPEDIA_URL,
  findDelawareGuidance,
  findLiveDelawareGuidance,
  toGuidancePayload,
} from "../_shared/dnrec.ts";

const cors = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ImageStatus = "single_item" | "multiple_items" | "unclear";
type Hazard = "battery" | "electronics" | "chemical" | "sharp" | "none" | "unknown";

type Identification = {
  image_status?: unknown;
  observed_item?: unknown;
  catalog_query?: unknown;
  material?: unknown;
  confidence?: unknown;
  possible_hazard?: unknown;
  visible_evidence?: unknown;
};

const parseJson = (value: string): Identification =>
  JSON.parse(value.replace(/^```json\s*|\s*```$/g, "").trim()) as Identification;

const cleanText = (value: unknown, maxLength: number) =>
  typeof value === "string" ? value.trim().slice(0, maxLength) : "";

const imageStatus = (value: unknown): ImageStatus =>
  value === "single_item" || value === "multiple_items" || value === "unclear"
    ? value
    : "unclear";

const hazard = (value: unknown): Hazard =>
  value === "battery" || value === "electronics" || value === "chemical" || value === "sharp" || value === "none"
    ? value
    : "unknown";

const confidencePercent = (value: unknown) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.round(Math.max(0, Math.min(1, numeric)) * 100);
};

const safeNextSteps = (status: ImageStatus, possibleHazard: Hazard, observedItem: string) => {
  if (status === "multiple_items") {
    return [
      "Retake the photo with one item centered in the frame.",
      "Check batteries, electronics, sharp objects, and chemical containers separately.",
      "Use the exact-item search for each object you want to verify.",
    ];
  }
  if (status === "unclear") {
    return [
      "Retake the photo in better light with the full item visible.",
      "Photograph the package label or barcode if the object is difficult to recognize.",
      "Use the exact-item search if you already know the product type.",
    ];
  }

  const steps = [
    `Search DNREC using “${observedItem || "the exact item name"}” or a name from its package label.`,
    "Try the barcode or package-label tools for a more specific description.",
  ];
  if (possibleHazard === "battery" || possibleHazard === "electronics") {
    steps.push("Keep the item separate from curbside recycling until an official option is confirmed.");
  } else if (possibleHazard === "chemical") {
    steps.push("Keep the container closed and follow its safety label while you confirm an official option.");
  } else if (possibleHazard === "sharp") {
    steps.push("Avoid exposed sharp edges while you confirm the exact item and an official option.");
  } else {
    steps.push("Do not rely on a generic recycling claim when no official Delaware match is available.");
  }
  return steps;
};

const errorResponse = (error: string, status: number, code: string, retryAfter?: string) =>
  Response.json(
    { error, code },
    {
      status,
      headers: retryAfter ? { ...cors, "Retry-After": retryAfter } : cors,
    },
  );

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return errorResponse("Method not allowed", 405, "METHOD_NOT_ALLOWED");

  try {
    const authorization = request.headers.get("Authorization") ?? "";
    const client = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authorization } } },
    );
    const { data: { user } } = await client.auth.getUser();
    if (!user) return errorResponse("Sign in to identify an item.", 401, "AUTH_REQUIRED");

    const { image } = await request.json();
    if (
      typeof image !== "string" ||
      !/^data:image\/(jpeg|png|webp);base64,/.test(image) ||
      image.length > 11_000_000
    ) {
      return errorResponse(
        "Choose a JPG, PNG, or WebP image below 8 MB.",
        400,
        "INVALID_IMAGE",
      );
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentRequests, error: requestLogError } = await admin
      .from("ai_request_log")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("request_kind", "delaware_catalog_match")
      .gte("created_at", since);
    if (requestLogError) {
      console.error("AI request log unavailable", requestLogError);
      return errorResponse(
        "EcoLearn's secure scanner setup is incomplete. Apply the latest platform migration.",
        503,
        "DATABASE_NOT_READY",
      );
    }
    if ((recentRequests ?? 0) >= 10) {
      return errorResponse(
        "Visual item checks are limited to 10 per hour. Try again later or use exact-item search.",
        429,
        "RATE_LIMITED",
        "3600",
      );
    }

    const { count: catalogCount, error: catalogError } = await admin
      .from("delaware_guidance_items")
      .select("source_topic_id", { count: "exact", head: true });
    if (catalogError) {
      console.error("DNREC catalog unavailable", catalogError);
      return errorResponse(
        "The Delaware catalog is unavailable. Check the database migration and try again.",
        503,
        "CATALOG_UNAVAILABLE",
      );
    }
    if (!catalogCount) {
      return errorResponse(
        "The Delaware catalog has not been synced yet.",
        503,
        "CATALOG_NOT_SYNCED",
      );
    }

    const apiKey = Deno.env.get("OPENROUTER_API_KEY");
    const model = Deno.env.get("OPENROUTER_EXPLAIN_MODEL")
      ?? Deno.env.get("OPENROUTER_SECOND_OPINION_MODEL")
      ?? Deno.env.get("OPENROUTER_REVIEW_MODEL");
    if (!apiKey || !model) {
      return errorResponse(
        "Visual item identification is not configured yet.",
        503,
        "AI_NOT_CONFIGURED",
      );
    }

    const { error: requestInsertError } = await admin.from("ai_request_log").insert({
      user_id: user.id,
      request_kind: "delaware_catalog_match",
    });
    if (requestInsertError) {
      console.error("Could not record AI request", requestInsertError);
      return errorResponse(
        "EcoLearn could not start a secure visual check.",
        503,
        "REQUEST_LOG_FAILED",
      );
    }

    const providerResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: AbortSignal.timeout(30_000),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `Identify what is visibly present in a household-item photo. Return JSON only with exactly these fields: {"image_status":"single_item"|"multiple_items"|"unclear","observed_item":string|null,"catalog_query":string|null,"material":string|null,"confidence":number,"possible_hazard":"battery"|"electronics"|"chemical"|"sharp"|"none"|"unknown","visible_evidence":string}. Use single_item only when one primary discrete item is clear. Use multiple_items for piles, bins, collages, or multiple separate objects. catalog_query must be a short, specific common noun phrase suitable for searching a municipal waste catalog, such as “plastic beverage bottle” rather than “plastic”. Confidence is 0 to 1. Describe only visible evidence. Never provide recycling, disposal, legal, or location guidance. Never identify people or transcribe private information.`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Identify the primary item only if the image clearly contains one item. Otherwise report multiple_items or unclear. The image is used only for this requested lookup and is not stored or used for training.",
              },
              { type: "image_url", image_url: { url: image } },
            ],
          },
        ],
      }),
    });

    if (!providerResponse.ok) {
      const providerMessage = (await providerResponse.text()).slice(0, 400);
      console.error("OpenRouter identification failed", providerResponse.status, providerMessage);
      if (providerResponse.status === 429) {
        return errorResponse(
          "The visual identification service has reached its temporary limit. Use exact-item search or try again later.",
          429,
          "AI_QUOTA_REACHED",
        );
      }
      return errorResponse(
        "The visual identification service is temporarily unavailable.",
        503,
        "AI_PROVIDER_ERROR",
      );
    }

    const raw = (await providerResponse.json())?.choices?.[0]?.message?.content;
    let parsed: Identification;
    try {
      parsed = parseJson(typeof raw === "string" ? raw : "");
    } catch (parseError) {
      console.error("AI returned invalid identification JSON", parseError);
      return errorResponse(
        "The visual identification response could not be read. Please try another photo.",
        502,
        "INVALID_AI_RESPONSE",
      );
    }

    const status = imageStatus(parsed.image_status);
    const observedItem = cleanText(parsed.observed_item, 120);
    const catalogQuery = cleanText(parsed.catalog_query, 120) || observedItem;
    const material = cleanText(parsed.material, 80);
    const possibleHazard = hazard(parsed.possible_hazard);
    const confidence = confidencePercent(parsed.confidence);
    const visibleEvidence = cleanText(parsed.visible_evidence, 180);
    const nextSteps = safeNextSteps(status, possibleHazard, observedItem);
    const baseResult = {
      verified: false,
      guidance: null,
      observedItem: observedItem || null,
      material: material || null,
      confidence,
      imageStatus: status,
      possibleHazard,
      visibleEvidence: visibleEvidence || null,
      nextSteps,
      sourceUrl: DNREC_RECYLOPEDIA_URL,
      model,
    };

    if (status !== "single_item" || confidence < 55 || !catalogQuery) {
      const message = status === "multiple_items"
        ? "Multiple or mixed items were detected. Scan one item at a time for a reliable Delaware match."
        : "EcoLearn could not identify one item clearly enough to check the Delaware catalog.";
      return Response.json({ ...baseResult, message }, { headers: { ...cors, "Cache-Control": "no-store" } });
    }

    let localLookup: Awaited<ReturnType<typeof findDelawareGuidance>>;
    try {
      localLookup = await findDelawareGuidance(admin, catalogQuery);
    } catch (lookupError) {
      console.error("DNREC catalog search failed", lookupError);
      return errorResponse(
        "The item was identified, but the Delaware catalog could not be searched.",
        503,
        "CATALOG_SEARCH_FAILED",
      );
    }

    const candidate = localLookup.match;
    const runnerUp = localLookup.candidates.find(
      (entry) => entry.row.source_topic_id !== candidate?.row.source_topic_id,
    );
    const strongUniqueMatch = Boolean(
      candidate &&
      candidate.score >= 0.84 &&
      (candidate.score >= 0.96 || !runnerUp || candidate.score - runnerUp.score >= 0.12),
    );
    if (!candidate || !strongUniqueMatch) {
      return Response.json({
        ...baseResult,
        message: `EcoLearn identified ${observedItem || "the item"}, but found no strong official DNREC catalog match.`,
      }, { headers: { ...cors, "Cache-Control": "no-store" } });
    }

    let verifiedMatch = candidate;
    try {
      const liveLookup = await findLiveDelawareGuidance(candidate.row.title);
      if (liveLookup.match?.row.title === candidate.row.title) verifiedMatch = liveLookup.match;
    } catch (liveError) {
      console.warn("Live DNREC lookup unavailable; using the synced official record", liveError);
    }

    return Response.json({
      ...baseResult,
      verified: true,
      guidance: toGuidancePayload(verifiedMatch),
      message: "Official Delaware DNREC guidance matched.",
    }, { headers: { ...cors, "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("explain-scan failed", error);
    return errorResponse(
      "EcoLearn could not complete the visual item check.",
      503,
      "UNEXPECTED_SCAN_ERROR",
    );
  }
});
