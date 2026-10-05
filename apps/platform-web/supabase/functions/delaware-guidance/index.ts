import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  buildDnrecCatalogQueries,
  DNREC_RECYLOPEDIA_URL,
  findDelawareGuidance,
  findDnrecCategoryGuidance,
  findLiveDelawareGuidance,
  toGuidancePayload,
  hasUniqueDnrecMatch,
  isFreshDnrecRecord,
} from "../_shared/dnrec.ts";
import { recordItemInteraction } from "../_shared/analytics.ts";

const cors = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405, headers: cors });

  try {
    const authorization = request.headers.get("Authorization") ?? "";
    const authClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authorization } },
    });
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) return Response.json({ error: "Authentication required" }, { status: 401, headers: cors });

    const { item, mode, clientPlatform, inputMethod } = await request.json();
    if (typeof item !== "string" || !item.trim() || item.length > 120) {
      return Response.json({ error: "Provide an item name up to 120 characters." }, { status: 400, headers: cors });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const catalogQueries = buildDnrecCatalogQueries(item.trim());
    let lookup: Awaited<ReturnType<typeof findDelawareGuidance>>;
    try {
      lookup = await findDelawareGuidance(admin, catalogQueries);
      if (!lookup.match || !isFreshDnrecRecord(lookup.match.row)) {
        try { lookup = await findLiveDelawareGuidance(catalogQueries, mode !== "suggestions"); }
        catch { /* The official mirror remains usable during upstream outages. */ }
      }
    } catch {
      lookup = await findLiveDelawareGuidance(catalogQueries, mode !== "suggestions");
    }
    if (mode === "suggestions") {
      return Response.json({
        suggestions: lookup.candidates.map((entry) => ({
          title: entry.row.title,
          category: entry.row.tags?.map((tag) => tag.tag).filter(Boolean)[0] ?? "Delaware DNREC item",
        })),
        sourceName: "Delaware DNREC Recyclopedia",
      }, { headers: { ...cors, "Cache-Control": "private, max-age=300" } });
    }

    const candidate = lookup.match;
    const uniqueMatch = hasUniqueDnrecMatch(lookup);

    await recordItemInteraction(admin, {
      eventKind: "search",
      inputMethod: inputMethod === "suggestion" ? "suggestion" : "typed_search",
      queryText: item,
      resolvedItem: uniqueMatch && candidate ? candidate.row.title : null,
      verified: uniqueMatch,
      confusing: !uniqueMatch,
      confidencePercent: candidate ? candidate.score * 100 : 0,
      clientPlatform,
    });

    return Response.json({
      query: item.trim(),
      verified: uniqueMatch,
      guidance: uniqueMatch && candidate ? toGuidancePayload(candidate) : null,
      categoryGuidance: uniqueMatch ? [] : await findDnrecCategoryGuidance(admin, item.trim()),
      candidates: lookup.candidates.map(toGuidancePayload),
      sourceName: "Delaware DNREC Recyclopedia",
      sourceUrl: DNREC_RECYLOPEDIA_URL,
      notice: uniqueMatch
        ? undefined
        : "No exact verified DNREC match was found. Choose one of the suggestions or search the official Recyclopedia.",
    }, { headers: { ...cors, "Cache-Control": "private, max-age=300" } });
  } catch (error) {
    console.error("delaware-guidance failed", error);
    return Response.json({
      error: "Delaware guidance is temporarily unavailable. Please try again shortly.",
      sourceUrl: DNREC_RECYLOPEDIA_URL,
    }, { status: 503, headers: cors });
  }
});
