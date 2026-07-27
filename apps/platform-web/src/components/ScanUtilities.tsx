import { useRef, useState } from "react";
import {
  Barcode,
  FileText,
  LoaderCircle,
  MapPin,
  Navigation,
  Search,
  Upload,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type BarcodeResult = {
  found: boolean;
  name?: string;
  brand?: string;
  packaging?: string;
  guidance?: string;
  source?: string;
};
type LabelResult = {
  text: string;
  materials: string[];
  recyclingSymbols: string[];
  guidance: string;
};
type DisposalSite = {
  id: string;
  name: string;
  type: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
  address?: string;
};

const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Couldn't read this image."));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });

export function ScanUtilities() {
  const { toast } = useToast();
  const [barcode, setBarcode] = useState("");
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const [barcodeResult, setBarcodeResult] = useState<BarcodeResult | null>(
    null,
  );
  const [labelConsent, setLabelConsent] = useState(false);
  const [labelLoading, setLabelLoading] = useState(false);
  const [labelResult, setLabelResult] = useState<LabelResult | null>(null);
  const [placesLoading, setPlacesLoading] = useState(false);
  const [places, setPlaces] = useState<DisposalSite[]>([]);
  const [placeType, setPlaceType] = useState("recycling");
  const [mapCenter, setMapCenter] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const labelInput = useRef<HTMLInputElement>(null);

  const lookupBarcode = async () => {
    const value = barcode.replace(/[^0-9]/g, "");
    if (value.length < 8 || value.length > 14)
      return toast({
        title: "Enter a valid barcode",
        description: "Use the 8–14 digits printed below the bars.",
        variant: "destructive",
      });
    setBarcodeLoading(true);
    setBarcodeResult(null);
    try {
      const { data, error } = await supabase.functions.invoke(
        "lookup-barcode",
        { body: { barcode: value } },
      );
      if (error) throw error;
      setBarcodeResult(data as BarcodeResult);
    } catch (error) {
      console.error("Barcode lookup failed", error);
      toast({
        title: "Barcode lookup is unavailable",
        description: "Try again shortly or scan the item photo instead.",
        variant: "destructive",
      });
    } finally {
      setBarcodeLoading(false);
    }
  };

  const readLabel = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!labelConsent)
      return toast({
        title: "Confirm AI label reading first",
        description: "This permission is separate from training consent.",
        variant: "destructive",
      });
    if (!file.type.startsWith("image/") || file.size > 6 * 1024 * 1024)
      return toast({
        title: "Choose a smaller image",
        description: "Use a clear JPG, PNG, or WebP under 6 MB.",
        variant: "destructive",
      });
    setLabelLoading(true);
    setLabelResult(null);
    try {
      const image = await readAsDataUrl(file);
      const { data, error } = await supabase.functions.invoke("read-label", {
        body: { image },
      });
      if (error) throw error;
      setLabelResult(data as LabelResult);
    } catch (error) {
      console.error("Label reading failed", error);
      toast({
        title: "We couldn't read that label",
        description: "Use good light and make the symbols fill the frame.",
        variant: "destructive",
      });
    } finally {
      setLabelLoading(false);
      if (labelInput.current) labelInput.current.value = "";
    }
  };

  const findPlaces = () => {
    if (!navigator.geolocation)
      return toast({
        title: "Location isn't available",
        description: "Your browser doesn't support location lookup.",
        variant: "destructive",
      });
    setPlacesLoading(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        setMapCenter({
          latitude: coords.latitude,
          longitude: coords.longitude,
        });
        try {
          const { data, error } = await supabase.functions.invoke(
            "find-disposal-sites",
            {
              body: {
                latitude: coords.latitude,
                longitude: coords.longitude,
                type: placeType,
              },
            },
          );
          if (error) throw error;
          setPlaces((data?.sites || []) as DisposalSite[]);
          if (!(data?.sites || []).length)
            toast({
              title: "No nearby matches yet",
              description:
                "Try another disposal type or check your municipal program.",
            });
        } catch (error) {
          console.error("Disposal lookup failed", error);
          toast({
            title: "Nearby search is unavailable",
            description: "Please try again shortly.",
            variant: "destructive",
          });
        } finally {
          setPlacesLoading(false);
        }
      },
      () => {
        setPlacesLoading(false);
        toast({
          title: "Location permission needed",
          description: "Allow location access to see nearby disposal options.",
          variant: "destructive",
        });
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  };

  const mapUrl = mapCenter
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${mapCenter.longitude - 0.025}%2C${mapCenter.latitude - 0.018}%2C${mapCenter.longitude + 0.025}%2C${mapCenter.latitude + 0.018}&layer=mapnik&marker=${mapCenter.latitude}%2C${mapCenter.longitude}`
    : "";

  return (
    <section className="mt-8 grid gap-5 lg:grid-cols-2">
      <div className="rounded-[1.5rem] border border-[#dfe6dc] bg-white p-6">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#edf7e8] text-[#337d45]">
            <Barcode size={20} />
          </span>
          <div>
            <h2 className="font-semibold">Barcode lookup</h2>
            <p className="text-sm text-[#718076]">
              Find a packaged food item and its packaging details.
            </p>
          </div>
        </div>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <input
            value={barcode}
            onChange={(event) =>
              setBarcode(event.target.value.replace(/[^0-9]/g, ""))
            }
            onKeyDown={(event) => event.key === "Enter" && void lookupBarcode()}
            inputMode="numeric"
            maxLength={14}
            placeholder="UPC / EAN barcode"
            className="min-w-0 flex-1 rounded-xl border border-[#dce5d9] bg-[#fbfcfa] px-4 py-3 text-sm outline-none focus:border-[#4b9656]"
          />
          <button
            onClick={() => void lookupBarcode()}
            disabled={barcodeLoading}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#173d2a] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {barcodeLoading ? (
              <LoaderCircle className="animate-spin" size={16} />
            ) : (
              <Search size={16} />
            )}{" "}
            Lookup
          </button>
        </div>
        {barcodeResult && (
          <div className="mt-4 rounded-xl bg-[#f4f8f1] p-4 text-sm">
            {barcodeResult.found ? (
              <>
                <p className="font-semibold text-[#24412e]">
                  {barcodeResult.name}
                </p>
                <p className="mt-1 text-[#607066]">
                  {[barcodeResult.brand, barcodeResult.packaging]
                    .filter(Boolean)
                    .join(" · ") || "Packaging details unavailable"}
                </p>
                <p className="mt-3 leading-6 text-[#365342]">
                  {barcodeResult.guidance}
                </p>
                <p className="mt-2 text-xs text-[#7b887d]">
                  Source: {barcodeResult.source}
                </p>
              </>
            ) : (
              <p className="leading-6 text-[#526257]">
                No product match. Scan a photo or search by name for guidance
                instead.
              </p>
            )}
          </div>
        )}
      </div>
      <div className="rounded-[1.5rem] border border-[#dfe6dc] bg-white p-6">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#edf7e8] text-[#337d45]">
            <FileText size={20} />
          </span>
          <div>
            <h2 className="font-semibold">Read a label</h2>
            <p className="text-sm text-[#718076]">
              Extract material and recycling symbols from a package label.
            </p>
          </div>
        </div>
        <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl bg-[#f7faf5] p-3 text-xs leading-5 text-[#607066]">
          <input
            type="checkbox"
            checked={labelConsent}
            onChange={(event) => setLabelConsent(event.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[#347e45]"
          />{" "}
          I agree to send this one label photo to EcoLearn’s AI provider for
          reading. It is not stored or used for model training.
        </label>
        <input
          ref={labelInput}
          onChange={(event) => void readLabel(event)}
          accept="image/png,image/jpeg,image/webp"
          type="file"
          className="hidden"
        />
        <button
          onClick={() => labelInput.current?.click()}
          disabled={labelLoading || !labelConsent}
          className="mt-4 inline-flex items-center gap-2 rounded-xl border border-[#c7ddc0] bg-[#f4faef] px-4 py-3 text-sm font-semibold text-[#2c713d] disabled:opacity-60"
        >
          {labelLoading ? (
            <LoaderCircle className="animate-spin" size={16} />
          ) : (
            <Upload size={16} />
          )}
          {labelLoading ? "Reading label…" : "Choose label photo"}
        </button>
        {labelResult && (
          <div className="mt-4 rounded-xl bg-[#f4f8f1] p-4 text-sm">
            <p className="font-semibold text-[#24412e]">
              {labelResult.guidance}
            </p>
            {labelResult.materials?.length > 0 && (
              <p className="mt-2 text-[#607066]">
                Materials: {labelResult.materials.join(", ")}
              </p>
            )}
            {labelResult.recyclingSymbols?.length > 0 && (
              <p className="mt-1 text-[#607066]">
                Symbols: {labelResult.recyclingSymbols.join(", ")}
              </p>
            )}
            <p className="mt-3 text-xs leading-5 text-[#7b887d]">
              {labelResult.text}
            </p>
          </div>
        )}
      </div>
      <div className="rounded-[1.5rem] border border-[#dfe6dc] bg-white p-6 lg:col-span-2">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#edf7e8] text-[#337d45]">
              <MapPin size={20} />
            </span>
            <div>
              <h2 className="font-semibold">Nearby disposal</h2>
              <p className="text-sm text-[#718076]">
                Find local drop-off options. Your approximate location is used
                only for this search.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              value={placeType}
              onChange={(event) => setPlaceType(event.target.value)}
              className="min-h-11 rounded-xl border border-[#dce5d9] bg-white px-3 py-2.5 text-sm"
            >
              <option value="recycling">Recycling</option>
              <option value="battery">Batteries</option>
              <option value="compost">Compost</option>
              <option value="textile">Textiles</option>
            </select>
            <button
              onClick={findPlaces}
              disabled={placesLoading}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#173d2a] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {placesLoading ? (
                <LoaderCircle className="animate-spin" size={16} />
              ) : (
                <Navigation size={16} />
              )}{" "}
              Find nearby
            </button>
          </div>
        </div>
        {mapUrl && (
          <iframe
            title="Your nearby disposal map"
            src={mapUrl}
            className="mt-5 h-64 w-full rounded-xl border border-[#e0e7dc]"
            loading="lazy"
          />
        )}
        {places.length > 0 && (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {places.map((site) => (
              <a
                key={site.id}
                href={`https://www.google.com/maps/dir/?api=1&destination=${site.latitude},${site.longitude}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl border border-[#e0e7dc] p-4 transition hover:border-[#a8cc9e] hover:bg-[#f8fbf6]"
              >
                <p className="font-semibold text-[#24412e]">{site.name}</p>
                <p className="mt-1 text-sm text-[#607066]">
                  {site.type} · {site.distanceKm.toFixed(1)} km away
                </p>
                {site.address && (
                  <p className="mt-1 text-xs text-[#7b887d]">{site.address}</p>
                )}
                <p className="mt-3 text-xs font-semibold text-[#317a45]">
                  Get directions →
                </p>
              </a>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
