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
  synced_at?: string;
};

const singularizeDnrecToken = (token: string) => {
  if (token.length > 4 && token.endsWith("ies")) return `${token.slice(0, -3)}y`;
  if (token.length > 3 && token.endsWith("s") && !/(ss|us|is)$/.test(token)) {
    return token.slice(0, -1);
  }
  return token;
};

export const normalizeDnrecText = (value: string) =>
  value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map(singularizeDnrecToken)
    .join(" ");

export const buildDnrecCatalogQueries = (value: string, material = "") => {
  const normalizedValue = normalizeDnrecText(value);
  const normalizedMaterial = normalizeDnrecText(material);
  const tokens = normalizedValue.split(" ").filter(Boolean);
  const words = new Set(tokens);
  const headNoun = tokens.at(-1) ?? "";
  const queries = [normalizedValue];
  const add = (query: string) => {
    const normalized = normalizeDnrecText(query);
    if (normalized && !queries.includes(normalized)) queries.push(normalized);
  };

  if (normalizedMaterial) {
    if (!words.has(normalizedMaterial)) add(`${normalizedMaterial} ${normalizedValue}`);
    const objectClasses = [
      "can", "bottle", "jar", "bag", "box", "carton", "cup", "container",
      "tray", "foil", "battery", "phone", "television", "computer",
    ];
    objectClasses.forEach((objectClass) => {
      // Only reduce material + object when the object is the phrase's head
      // noun. This prevents "metal can opener" from becoming "metal can".
      if (headNoun === objectClass) add(`${normalizedMaterial} ${objectClass}`);
    });
  }

  const beverageSignals = ["soda", "beverage", "drink", "cola", "pop", "pepsi", "coke"];
  if (words.has("can") && beverageSignals.some((signal) => words.has(signal))) {
    add("aluminum cans");
  }

  // Normalize the object, not the printed brand. Do not confuse paper notebooks
  // with notebook computers, or a protective cover with the device it covers.
  if (/\bcomposition (?:book|notebook)\b/.test(normalizedValue)) add("Composition books");
  if (/\bspiral(?: bound)? (?:notebook|book)\b/.test(normalizedValue) && !/\b(computer|laptop|electronic)\b/.test(normalizedValue)) add("Spiral-bound notebooks");

  return queries.filter(Boolean);
};

export const dnrecCategoryQueries = (item: string, material = "", hazard = "none") => {
  const name = normalizeDnrecText(item);
  const substance = normalizeDnrecText(material);
  if (/\b(protective|silicone|silicon|rubber|leather)\b.*\b(case|cover|sleeve)\b/.test(name)
    || /\b(case cover|cover|sleeve|packaging|box)$/.test(name)
    || /\b(empty packaging|retail box|product box)\b/.test(name)) return [];
  if (/\b(airpod|earbud|headphone|charging case|wireless charger|power bank|smartwatch|smart watch|electronic|laptop|computer|tablet|e reader|ereader)\b/.test(name)
    || ["electronics", "battery"].includes(hazard) && /\b(device|charger|case|phone|camera|speaker)\b/.test(name)) return ["Electronics"];
  if (/\b(battery|batterie)\b/.test(name) || hazard === 'battery') return ['Household Batteries'];
  if (!['none','unknown',''].includes(hazard)) return [];
  if (/\b(steno|stenography|notepad|writing pad|exercise book|notebook|journal)\b/.test(name)
    && !/\b(computer|laptop|tablet|electronic|digital)\b/.test(name)
    && (!substance || /\b(paper|cardboard|cardstock)\b/.test(substance))) return ['Paper'];
  return [];
};

