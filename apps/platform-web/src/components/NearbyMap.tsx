import { useEffect, useRef } from "react";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";

export type MapSite = {
  id: string;
  name: string;
  type: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
  address?: string;
};

type Coordinates = { latitude: number; longitude: number };

const tileUrl =
  import.meta.env.VITE_MAP_TILE_URL ||
  "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const tileAttribution =
  import.meta.env.VITE_MAP_ATTRIBUTION ||
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>';

const markerIcon = (label: string, selected: boolean) =>
  L.divIcon({
    className: "ecolearn-map-marker-shell",
    html: `<span class="ecolearn-map-marker${selected ? " is-selected" : ""}"><b>${label}</b></span>`,
    iconAnchor: [17, 38],
    iconSize: [34, 40],
  });

const userIcon = L.divIcon({
  className: "ecolearn-user-marker-shell",
  html: '<span class="ecolearn-user-marker" aria-hidden="true"></span>',
  iconAnchor: [10, 10],
  iconSize: [20, 20],
});

export function NearbyMap({
  userLocation,
  sites,
  selectedSiteId,
  onSelect,
}: {
  userLocation: Coordinates;
  sites: MapSite[];
  selectedSiteId: string | null;
  onSelect: (site: MapSite) => void;
}) {
  const elementRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!elementRef.current || mapRef.current) return;
    const map = L.map(elementRef.current, {
      center: [userLocation.latitude, userLocation.longitude],
      zoom: 11,
      scrollWheelZoom: false,
    });
    L.tileLayer(tileUrl, {
      attribution: tileAttribution,
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);
    window.setTimeout(() => map.invalidateSize(), 0);
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, [userLocation.latitude, userLocation.longitude]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    const userMarker = L.marker(
      [userLocation.latitude, userLocation.longitude],
      { icon: userIcon, keyboard: true, title: "Your approximate location" },
    ).bindTooltip("Your approximate location");
    layer.addLayer(userMarker);

    sites.forEach((site, index) => {
      const popup = document.createElement("div");
      const name = document.createElement("strong");
      const detail = document.createElement("div");
      name.textContent = site.name;
      detail.textContent = `${site.type} · ${site.distanceKm.toFixed(1)} km away`;
      popup.append(name, detail);

      const marker = L.marker([site.latitude, site.longitude], {
        icon: markerIcon(String(index + 1), site.id === selectedSiteId),
        keyboard: true,
        title: site.name,
      })
        .bindPopup(popup)
        .on("click", () => onSelect(site));
      layer.addLayer(marker);
      if (site.id === selectedSiteId) marker.openPopup();
    });

    const points: L.LatLngExpression[] = [
      [userLocation.latitude, userLocation.longitude],
      ...sites.map(
        (site) => [site.latitude, site.longitude] as L.LatLngExpression,
      ),
    ];
    if (points.length === 1) {
      map.setView(points[0], 11);
    } else {
      map.fitBounds(L.latLngBounds(points), { padding: [35, 35], maxZoom: 13 });
    }
    window.setTimeout(() => map.invalidateSize(), 0);
  }, [onSelect, selectedSiteId, sites, userLocation]);

  return (
    <div
      ref={elementRef}
      className="h-80 w-full rounded-xl border border-[#dbe5d8]"
      role="application"
      aria-label={`Nearby disposal map with ${sites.length} location${sites.length === 1 ? "" : "s"}`}
    />
  );
}
