import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const DNREC_LOCATION_ID = 38;
export const DNREC_RECYLOPEDIA_URL = "https://dnrec.delaware.gov/waste-hazardous/recycling/what/";
export const DNREC_API_BASE = `https://api.recyclopedia.org/api/v2/location/${DNREC_LOCATION_ID}`;

export type DnrecTag = { tag?: string; seo_name?: string };
export type DnrecSynonym = { synonym?: string };
export type DelawareGuidanceRow = {
  source_topic_id: number;
  title: string;
  seo_name: string;
  content_text: string;
  tags: DnrecTag[];
  synonyms: DnrecSynonym[];
  search_terms: string[];
  source_updated_at: string | null;
  source_url: string;
};

export const normalizeDnrecText = (value: string) =>
  value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

export const stripHtml = (value: string) =>
  value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?p[^>]*>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

const termsFor = (row: DelawareGuidanceRow) =>
  Array.from(
    new Set(
      [row.title, row.seo_name, ...(row.search_terms ?? []), ...(row.synonyms ?? []).map((entry) => entry.synonym ?? "")]
        .map(normalizeDnrecText)
        .filter(Boolean),
    ),
  );

const scoreTerm = (query: string, term: string) => {
  if (!query || !term) return 0;
  if (query === term) return 1;
  if (term.includes(query) || query.includes(term)) return 0.84;
  const queryWords = new Set(query.split(" "));
  const termWords = new Set(term.split(" "));
  let shared = 0;
  queryWords.forEach((word) => { if (termWords.has(word)) shared += 1; });
  return shared ? shared / Math.max(queryWords.size, termWords.size) : 0;
};

const rankGuidance = (rows: DelawareGuidanceRow[], item: string) => {
  const query = normalizeDnrecText(item);
  return rows
    .map((row) => ({ row, score: Math.max(...termsFor(row).map((term) => scoreTerm(query, term)), 0) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.row.title.localeCompare(right.row.title));
};

export const guidanceCategory = (tags: DnrecTag[]) => {
  const names = tags.map((tag) => (tag.tag ?? "").toLowerCase());
  if (names.some((name) => name.includes("acceptable to recycle curbside"))) return "Curbside recycling";
  if (names.some((name) => name.includes("household hazardous"))) return "Household hazardous waste";
  if (names.some((name) => name.includes("drop-off"))) return "Drop-off or specialty program";
  if (names.some((name) => name.includes("yard waste"))) return "Yard waste";
  if (names.some((name) => name.includes("not acceptable to recycle curbside"))) return "Keep out of curbside recycling";
  return "Delaware-specific guidance";
};

export const isCurbside = (tags: DnrecTag[]) =>
  tags.some((tag) => (tag.tag ?? "").toLowerCase().includes("acceptable to recycle curbside") && !(tag.tag ?? "").toLowerCase().includes("not acceptable"));

export async function findDelawareGuidance(client: SupabaseClient, item: string) {
  const { data, error } = await client
    .from("delaware_guidance_items")
    .select("source_topic_id,title,seo_name,content_text,tags,synonyms,search_terms,source_updated_at,source_url");
  if (error) throw error;
  const ranked = rankGuidance((data ?? []) as DelawareGuidanceRow[], item);
  const best = ranked[0];
  return { match: best && best.score >= 0.72 ? best : null, candidates: ranked.slice(0, 5) };
}

type LiveTopic = {
  topic_id: number;
  topic: string;
  seo_name: string;
  updated_at?: string;
  content_body?: string;
  tags?: DnrecTag[];
  synonyms?: DnrecSynonym[];
};

const fetchDnrecJson = async <T,>(url: string) => {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`DNREC Recyclopedia returned ${response.status}`);
  return await response.json() as T;
};

const liveTopicToRow = (topic: LiveTopic): DelawareGuidanceRow => ({
  source_topic_id: topic.topic_id,
  title: topic.topic,
  seo_name: topic.seo_name,
  content_text: stripHtml(topic.content_body ?? ""),
  tags: topic.tags ?? [],
  synonyms: topic.synonyms ?? [],
  search_terms: Array.from(new Set([
    topic.topic,
    topic.seo_name.replace(/-/g, " "),
    ...(topic.synonyms ?? []).map((entry) => entry.synonym ?? ""),
  ].map(normalizeDnrecText).filter(Boolean))),
  source_updated_at: topic.updated_at ?? null,
  source_url: `${DNREC_RECYLOPEDIA_URL}#/topic/${topic.seo_name}`,
});

// The mirrored table keeps lookups fast, but a live fallback prevents a failed or
// delayed sync from turning a known DNREC item into an unsafe generic answer.
export async function findLiveDelawareGuidance(item: string) {
  const listing = await fetchDnrecJson<{ data: LiveTopic[] }>(
    `${DNREC_API_BASE}/topic?_with=tags,synonyms&_sort=topic&per_page=1000`,
  );
  const ranked = rankGuidance((listing.data ?? []).map(liveTopicToRow), item);
  const best = ranked[0];
  if (!best || best.score < 0.72) return { match: null, candidates: ranked.slice(0, 5) };

  const detail = await fetchDnrecJson<LiveTopic>(
    `${DNREC_API_BASE}/topic/${best.row.source_topic_id}?_with=tags,synonyms&_sort=tags.tag&tags-system-not=1`,
  );
  return {
    match: { row: liveTopicToRow(detail), score: best.score },
    candidates: ranked.slice(0, 5),
  };
}

export const toGuidancePayload = (entry: { row: DelawareGuidanceRow; score: number }) => ({
  title: entry.row.title,
  seoName: entry.row.seo_name,
  matchConfidence: Math.round(entry.score * 100),
  category: guidanceCategory(entry.row.tags ?? []),
  curbside: isCurbside(entry.row.tags ?? []),
  instructions: entry.row.content_text.slice(0, 2_000),
  tags: (entry.row.tags ?? []).map((tag) => tag.tag).filter(Boolean),
  sourceName: "Delaware DNREC Recyclopedia",
  sourceUrl: entry.row.source_url || `${DNREC_RECYLOPEDIA_URL}#/topic/${entry.row.seo_name}`,
  sourceUpdatedAt: entry.row.source_updated_at,
});
