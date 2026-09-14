// Tombstone retained so deployment retires previously deployed endpoints.
Deno.serve((request) => {
  const headers = { "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  return Response.json({ error: "Image feedback and model training have been retired." }, { status: 410, headers });
});
