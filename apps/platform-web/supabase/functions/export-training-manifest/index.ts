import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const labels = new Set(["battery", "biological", "cardboard", "clothes", "glass", "metal", "paper", "plastic", "shoes", "trash"]);

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405, headers: cors });
  try {
    const authorization = request.headers.get("Authorization") ?? "";
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authorization } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return Response.json({ error: "Authentication required" }, { status: 401, headers: cors });

    const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: admin } = await service.from("app_admins").select("user_id").eq("user_id", user.id).maybeSingle();
    if (!admin) return Response.json({ error: "Admin access required" }, { status: 403, headers: cors });

    const { data, error } = await service.from("scan_feedback")
      .select("id,user_id,normalized_label,image_path,model_version,reviewed_at,created_at")
      .eq("training_consent", true)
      .eq("review_status", "approved")
      .not("image_path", "is", null)
      .order("reviewed_at", { ascending: true })
      .limit(5000);
    if (error) throw error;

    const examples = (await Promise.all((data ?? []).map(async (row) => {
      const label = String(row.normalized_label ?? "").toLowerCase();
      if (!labels.has(label) || !row.image_path) return [];
      const { data: signed, error: signedError } = await service.storage.from("training-feedback").createSignedUrl(row.image_path, 60 * 60);
      if (signedError || !signed?.signedUrl) return [];
      return [{
        example_id: row.id,
        label,
        image_url: signed.signedUrl,
        source_group: crypto.subtle ? await hash(String(row.user_id)) : String(row.user_id),
        reviewed_at: row.reviewed_at,
        model_version: row.model_version,
      }];
    }))).flat();

    return Response.json({
      schema_version: 1,
      generated_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      labels: [...labels],
      examples,
      notice: "Signed image links expire in one hour. Download immediately; do not publish this manifest or its images.",
    }, { headers: { ...cors, "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("export-training-manifest failed", error);
    return Response.json({ error: "Training export is temporarily unavailable." }, { status: 503, headers: cors });
  }
});

async function hash(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 16);
}
