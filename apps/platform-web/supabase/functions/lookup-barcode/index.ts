import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const cors = { "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const packagingGuidance = (packaging: string) => {
  const value = packaging.toLowerCase();
  if (/glass/.test(value)) return "If your local program accepts glass, empty and rinse it; remove non-glass parts.";
  if (/aluminium|aluminum|steel|metal|tin/.test(value)) return "Empty and rinse metal packaging. Check local acceptance before recycling it loose.";
  if (/paper|cardboard/.test(value)) return "Keep paper or cardboard clean and dry; flatten it before recycling where accepted.";
  if (/plastic/.test(value)) return "Check the resin code and your local rules. Empty and rinse accepted plastic containers before recycling.";
  return "Packaging varies by product. Check the materials label and your local recycling rules before disposal.";
};

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405, headers: cors });
  try {
    const { barcode } = await request.json();
    if (typeof barcode !== "string" || !/^\d{8,14}$/.test(barcode)) return Response.json({ error: "Barcode must contain 8–14 digits." }, { status: 400, headers: cors });
    const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`, { headers: { "User-Agent": "EcoLearn/1.0 (barcode lookup)" }, signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error("Product service unavailable");
    const body = await response.json();
    const product = body?.product;
    if (body?.status !== 1 || !product) return Response.json({ found: false }, { headers: cors });
    const name = String(product.product_name || product.product_name_en || "Packaged item").slice(0, 160);
    const brand = String(product.brands || "").slice(0, 120);
    const packaging = String(product.packaging_text || product.packaging || product.packaging_tags?.join(", ") || "").slice(0, 300);
    return Response.json({ found: true, name, brand, packaging, guidance: packagingGuidance(packaging), source: "Open Food Facts" }, { headers: { ...cors, "Cache-Control": "private, max-age=86400" } });
  } catch (error) {
    console.error("lookup-barcode failed", error);
    return Response.json({ error: "Barcode lookup is temporarily unavailable." }, { status: 503, headers: cors });
  }
});
