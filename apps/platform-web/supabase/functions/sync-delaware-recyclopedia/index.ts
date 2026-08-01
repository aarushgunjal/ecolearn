import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  DNREC_API_BASE,
  DNREC_RECYLOPEDIA_URL,
  normalizeDnrecText,
  stripHtml,
} from "../_shared/dnrec.ts";

const cors = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-dnrec-sync-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type TopicSummary = {
  topic_id: number;
  topic: string;
  seo_name: string;
  updated_at?: string;
  synonyms?: { synonym?: string }[];
};
type TopicDetail = TopicSummary & {
  content_body?: string;
  tags?: unknown[];
  synonyms?: { synonym?: string }[];
};

const fetchJson = async <T,>(url: string) => {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`DNREC Recyclopedia returned ${response.status}`);
  return await response.json() as T;
};

const mapWithConcurrency = async <T, R>(values: T[], concurrency: number, worker: (value: T) => Promise<R>) => {
  const results: R[] = [];
  let cursor = 0;
  const run = async () => {
    while (cursor < values.length) {
      const index = cursor++;
      results[index] = await worker(values[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, run));
  return results;
};

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405, headers: cors });

  const syncSecret = Deno.env.get("DNREC_SYNC_SECRET");
  if (!syncSecret || request.headers.get("x-dnrec-sync-secret") !== syncSecret) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers: cors });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const payload = await request.json().catch(() => ({}));
  const force = payload?.force === true;
  const { data: run, error: runError } = await admin
    .from("delaware_guidance_sync_runs")
    .insert({ status: "running" })
    .select("id")
    .single();
  if (runError) return Response.json({ error: "Run the Delaware guidance SQL migration before syncing." }, { status: 409, headers: cors });

  try {
    const listing = await fetchJson<{ data: TopicSummary[] }>(
      `${DNREC_API_BASE}/topic?_with=tags,synonyms&_sort=topic&per_page=1000`,
    );
    const topics = listing.data ?? [];
    const { data: existing } = await admin
      .from("delaware_guidance_items")
      .select("source_topic_id,source_updated_at")
      .in("source_topic_id", topics.map((topic) => topic.topic_id));
    const known = new Map((existing ?? []).map((item) => [item.source_topic_id, item.source_updated_at]));
    const needed = topics.filter((topic) => force || known.get(topic.topic_id) !== (topic.updated_at ?? null));
    const errors: string[] = [];

    const rows = (await mapWithConcurrency(needed, 8, async (topic) => {
      try {
        const detail = await fetchJson<TopicDetail>(
          `${DNREC_API_BASE}/topic/${topic.topic_id}?_with=tags,synonyms&_sort=tags.tag&tags-system-not=1`,
        );
        const synonyms = detail.synonyms ?? [];
        const searchTerms = Array.from(new Set([
          detail.topic,
          detail.seo_name.replace(/-/g, " "),
          ...synonyms.map((entry) => entry.synonym ?? ""),
        ].map(normalizeDnrecText).filter(Boolean)));
        return {
          source_topic_id: detail.topic_id,
          title: detail.topic,
          seo_name: detail.seo_name,
          content_html: detail.content_body ?? "",
          content_text: stripHtml(detail.content_body ?? ""),
          tags: detail.tags ?? [],
          synonyms,
          search_terms: searchTerms,
          source_updated_at: detail.updated_at ?? topic.updated_at ?? null,
          source_url: `${DNREC_RECYLOPEDIA_URL}#/topic/${detail.seo_name}`,
          source_location_id: 38,
          synced_at: new Date().toISOString(),
        };
      } catch (error) {
        errors.push(`${topic.topic}: ${error instanceof Error ? error.message : "unable to fetch"}`);
        return null;
      }
    }))).filter(Boolean);

    for (let index = 0; index < rows.length; index += 50) {
      const { error } = await admin
        .from("delaware_guidance_items")
        .upsert(rows.slice(index, index + 50), { onConflict: "source_topic_id" });
      if (error) throw error;
    }

    await admin.from("delaware_guidance_sync_runs").update({
      // A few failed detail requests should not hide a successful import of the
      // remaining official records. The response retains those errors for review.
      status: "completed",
      completed_at: new Date().toISOString(),
      topics_seen: topics.length,
      topics_updated: rows.length,
      topics_skipped: topics.length - needed.length,
      errors: errors.slice(0, 25),
    }).eq("id", run.id);

    return Response.json({
      source: "Delaware DNREC Recyclopedia",
      sourceUrl: DNREC_RECYLOPEDIA_URL,
      topicsSeen: topics.length,
      updated: rows.length,
      skipped: topics.length - needed.length,
      errors: errors.slice(0, 25),
    }, { headers: cors });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to sync DNREC guidance.";
    await admin.from("delaware_guidance_sync_runs").update({
      status: "failed",
      completed_at: new Date().toISOString(),
      errors: [message],
    }).eq("id", run.id);
    console.error("sync-delaware-recyclopedia failed", error);
    return Response.json({ error: message }, { status: 503, headers: cors });
  }
});
