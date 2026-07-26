import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const cors = { "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const filters: Record<string, string> = { recycling: '["amenity"="recycling"]', battery: '["recycling:batteries"="yes"]', compost: '["recycling:organic"="yes"]', textile: '["recycling:clothes"="yes"]' };
const distanceKm = (lat1: number, lon1: number, lat2: number, lon2: number) => { const r = (value: number) => value * Math.PI / 180; const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lon2 - lon1) / 2) ** 2; return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); };

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405, headers: cors });
  try {
    const { latitude, longitude, type } = await request.json();
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return Response.json({ error: "Valid coordinates are required." }, { status: 400, headers: cors });
    const filter = filters[String(type)] ?? filters.recycling;
    const query = `[out:json][timeout:15];(node(around:10000,${latitude},${longitude})${filter};way(around:10000,${latitude},${longitude})${filter};);out center tags 40;`;
    const response = await fetch("https://overpass-api.de/api/interpreter", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ data: query }), signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error("Map service unavailable");
    const body = await response.json();
    const sites = (body.elements || []).map((element: Record<string, unknown>) => {
      const tags = (element.tags || {}) as Record<string, string>;
      const center = element.center as Record<string, number> | undefined;
      const siteLatitude = Number(element.lat ?? center?.lat);
      const siteLongitude = Number(element.lon ?? center?.lon);
      return { id: `${element.type}-${element.id}`, name: tags.name || tags.operator || "Recycling drop-off", type: type === "battery" ? "Battery drop-off" : type === "compost" ? "Compost collection" : type === "textile" ? "Textile recycling" : "Recycling drop-off", latitude: siteLatitude, longitude: siteLongitude, distanceKm: distanceKm(latitude, longitude, siteLatitude, siteLongitude), address: [tags["addr:housenumber"], tags["addr:street"], tags["addr:city"]].filter(Boolean).join(" ") };
    }).filter((site: { latitude: number; longitude: number }) => Number.isFinite(site.latitude) && Number.isFinite(site.longitude)).sort((a: { distanceKm: number }, b: { distanceKm: number }) => a.distanceKm - b.distanceKm).slice(0, 12);
    return Response.json({ sites }, { headers: { ...cors, "Cache-Control": "private, max-age=300" } });
  } catch (error) {
    console.error("find-disposal-sites failed", error);
    return Response.json({ error: "Nearby disposal lookup is temporarily unavailable." }, { status: 503, headers: cors });
  }
});
