import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: Record<string, unknown>, status = 200) =>
  Response.json(body, { status, headers: cors });

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return json({ error: "Sign in again before deleting your account." }, 401);
  }

  let body: { confirmation?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }
  if (body.confirmation !== "DELETE") {
    return json({ error: "Account deletion was not confirmed." }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: "Account deletion is temporarily unavailable." }, 500);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const accessToken = authorization.slice("Bearer ".length).trim();
  const { data: { user }, error: userError } = await admin.auth.getUser(accessToken);
  if (userError || !user) {
    return json({ error: "Your session expired. Sign in again and retry." }, 401);
  }

  // Storage objects do not cascade when an Auth user is deleted. Remove the
  // user's explicitly consented training uploads before deleting Auth data.
  for (let batch = 0; batch < 100; batch += 1) {
    const { data: files, error: listError } = await admin.storage
      .from("training-feedback")
      .list(user.id, { limit: 1000, offset: 0 });
    if (listError) return json({ error: "Could not remove account photos." }, 500);

    const paths = (files ?? [])
      .filter((file) => file.name && file.name !== ".emptyFolderPlaceholder")
      .map((file) => `${user.id}/${file.name}`);
    if (paths.length === 0) break;

    const { error: removeError } = await admin.storage
      .from("training-feedback")
      .remove(paths);
    if (removeError) return json({ error: "Could not remove account photos." }, 500);
    if (paths.length < 1000) break;
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id, false);
  if (deleteError) return json({ error: "Could not delete the account." }, 500);

  return json({ deleted: true });
});
