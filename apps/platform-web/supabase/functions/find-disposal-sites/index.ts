import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  DNREC_API_BASE,
  DNREC_RECYLOPEDIA_URL,
  findLiveDelawareGuidance,
  normalizeDnrecText,
} from "../_shared/dnrec.ts";

const cors = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type LocationType = "recycling" | "battery" | "electronics" | "hazardous" | "compost" | "textile";
type DisposalSite = {
  id: string;
  name: string;
  type: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
  address?: string;
  official: boolean;
  provider: string;
  services?: string[];
  sourceName: string;
  sourceUrl: string;
};
type DswaFacility = Omit<DisposalSite, "distanceKm"> & { serviceTypes: LocationType[] };

const typeLabels: Record<LocationType, string> = {
  recycling: "Everyday recycling",
  battery: "Battery drop-off",
  electronics: "Electronics recycling",
  hazardous: "Household hazardous waste",
  compost: "Yard waste",
  textile: "Textile reuse or recycling",
};
const dnrecTypeTags: Record<LocationType, string[]> = {
  recycling: ["Aluminum cans", "Glass Bottles", "Cardboard Boxes"],
  battery: ["Household Batteries", "Rechargeable Batteries", "Car Battery"],
  electronics: ["Electronics", "Computer Equipment"],
  hazardous: ["Household Hazardous Waste", "Latex Paint", "Propane Tanks"],
  compost: ["Yard Waste", "Food Waste"],
  textile: ["Clothing", "Clothes", "Shoes"],
};
const overpassFilters: Record<LocationType, string> = {
  recycling: '["amenity"="recycling"]',
  battery: '["recycling:batteries"="yes"]',
  electronics: '["recycling:electrical_appliances"="yes"]',
  hazardous: '["amenity"="waste_transfer_station"]',
  compost: '["recycling:organic"="yes"]',
  textile: '["recycling:clothes"="yes"]',
};

