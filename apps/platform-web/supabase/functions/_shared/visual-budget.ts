import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const positiveIntegerEnv = (name: string, fallback: number) => {
  const value = Number(Deno.env.get(name));
  return Number.isInteger(value) && value > 0 ? value : fallback;
};

export async function reserveVisualRequest(admin: SupabaseClient, userId: string, kind: "delaware_catalog_match" | "label_read") {
  const { data, error } = await admin.rpc("ecolearn_reserve_visual_request", {
    p_user_id: userId,
    p_kind: kind,
    p_hourly_limit: positiveIntegerEnv("AI_USER_REQUESTS_PER_HOUR", 10),
    p_daily_limit: positiveIntegerEnv("AI_GLOBAL_REQUESTS_PER_DAY", 45),
  });
  if (error || !data || typeof data.allowed !== "boolean") {
    throw new Error("Visual request budget unavailable");
  }
  return data as { allowed: boolean; code?: string };
}