// Category guidance always retains its own label and source. It is never a
// verified item match and cannot award scan XP or silently replace the item.
export async function findDnrecCategoryGuidance(client: SupabaseClient, item: string, material = "", hazard = "none") {
  const titles = dnrecCategoryQueries(item, material, hazard);
  if (!titles.length) return [];
  const { data, error } = await client.from('delaware_guidance_items')
    .select('source_topic_id,title,seo_name,content_text,tags,synonyms,search_terms,source_updated_at,source_url').in('title', titles);
  if (error) {
    console.warn('Related DNREC guidance unavailable');
    return [];
  }
  return ((data ?? []) as DelawareGuidanceRow[]).filter(row => titles.includes(row.title) && Boolean(row.content_text?.trim())).map(row => ({
    ...toGuidancePayload({ row, score: 0 }),
    basis: row.title === 'Paper'
      ? 'This appears to be a paper notebook. Use the notebook or book instructions below; covers, bindings, and coatings can change how it should be prepared.'
      : 'This appears to belong to this category. Confirm the type and condition with the collection program. Do not put electronics or batteries in curbside recycling.',
  }));
}

// Only equivalent object names belong in exact matching. Broad classes are
// checked separately and never become verified item matches.
export const boundedNames = (value: unknown, limit = 6): string[] =>
  Array.isArray(value) ? Array.from(new Set(value.filter((v): v is string => typeof v === "string")
    .map(v => v.trim().slice(0, 100)).filter(Boolean))).slice(0, limit) : [];

export const buildDnrecIdentificationQueries = ({ observedItem, catalogQuery, material, variants = [] }: {
  observedItem: string; catalogQuery: string; material: string; variants?: unknown;
}) => Array.from(new Set([
  ...buildDnrecCatalogQueries(catalogQuery || observedItem, material),
  ...buildDnrecCatalogQueries(observedItem, material),
  ...boundedNames(variants).map(normalizeDnrecText),
])).filter(Boolean);

export const hasUniqueDnrecMatch = (lookup: { match: { row: DelawareGuidanceRow; score: number; exactTitle?: boolean } | null; candidates: { row: DelawareGuidanceRow; score: number; exactTitle?: boolean }[] }) => {
  const best = lookup.match;
  const next = lookup.candidates.find(entry => entry.row.source_topic_id !== best?.row.source_topic_id);
  // Two exact aliases pointing at different records are still ambiguous.
  return Boolean(best && best.score >= 0.84 && (!next ||
    (best.exactTitle && !next.exactTitle && best.score === 1) ||
    (best.score >= 0.96 ? next.score < 0.96 : best.score - next.score >= 0.12)));
};

// A candidate must retain visible safety distinctions, including on an exact
// alias hit. A bottle/can's contents and a device's cover are different objects.
export const compatibleDnrecItem = (name: string, query: string, possibleHazard = "none") => {
  const observed = normalizeDnrecText(name);
  const target = normalizeDnrecText(query);
  const groups = [
    /\b(protective|cover|sleeve)\b/, /\b(aerosol|spray can)\b/,
    /\b(compostable|biodegradable)\b/, /\b(ceramic|porcelain)\b/,
    /\b(laminated|waxed|plastic coated)\b/,
    /\b(mirror)\b/, /\b(pesticide|herbicide)\b/, /\b(motor oil|engine oil)\b/,
    /\b(paint)\b/, /\b(broken|shard)\b/,
  ];
  if (groups.some(group => group.test(observed) && !group.test(target))) return false;
  if (/\b(full|liquid|filled)\b/.test(observed) && /\bempty\b/.test(target)) return false;
  if (/\bempty\b/.test(observed) && /\bfull\b/.test(target)) return false;
  if (/\b(greasy|soiled|dirty)\b/.test(observed) && /\bclean\b/.test(target)) return false;
  // A hazardous item can never be reduced to a generic curbside material.
  if (!["none", "unknown", ""].includes(possibleHazard) &&
    /^(paper|cardboard|glass|plastic|metal|aluminum)( (can|bottle|jar|container|packaging))?$/.test(target)) return false;
  return true;
};

