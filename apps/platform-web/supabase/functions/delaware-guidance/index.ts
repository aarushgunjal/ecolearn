import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  DNREC_RECYLOPEDIA_URL,
  findDelawareGuidance,
  toGuidancePayload,
} from "../_shared/dnrec.ts";

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

    const { item } = await request.json();
    if (typeof item !== "string" || !item.trim() || item.length > 120) {
      return Response.json({ error: "Provide an item name up to 120 characters." }, { status: 400, headers: cors });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const lookup = await findDelawareGuidance(admin, item.trim());
    return Response.json({
      query: item.trim(),
      verified: Boolean(lookup.match),
      guidance: lookup.match ? toGuidancePayload(lookup.match) : null,
      candidates: lookup.candidates.map(toGuidancePayload),
      sourceName: "Delaware DNREC Recyclopedia",
      sourceUrl: DNREC_RECYLOPEDIA_URL,
      notice: lookup.match
        ? undefined
        : "No exact verified DNREC match was found. Choose one of the suggestions or search the official Recyclopedia.",
    }, { headers: { ...cors, "Cache-Control": "private, max-age=300" } });
  } catch (error) {
    console.error("delaware-guidance failed", error);
    return Response.json({
      error: "Delaware guidance is unavailable until the official DNREC data sync has run.",
      sourceUrl: DNREC_RECYLOPEDIA_URL,
    }, { status: 503, headers: cors });
  }
});