// Current public DSWA facilities, verified from the linked facility pages on
// 2026-08-20. These fixed coordinates are facility data, never user data.
const dswaFacilities: DswaFacility[] = [
  {
    id: "dswa-delaware-recycling-center", name: "Delaware Recycling Center", type: "DSWA recycling center",
    latitude: 39.7052121, longitude: -75.5390718, address: "1101 Lambson Lane, New Castle, DE 19720",
    official: true, provider: "DSWA",
    services: ["Single-stream recycling", "Batteries", "Electronics", "Household hazardous waste", "Used oil", "Paper shredding"],
    serviceTypes: ["recycling", "battery", "electronics", "hazardous"], sourceName: "Delaware Solid Waste Authority",
    sourceUrl: "https://dswa.com/facility/delaware-recycling-center/",
  },
  {
    id: "dswa-newark-recycling-center", name: "Newark Recycling Center", type: "DSWA recycling center",
    latitude: 39.6183231, longitude: -75.7611486, address: "470 Corporate Boulevard, Newark, DE 19702",
    official: true, provider: "DSWA",
    services: ["Single-stream recycling", "Batteries", "Electronics", "Household hazardous waste", "Used oil", "Paper shredding"],
    serviceTypes: ["recycling", "battery", "electronics", "hazardous"], sourceName: "Delaware Solid Waste Authority",
    sourceUrl: "https://dswa.com/facility/newark-recycling-center/",
  },
  {
    id: "dswa-cheswold-collection-station", name: "Cheswold Collection Station", type: "DSWA collection and recycling center",
    latitude: 39.2016553, longitude: -75.5717839, address: "54 Fork Branch Road, Dover, DE 19904",
    official: true, provider: "DSWA",
    services: ["Single-stream recycling", "Batteries", "Electronics", "Household hazardous waste", "Yard waste", "Used oil"],
    serviceTypes: ["recycling", "battery", "electronics", "hazardous", "compost"], sourceName: "Delaware Solid Waste Authority",
    sourceUrl: "https://dswa.com/facility/cheswold/",
  },
  {
    id: "dswa-southern-recycling-center", name: "Southern Recycling Center", type: "DSWA recycling center",
    latitude: 38.594684, longitude: -75.4364701, address: "28560 Landfill Lane, Georgetown, DE 19947",
    official: true, provider: "DSWA",
    services: ["Single-stream recycling", "Batteries", "Electronics", "Household hazardous waste", "Used oil", "Paper shredding"],
    serviceTypes: ["recycling", "battery", "electronics", "hazardous"], sourceName: "Delaware Solid Waste Authority",
    sourceUrl: "https://dswa.com/facility/southern-recycling-center/",
  },
  {
    id: "dswa-bridgeville-collection-station", name: "Bridgeville Collection Station", type: "DSWA collection station",
    latitude: 38.7593295, longitude: -75.6410331, address: "16539 Polk Road, Bridgeville, DE 19933",
    official: true, provider: "DSWA", services: ["Single-stream recycling", "Batteries", "Used oil", "Yard waste"],
    serviceTypes: ["recycling", "battery", "compost"], sourceName: "Delaware Solid Waste Authority",
    sourceUrl: "https://dswa.com/facility/bridgeville/",
  },
  {
    id: "dswa-omar-collection-station", name: "Omar Collection Station", type: "DSWA collection station",
    latitude: 38.5305053, longitude: -75.1722901, address: "33086 Burton Farm Road, Frankford, DE 19945",
    official: true, provider: "DSWA", services: ["Single-stream recycling", "Batteries", "Used oil", "Yard waste"],
    serviceTypes: ["recycling", "battery", "compost"], sourceName: "Delaware Solid Waste Authority",
    sourceUrl: "https://dswa.com/facility/omar/",
  },
  {
    id: "dswa-long-neck-collection-station", name: "Long Neck Collection Station", type: "DSWA collection station",
    latitude: 38.6257052, longitude: -75.2309411, address: "28963 Mount Joy Road, Millsboro, DE 19966",
    official: true, provider: "DSWA", services: ["Single-stream recycling", "Batteries", "Used oil", "Yard waste"],
    serviceTypes: ["recycling", "battery", "compost"], sourceName: "Delaware Solid Waste Authority",
    sourceUrl: "https://dswa.com/facility/long-neck/",
  },
  {
    id: "dswa-ellendale-collection-station", name: "Ellendale Collection Station", type: "DSWA collection station",
    latitude: 38.8064048, longitude: -75.429099, address: "13870 South Old State Road, Ellendale, DE 19941",
    official: true, provider: "DSWA", services: ["Single-stream recycling", "Batteries", "Used oil", "Yard waste"],
    serviceTypes: ["recycling", "battery", "compost"], sourceName: "Delaware Solid Waste Authority",
    sourceUrl: "https://dswa.com/facility/ellendale/",
  },
  {
    id: "dswa-rt5-transfer-station", name: "Route 5 Transfer Station", type: "DSWA transfer station and recycling drop-off",
    latitude: 38.6689926, longitude: -75.2328135, address: "29997 John P. Healy Drive, Harbeson, DE 19951",
    official: true, provider: "DSWA", services: ["Single-stream recycling", "Batteries", "Used oil"],
    serviceTypes: ["recycling", "battery"], sourceName: "Delaware Solid Waste Authority",
    sourceUrl: "https://dswa.com/facility/rt-5/",
  },
  {
    id: "dswa-milford-transfer-station", name: "Milford Transfer Station", type: "DSWA transfer station and recycling drop-off",
    latitude: 38.9071805, longitude: -75.4418927, address: "1170 South DuPont Boulevard, Milford, DE 19963",
    official: true, provider: "DSWA", services: ["Single-stream recycling", "Batteries", "Used oil"],
    serviceTypes: ["recycling", "battery"], sourceName: "Delaware Solid Waste Authority",
    sourceUrl: "https://dswa.com/facility/milford/",
  },
];

const distanceKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const radians = (value: number) => value * Math.PI / 180;
  const value = Math.sin(radians(lat2 - lat1) / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(radians(lon2 - lon1) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
};
const physical = (organization: Record<string, unknown>) => Number.isFinite(Number(organization.latitude)) && Number.isFinite(Number(organization.longitude));
const locationTypeFor = (value: string): LocationType | null => {
  const tag = normalizeDnrecText(value);
  if (/electronic|computer|laptop|tablet|cell phone|television|e waste/.test(tag)) return "electronics";
  if (/hazardous|paint|chemical|propane|fluorescent|special collection/.test(tag)) return "hazardous";
  if (/battery|batterie/.test(tag)) return "battery";
  if (/yard waste|compost|food waste|food scrap/.test(tag)) return "compost";
  if (/textile|clothing|clothes|shoe/.test(tag)) return "textile";
  if (/recycl|aluminum|glass|cardboard|paper|carton|bottle|can/.test(tag)) return "recycling";
  return null;
};
const locationTagPriority = (value: string) => {
  const type = locationTypeFor(value);
  return type === "electronics" ? 120 : type === "hazardous" ? 115 : type === "battery" ? 110 : type === "compost" ? 105 : type === "recycling" ? 90 : type === "textile" ? 80 : 0;
};
const relatedLocationTags = (item: string, tags: Array<{ tag?: string }>) => {
  const normalizedItem = normalizeDnrecText(item);
  return Array.from(new Set(tags.map((entry) => entry.tag?.trim()).filter((tag): tag is string => Boolean(tag))))
    .filter((tag) => normalizeDnrecText(tag) !== normalizedItem)
    .map((tag) => ({ tag, priority: locationTagPriority(tag) }))
    .filter(({ priority }) => priority > 0)
    .sort((left, right) => right.priority - left.priority || left.tag.localeCompare(right.tag))
    .slice(0, 6).map(({ tag }) => tag);
};

const fetchOfficialOrganizations = async (latitude: number, longitude: number, tag: string) => {
  const url = new URL(`${DNREC_API_BASE}/organization`);
  url.searchParams.set("_with", "tags");
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set("tag", tag.toLowerCase());
  url.searchParams.set("is_child", "1");
  url.searchParams.set("_sort", "distance");
  url.searchParams.set("null", "visitor_role_id");
  url.searchParams.set("per_page", "30");
  const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw new Error(`DNREC map service returned ${response.status}`);
  const body = await response.json() as { data?: Record<string, unknown>[] };
  return (body.data ?? []).filter(physical);
};
const mapDnrecOrganizations = (organizations: Record<string, unknown>[], latitude: number, longitude: number, sourceUrl: string): DisposalSite[] =>
  organizations.map((organization) => {
    const siteLatitude = Number(organization.latitude);
    const siteLongitude = Number(organization.longitude);
    return {
      id: `dnrec-${organization.organization_id}`,
      name: String(organization.name ?? "DNREC solution"),
      type: String(organization.pickup ?? "Delaware disposal solution"),
      latitude: siteLatitude,
      longitude: siteLongitude,
      // Recalculate from coordinates so every provider uses one known unit.
      // Upstream `distance` fields are not guaranteed to be kilometers.
      distanceKm: distanceKm(latitude, longitude, siteLatitude, siteLongitude),
      address: [organization.location_street1, organization.location_city, organization.location_region ?? "DE", organization.location_postal_code].filter(Boolean).join(", "),
      official: true, provider: "DNREC", sourceName: "Delaware DNREC Recyclopedia", sourceUrl,
    };
  });
const dswaSitesFor = (type: LocationType, latitude: number, longitude: number): DisposalSite[] =>
  dswaFacilities.filter((facility) => facility.serviceTypes.includes(type)).map(({ serviceTypes: _serviceTypes, ...facility }) => ({
    ...facility,
    distanceKm: distanceKm(latitude, longitude, facility.latitude, facility.longitude),
  }));
const fetchDnrecTypeSites = async (type: LocationType, latitude: number, longitude: number) => {
  const results = await Promise.allSettled(dnrecTypeTags[type].map((tag) => fetchOfficialOrganizations(latitude, longitude, tag)));
  const organizations = results.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  return mapDnrecOrganizations(organizations, latitude, longitude, DNREC_RECYLOPEDIA_URL);
};

const fetchOpenStreetMapSites = async (type: LocationType, latitude: number, longitude: number): Promise<DisposalSite[]> => {
  const query = `[out:json][timeout:18];(node(around:30000,${latitude},${longitude})${overpassFilters[type]};way(around:30000,${latitude},${longitude})${overpassFilters[type]};);out center tags 60;`;
  let lastError: unknown;
  for (const endpoint of ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"]) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "EcoLearn/1.0 (+https://ecolearn.dev)" },
        body: new URLSearchParams({ data: query }), signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) throw new Error(`Map service returned ${response.status}`);
      const body = await response.json() as { elements?: Record<string, unknown>[] };
      return (body.elements ?? []).map((element) => {
        const tags = (element.tags || {}) as Record<string, string>;
        const center = element.center as Record<string, number> | undefined;
        const siteLatitude = Number(element.lat ?? center?.lat);
        const siteLongitude = Number(element.lon ?? center?.lon);
        return {
          id: `osm-${element.type}-${element.id}`, name: tags.name || tags.operator || typeLabels[type], type: typeLabels[type],
          latitude: siteLatitude, longitude: siteLongitude, distanceKm: distanceKm(latitude, longitude, siteLatitude, siteLongitude),
          address: [tags["addr:housenumber"], tags["addr:street"], tags["addr:city"], tags["addr:postcode"]].filter(Boolean).join(" "),
          official: false, provider: "OpenStreetMap", sourceName: "OpenStreetMap contributors",
          sourceUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`,
        } satisfies DisposalSite;
      }).filter((site) => Number.isFinite(site.latitude) && Number.isFinite(site.longitude));
    } catch (error) { lastError = error; }
  }
  console.warn("OpenStreetMap lookup unavailable", lastError);
  return [];
};
const uniqueSites = (sites: DisposalSite[]) => {
  const seen = new Set<string>();
  return sites.filter((site) => {
    const key = `${normalizeDnrecText(site.name)}:${site.latitude.toFixed(4)}:${site.longitude.toFixed(4)}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
};
const validDelawareAreaSite = (site: DisposalSite) =>
  Number.isFinite(site.latitude) &&
  Number.isFinite(site.longitude) &&
  Number.isFinite(site.distanceKm) &&
  site.latitude >= 37.5 && site.latitude <= 41 &&
  site.longitude >= -77.5 && site.longitude <= -73.5;
const sortedSites = (sites: DisposalSite[]) => uniqueSites(sites.filter(validDelawareAreaSite))
  .sort((left, right) => left.distanceKm - right.distanceKm || left.name.localeCompare(right.name)).slice(0, 24);

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405, headers: cors });
  if (Number(request.headers.get("content-length") ?? 0) > 4096) return Response.json({ error: "Request is too large." }, { status: 413, headers: cors });
  try {
    const { latitude, longitude, type, item } = await request.json();
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      return Response.json({ error: "Valid coordinates are required." }, { status: 400, headers: cors });
    }
    // Prevent this Delaware-only endpoint from becoming an unrestricted map proxy.
    if (latitude < 37.5 || latitude > 41 || longitude < -77.5 || longitude > -73.5) {
      return Response.json({ error: "Nearby search is available in and around Delaware." }, { status: 400, headers: cors });
    }

    const officialItem = typeof item === "string" ? item.trim().slice(0, 120) : "";
    if (officialItem) {
      let organizations = await fetchOfficialOrganizations(latitude, longitude, officialItem);
      let matchedTag = officialItem;
      let sourceUrl = `${DNREC_RECYLOPEDIA_URL}#/topic/${encodeURIComponent(officialItem.toLowerCase().replace(/\s+/g, "-"))}`;
      if (!organizations.length) {
        const guidance = await findLiveDelawareGuidance(officialItem, true);
        if (guidance.match) {
          sourceUrl = guidance.match.row.source_url;
          for (const tag of relatedLocationTags(officialItem, guidance.match.row.tags ?? [])) {
            const related = await fetchOfficialOrganizations(latitude, longitude, tag);
            if (related.length) { organizations = related; matchedTag = tag; break; }
          }
        }
      }
      const matchedType = locationTypeFor(matchedTag);
      const dnrecSites = mapDnrecOrganizations(organizations, latitude, longitude, sourceUrl);
      const dswaSites = matchedType ? dswaSitesFor(matchedType, latitude, longitude) : [];
      const sites = sortedSites([...dnrecSites, ...dswaSites]);
      return Response.json({
        sites,
        sourceName: dswaSites.length ? "Delaware DNREC Recyclopedia and DSWA" : "Delaware DNREC Recyclopedia",
        sourceUrl, matchedTag,
        notice: sites.length
          ? "Facility services and schedules can change. Verify accepted materials and current hours before visiting."
          : "DNREC has no mapped location for this item. Review the official item protocol for curbside, event, or other solutions.",
      }, { headers: { ...cors, "Cache-Control": "private, max-age=300" } });
    }

    const requestedType = String(type ?? "recycling") as LocationType;
    if (!(requestedType in typeLabels)) return Response.json({ error: "Choose a supported location type." }, { status: 400, headers: cors });
    const [dnrecSites, osmSites] = await Promise.all([
      fetchDnrecTypeSites(requestedType, latitude, longitude),
      fetchOpenStreetMapSites(requestedType, latitude, longitude),
    ]);
    const sites = sortedSites([...dswaSitesFor(requestedType, latitude, longitude), ...dnrecSites, ...osmSites]);
    return Response.json({
      sites,
      sourceName: "Delaware DSWA, DNREC Recyclopedia, and OpenStreetMap",
      sourceUrl: "https://dswa.com/facility/", matchedTag: typeLabels[requestedType],
      notice: sites.length
        ? "Official DSWA and DNREC listings are supplemented by community map data. Verify accepted materials and current hours before visiting."
        : "No mapped locations were returned for this category. Check DSWA’s facility directory for statewide options.",
    }, { headers: { ...cors, "Cache-Control": "private, max-age=300" } });
  } catch (error) {
    console.error("find-disposal-sites failed", error);
    return Response.json({ error: "Nearby disposal lookup is temporarily unavailable." }, { status: 503, headers: cors });
  }
});