export const dnrecClarification = (observed: string, row: DelawareGuidanceRow) => {
  const name = normalizeDnrecText(observed);
  const title = normalizeDnrecText(row.title);
  const distinctions: [RegExp, string][] = [
    [/\b(empty|full)\b/, "Is it empty or does it still have something inside? Do not open it to check."],
    [/\b(clean|greasy)\b/, "Is the paper or cardboard clean, or does it have food or grease on it?"],
    [/\b(latex|oil based)\b/, "What kind of paint does the label say? Ask a grown-up to check."],
    [/\b(spiral|composition|hardcover|paperback)\b/, "What kind of binding or cover does the book have?"],
  ];
  for (const [pattern, question] of distinctions) if (pattern.test(title) && !pattern.test(name)) return question;
  if (/plastic cup/.test(title) && /\b[1-7]\b/.test(title) && !/\b[1-7]\b/.test(name)) return "Can you see a number inside the recycling symbol? Ask a grown-up to check.";
  return null;
};

export const relatedDnrecGuidance = (rows: DelawareGuidanceRow[], names: unknown) => {
  const wanted = boundedNames(names, 3).map(normalizeDnrecText);
  return rows.filter(row => wanted.some(name => termsFor(row).includes(name)) && row.content_text.trim())
    .filter(row => !/acceptable to recycle curbside/i.test(row.title))
    .slice(0, 3).map(row => ({ ...toGuidancePayload({ row, score: 0 }),
      basis: `This may belong to the ${row.title} category. Check the item type and preparation details below with a grown-up if you need help.`,
    }));
};

export const isFreshDnrecRecord = (row: DelawareGuidanceRow, now = Date.now()) => {
  const age = now - Date.parse(row.synced_at ?? "");
  return Number.isFinite(age) && age >= 0 && age < 48 * 60 * 60_000 && Boolean(row.content_text.trim());
};

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
  const queryWords = new Set(query.split(" "));
  const termWords = new Set(term.split(" "));
  if (
    Math.min(queryWords.size, termWords.size) >= 2 &&
    (term.includes(query) || query.includes(term))
  ) return 0.84;
  let shared = 0;
  queryWords.forEach((word) => { if (termWords.has(word)) shared += 1; });
  if (!shared) return 0;
  const termCoverage = shared / termWords.size;
  const queryCoverage = shared / queryWords.size;
  if (shared >= 2 && termCoverage === 1) {
    return Math.max(0.9, 0.97 - Math.max(0, queryWords.size - termWords.size) * 0.03);
  }
  if (shared >= 2 && queryCoverage === 1) return 0.9;
  return Math.max(
    shared / Math.max(queryWords.size, termWords.size),
    shared >= 2 ? termCoverage * 0.65 + queryCoverage * 0.35 : 0,
  );
};

