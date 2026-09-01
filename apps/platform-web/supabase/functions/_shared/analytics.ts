import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

type ItemInteraction = {
  eventKind: "search" | "scan";
  inputMethod: "typed_search" | "suggestion" | "photo";
  queryText?: string | null;
  identifiedItem?: string | null;
  resolvedItem?: string | null;
  material?: string | null;
  verified: boolean;
  confusing: boolean;
  confidencePercent?: number | null;
  imageStatus?: "single_item" | "multiple_items" | "unclear" | null;
  clientPlatform?: unknown;
};

const clean = (value: string | null | undefined, maxLength: number) => {
  const text = typeof value === "string" ? value.trim().slice(0, maxLength) : "";
  return text || null;
};

const platform = (value: unknown) => value === "web" || value === "mobile" ? value : "unknown";

export const recordItemInteraction = async (
  admin: SupabaseClient,
  event: ItemInteraction,
) => {
  const confidence = Number(event.confidencePercent);
  const { error } = await admin.from("item_interaction_events").insert({
    event_kind: event.eventKind,
    input_method: event.inputMethod,
    query_text: clean(event.queryText, 120),
    identified_item: clean(event.identifiedItem, 120),
    resolved_item: clean(event.resolvedItem, 120),
    material: clean(event.material, 80),
    verified: event.verified,
    confusing: event.confusing,
    confidence_percent: Number.isFinite(confidence)
      ? Math.max(0, Math.min(100, confidence))
      : null,
    image_status: event.imageStatus ?? null,
    client_platform: platform(event.clientPlatform),
  });

  // Analytics must never make the scanner or catalog lookup fail. A missing
  // migration is logged for operators while the requested result still returns.
  if (error) console.warn("Item interaction analytics unavailable", error.message);
};
