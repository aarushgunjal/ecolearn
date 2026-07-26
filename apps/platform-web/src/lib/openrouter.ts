import { supabase } from "@/integrations/supabase/client";

/**
 * Requests text-only disposal guidance through a JWT-protected Edge Function.
 * Provider keys deliberately never appear in a Vite environment variable: any
 * `VITE_*` variable is shipped to every visitor's browser.
 */
export async function openRouterJson<T>(params: {
  item: string;
  fallback: T;
}): Promise<T> {
  const item = params.item.trim().slice(0, 120);
  if (!item) return params.fallback;

  try {
    const { data, error } = await supabase.functions.invoke("generate-guidance", {
      body: { item },
    });
    if (error || !data || typeof data !== "object") return params.fallback;
    return data as T;
  } catch {
    // Guidance remains useful while a model provider is unavailable.
    return params.fallback;
  }
}