export const rankGuidance = (rows: DelawareGuidanceRow[], item: string | string[]) => {
  const queries = Array.from(new Set(
    (Array.isArray(item) ? item : buildDnrecCatalogQueries(item))
      .map(normalizeDnrecText)
      .filter(Boolean),
  ));
  return rows
    .map((row) => ({
      row,
      exactTitle: queries.includes(normalizeDnrecText(row.title)),
      score: Math.max(
        ...queries.flatMap((query) => termsFor(row).map((term) => scoreTerm(query, term))),
        0,
      ),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || Number(right.exactTitle) - Number(left.exactTitle) || left.row.title.localeCompare(right.row.title));
};

export const guidanceCategory = (tags: DnrecTag[]) => {
  const names = tags.map((tag) => (tag.tag ?? "").toLowerCase());
  // "NOT Acceptable to Recycle Curbside" contains the positive phrase, so it
  // must be handled before the curbside-positive category.
  if (names.some((name) => name.includes("not acceptable to recycle curbside"))) return "Keep out of curbside recycling";
  if (names.some((name) => name.includes("acceptable to recycle curbside"))) return "Curbside recycling";
  if (names.some((name) => name.includes("household hazardous"))) return "Household hazardous waste";
  if (names.some((name) => name.includes("drop-off"))) return "Drop-off or specialty program";
  if (names.some((name) => name.includes("yard waste"))) return "Yard waste";
  return "Delaware-specific guidance";
};

export const isCurbside = (tags: DnrecTag[]) =>
  tags.some((tag) => (tag.tag ?? "").toLowerCase().includes("acceptable to recycle curbside") && !(tag.tag ?? "").toLowerCase().includes("not acceptable"));

export async function loadDnrecCatalog(client: SupabaseClient) {
  const { data, error } = await client.from("delaware_guidance_items")
    .select("source_topic_id,title,seo_name,content_text,tags,synonyms,search_terms,source_updated_at,source_url,synced_at");
  if (error) throw error;
  return (data ?? []) as DelawareGuidanceRow[];
}

export const lookupDnrecRows = (rows: DelawareGuidanceRow[], item: string | string[]) => {
  const ranked = rankGuidance(rows, item);
  const best = ranked[0];
  return { match: best && best.score >= 0.72 ? best : null, candidates: ranked.slice(0, 5) };
};

export async function findDelawareGuidance(client: SupabaseClient, item: string | string[]) {
  return lookupDnrecRows(await loadDnrecCatalog(client), item);
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

let liveTopicsInFlight: Promise<LiveTopic[]> | null = null;
const detailCache = new Map<number, { expiresAt: number; value: Promise<LiveTopic> }>();

let liveTopicCache: { expiresAt: number; topics: LiveTopic[] } | null = null;

const loadLiveTopics = async () => {
  if (liveTopicCache && liveTopicCache.expiresAt > Date.now()) {
    return liveTopicCache.topics;
  }
  if (!liveTopicsInFlight) {
    liveTopicsInFlight = (async () => {
      const listing = await fetchDnrecJson<{ data: LiveTopic[] }>(
        `${DNREC_API_BASE}/topic?_with=tags,synonyms&_sort=topic&per_page=1000`,
      );
      const topics = listing.data ?? [];
      liveTopicCache = { topics, expiresAt: Date.now() + 5 * 60_000 };
      return topics;
    })().finally(() => { liveTopicsInFlight = null; });
  }
  return liveTopicsInFlight;
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
  synced_at: new Date().toISOString(),
  source_url: `${DNREC_RECYLOPEDIA_URL}#/topic/${topic.seo_name}`,
});

// The mirrored table keeps lookups fast, but a live fallback prevents a failed or
// delayed sync from turning a known DNREC item into an unsafe generic answer.
export async function findLiveDelawareGuidance(item: string | string[], includeDetail = true) {
  const ranked = rankGuidance((await loadLiveTopics()).map(liveTopicToRow), item);
  const best = ranked[0];
  if (!best || best.score < 0.72) return { match: null, candidates: ranked.slice(0, 5) };
  if (!includeDetail) return { match: best, candidates: ranked.slice(0, 5) };

  let cached = detailCache.get(best.row.source_topic_id);
  if (!cached || cached.expiresAt <= Date.now()) {
    // Public catalog records only. Photos, user identities, and model output
    // are never cached. Failed requests are evicted so the next call can retry.
    const id = best.row.source_topic_id;
    const value = fetchDnrecJson<LiveTopic>(`${DNREC_API_BASE}/topic/${id}?_with=tags,synonyms&_sort=tags.tag&tags-system-not=1`)
      .catch(error => { detailCache.delete(id); throw error; });
    cached = { expiresAt: Date.now() + 5 * 60_000, value };
    if (detailCache.size >= 128) detailCache.delete(detailCache.keys().next().value!);
    detailCache.set(id, cached);
  }
  const detail = await cached.value;
  return {
    match: { ...best, row: liveTopicToRow(detail) },
    candidates: ranked.slice(0, 5),
  };
}

export const toGuidancePayload = (entry: { row: DelawareGuidanceRow; score: number }) => ({
  title: entry.row.title,
  seoName: entry.row.seo_name,
  matchConfidence: Math.round(entry.score * 100),
  category: guidanceCategory(entry.row.tags ?? []),
  curbside: isCurbside(entry.row.tags ?? []),
  instructions: entry.row.content_text,
  tags: (entry.row.tags ?? []).map((tag) => tag.tag).filter(Boolean),
  sourceName: "Delaware DNREC Recyclopedia",
  sourceUrl: entry.row.source_url || `${DNREC_RECYLOPEDIA_URL}#/topic/${entry.row.seo_name}`,
  sourceUpdatedAt: entry.row.source_updated_at,
});
