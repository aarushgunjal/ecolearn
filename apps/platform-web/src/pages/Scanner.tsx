import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Camera,
  Check,
  ChevronRight,
  CircleHelp,
  Flame,
  ImageUp,
  Leaf,
  LoaderCircle,
  MapPin,
  Recycle,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useProgress } from "@/hooks/useProgress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ScanUtilities } from "@/components/ScanUtilities";
import { DSWAVideoCard } from "@/components/DSWAVideoCard";
import { videosForScan } from "@/data/dswaVideos";

type ScanResult = {
  item: string;
  recyclable: boolean;
  confidence: number;
  category: string;
  instructions: string;
  tips: string[];
  imageStatus?: "single_item" | "multiple_items" | "unclear";
  material?: string | null;
  visibleEvidence?: string | null;
  dnrec?: DelawareGuidance | null;
};

type VisionScanResponse = {
  verified: boolean;
  guidance: DelawareGuidance | null;
  observedItem: string | null;
  material: string | null;
  confidence: number;
  imageStatus: "single_item" | "multiple_items" | "unclear";
  visibleEvidence: string | null;
  nextSteps: string[];
  message: string;
};

type DelawareGuidance = {
  title: string;
  seoName: string;
  matchConfidence: number;
  category: string;
  curbside: boolean;
  instructions: string;
  tags: string[];
  sourceName: string;
  sourceUrl: string;
  sourceUpdatedAt?: string | null;
};

type DelawareSuggestion = { title: string; category: string };

const readAsDataUrl = (file: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Couldn't read selected image."));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });

const readAsVisionDataUrl = async (file: File) => {
  const sourceUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Couldn't open selected image."));
      image.src = sourceUrl;
    });
    const maxDimension = 1_600;
    const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Couldn't prepare selected image.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const compressed = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error("Couldn't prepare selected image.")),
        "image/jpeg",
        0.82,
      ),
    );
    return await readAsDataUrl(compressed);
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
};

const functionErrorMessage = async (error: unknown) => {
  if (error && typeof error === "object" && "context" in error) {
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      try {
        const payload = await context.clone().json() as { error?: unknown };
        if (typeof payload.error === "string" && payload.error.trim()) return payload.error;
      } catch {
        // Fall through to the standard client error message.
      }
    }
  }
  return error instanceof Error && error.message
    ? error.message
    : "EcoLearn could not complete the visual item check.";
};

const fallbackLookup = (query: string): ScanResult => {
  return {
    item: "Official Delaware protocol unavailable",
    recyclable: false,
    confidence: 0,
    category: "Verification required",
    instructions: "EcoLearn could not verify this as an official Delaware DNREC item. Take a clearer one-item photo or search for the exact item name.",
    tips: ["No disposal advice is shown without a DNREC match", "Retake the photo with one item in good light", "Use the official DNREC Recyclopedia search"],
  };
};

const lookup = async (
  query: string,
  inputMethod: "typed_search" | "suggestion" = "typed_search",
): Promise<ScanResult> => {
  const item = query.trim();
  if (!item) return fallbackLookup(query);

  try {
    const { data, error } = await supabase.functions.invoke("delaware-guidance", {
      body: { item, inputMethod, clientPlatform: "web" },
    });
    if (error || !data?.verified || !data.guidance) return fallbackLookup(item);
    const guidance = data.guidance as DelawareGuidance;
    return {
      item: guidance.title,
      recyclable: guidance.curbside,
      confidence: guidance.matchConfidence,
      category: guidance.category,
      instructions: guidance.instructions,
      tips: ["Verified against Delaware DNREC Recyclopedia", "Follow the full official item protocol", "See available locations for this item"],
      dnrec: guidance,
    };
  } catch {
    return fallbackLookup(item);
  }
};

export default function Scanner() {
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<DelawareSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const imageUrlRef = useRef<string | null>(null);
  const scanRequestIdRef = useRef(crypto.randomUUID());
  const { user } = useAuth();
  const { progress, refreshProgress } = useProgress();
  const { toast } = useToast();
  const avoidedKg = ((progress?.total_scans ?? 0) * 0.18).toFixed(1);
  const communityRank = Math.max(
    5,
    50 - Math.min(progress?.total_scans ?? 0, 15) * 2,
  );

  useEffect(
    () => () => {
      if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current);
    },
    [],
  );

  useEffect(() => {
    const query = searchQuery.trim();
    if (query.length < 2) {
      setSuggestions([]);
      setSuggestionsLoading(false);
      return;
    }
    let active = true;
    const timer = window.setTimeout(async () => {
      setSuggestionsLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("delaware-guidance", {
          body: { item: query, mode: "suggestions" },
        });
        if (error) throw error;
        if (active) setSuggestions((data?.suggestions ?? []) as DelawareSuggestion[]);
      } catch (error) {
        console.warn("Delaware suggestions unavailable", error);
        if (active) setSuggestions([]);
      } finally {
        if (active) setSuggestionsLoading(false);
      }
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [searchQuery]);

  const saveScanToHistory = async (scanResult: ScanResult) => {
    if (!user || !scanResult.dnrec) return false;
    try {
      const { error } = await supabase.rpc("record_ecolearn_scan", {
        p_item_name: scanResult.item,
        p_is_recyclable: scanResult.recyclable,
        p_confidence_score: scanResult.confidence,
        p_category: scanResult.category,
        p_instructions: scanResult.instructions,
        p_client_request_id: scanRequestIdRef.current,
      });
      if (error) throw error;
      await refreshProgress();
      return true;
    } catch (error) {
      console.error("Error saving scan:", error);
      toast({
        title: "Guidance shown, progress not saved",
        description: "Please try again after checking your connection.",
        variant: "destructive",
      });
      return false;
    }
  };

  const finish = async (scanResult: ScanResult) => {
    setResult(scanResult);
    const saved = await saveScanToHistory(scanResult);
    setIsScanning(false);
    if (saved) {
      toast({
        title: "+10 XP earned",
        description: `${scanResult.item} was added to your impact.`,
      });
    }
  };

  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file || isScanning) return;
    const supportedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
    if (!supportedTypes.has(file.type) || file.size > 8 * 1024 * 1024) {
      toast({
        title: "Choose a valid image",
        description: "Use a JPG, PNG, or WebP image under 8 MB.",
        variant: "destructive",
      });
      event.target.value = "";
      return;
    }
    if (!user) {
      toast({
        title: "Sign in to scan",
        description:
          "An account keeps scans private and protects the visual lookup service.",
        variant: "destructive",
      });
      event.target.value = "";
      return;
    }
    if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current);
    imageUrlRef.current = URL.createObjectURL(file);
    scanRequestIdRef.current = crypto.randomUUID();
    setUploadedImage(imageUrlRef.current);
    setResult(null);
    setIsScanning(true);
    const delayedNotice = setTimeout(
      () =>
        toast({
          title: "Still working…",
          description: "The AI model may take a moment to wake up.",
        }),
      10000,
    );
    try {
      const image = await readAsVisionDataUrl(file);
      const { data, error } = await supabase.functions.invoke("explain-scan", {
        body: { image, clientPlatform: "web" },
      });
      if (error) throw new Error(await functionErrorMessage(error));
      clearTimeout(delayedNotice);
      const identified = data as VisionScanResponse;
      const guidance = identified.guidance;
      const scanResult: ScanResult = guidance
        ? {
            item: guidance.title,
            recyclable: guidance.curbside,
            confidence: guidance.matchConfidence,
            category: guidance.category,
            instructions: guidance.instructions,
            tips: [
              "Verified against Delaware DNREC Recyclopedia",
              "Follow the full official item protocol",
              "Use Delaware locations for nearby options",
            ],
            imageStatus: identified.imageStatus,
            material: identified.material,
            visibleEvidence: identified.visibleEvidence,
            dnrec: guidance,
          }
        : {
            item: identified.observedItem || "Item not identified",
            recyclable: false,
            confidence: identified.confidence,
            category: identified.imageStatus === "multiple_items"
              ? "Multiple items detected"
              : "No official DNREC match",
            instructions: identified.message,
            tips: identified.nextSteps,
            imageStatus: identified.imageStatus,
            material: identified.material,
            visibleEvidence: identified.visibleEvidence,
            dnrec: null,
          };
      await finish(scanResult);
    } catch (error) {
      clearTimeout(delayedNotice);
      setIsScanning(false);
      console.error(error);
      toast({
        title: "Visual item check unavailable",
        description: await functionErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      event.target.value = "";
    }
  };

  const handleSearch = () => {
    if (!searchQuery.trim() || isScanning) return;
    scanRequestIdRef.current = crypto.randomUUID();
    setSuggestions([]);
    setResult(null);
    setIsScanning(true);
    window.setTimeout(() => void lookup(searchQuery, "typed_search").then(finish), 550);
  };

  const chooseSuggestion = (title: string) => {
    if (isScanning) return;
    scanRequestIdRef.current = crypto.randomUUID();
    setSearchQuery(title);
    setSuggestions([]);
    setResult(null);
    setIsScanning(true);
    window.setTimeout(() => void lookup(title, "suggestion").then(finish), 100);
  };

  const reset = () => {
    setResult(null);
    setUploadedImage(null);
    setSearchQuery("");
    setSuggestions([]);
    if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current);
    imageUrlRef.current = null;
    scanRequestIdRef.current = crypto.randomUUID();
    if (galleryInputRef.current) galleryInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  return (
    <div className="animate-in fade-in duration-500">
      <section className="grid gap-7 lg:grid-cols-[1.35fr_.65fr] lg:gap-10">
        <div>
          <div className="mb-8 max-w-2xl">
            <p className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-[.16em] text-[#39814d]">
              <Sparkles size={16} /> Smart recycling, simplified
            </p>
            <h1 className="display-serif text-4xl leading-[1.04] tracking-[-.055em] text-[#173d2a] sm:text-5xl">
              Know where it goes. <em className="text-[#4c9a59]">Do better.</em>
            </h1>
            <p className="mt-4 max-w-lg text-base leading-7 text-[#68766c]">
              Scan an item for clear, Delaware-specific disposal guidance from
              DNREC and make every choice count.
            </p>
          </div>

          <div className="overflow-hidden rounded-[1.75rem] border border-[#dfe6dc] bg-white shadow-[0_24px_70px_-38px_rgba(19,61,42,.38)]">
            <div className="flex items-center justify-between border-b border-[#edf0ea] px-5 py-4 sm:px-6">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#e9f5e2] text-[#287640]">
                  <ScanIcon />
                </span>
                <div>
                  <h2 className="font-semibold">Item scanner</h2>
                  <p className="text-xs text-[#7b887d]">
                    Powered by EcoLearn AI
                  </p>
                </div>
              </div>
              <span className="hidden items-center gap-1.5 rounded-full bg-[#fff5dc] px-3 py-1.5 text-xs font-semibold text-[#987018] sm:flex">
              <MapPin size={13} /> Delaware-first
              </span>
            </div>
            <div className="p-5 sm:p-6">
              {!result && !isScanning && (
                <div className="space-y-5">
                  <button
                    onClick={() => galleryInputRef.current?.click()}
                    className="group relative flex min-h-[280px] w-full flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed border-[#bcd6b8] bg-[#f6fbf3] px-5 transition hover:border-[#5a9b62] hover:bg-[#f0f9eb]"
                    aria-label="Choose an item photo from your gallery"
                  >
                    {uploadedImage ? (
                      <>
                        <img
                          src={uploadedImage}
                          alt="Selected item"
                          className="absolute inset-0 h-full w-full object-cover opacity-35"
                        />
                        <span className="relative grid h-16 w-16 place-items-center rounded-2xl bg-white text-[#307a45] shadow-sm">
                          <ImageUp size={29} />
                        </span>
                        <span className="relative mt-4 font-semibold">
                          Choose a different photo
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="grid h-16 w-16 place-items-center rounded-2xl bg-white text-[#307a45] shadow-sm transition group-hover:scale-105">
                          <Camera size={30} />
                        </span>
                        <span className="mt-4 text-lg font-semibold">
                          Choose an item photo
                        </span>
                        <span className="mt-1 text-sm text-[#7c897f]">
                          One clear household item works best
                        </span>
                      </>
                    )}
                  </button>
                  <input
                    ref={galleryInputRef}
                    type="file"
                    accept="image/*"
                    aria-label="Choose photo from gallery"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    aria-label="Take a photo with camera"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => galleryInputRef.current?.click()}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#bcd6b8] bg-white px-4 py-3 text-sm font-semibold text-[#286d3b] transition hover:bg-[#f2f8ee]"
                    >
                      <ImageUp size={17} /> Choose from gallery
                    </button>
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#173d2a] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#245139]"
                    >
                      <Camera size={17} /> Take a photo
                    </button>
                  </div>
                  <p className="rounded-xl bg-[#fff8e8] px-3 py-2 text-xs leading-5 text-[#725c24]">
                    Student-safe scanning: photograph the item only. Do not include people, faces, names, schoolwork, or personal information.
                  </p>
                  <div className="relative flex items-center">
                    <div className="h-px flex-1 bg-[#e9ece7]" />
                    <span className="px-3 text-xs font-medium uppercase tracking-wider text-[#9aa39b]">
                      or identify by name
                    </span>
                    <div className="h-px flex-1 bg-[#e9ece7]" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex flex-col gap-2 rounded-xl border border-[#dfe5dc] bg-white p-1.5 shadow-sm sm:flex-row">
                      <Search className="ml-2 mt-2.5 text-[#7a867d]" size={18} />
                      <input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                        placeholder="Try “soda can”"
                        aria-label="Search official Delaware items"
                        aria-autocomplete="list"
                        aria-controls="delaware-item-suggestions"
                        className="min-w-0 flex-1 bg-transparent px-1 py-2.5 text-sm outline-none placeholder:text-[#a3aca4]"
                      />
                      <button
                        onClick={handleSearch}
                        disabled={!searchQuery.trim()}
                        className="rounded-lg bg-[#173d2a] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
                      >
                        Check
                      </button>
                    </div>
                    {(suggestionsLoading || suggestions.length > 0) && (
                      <div id="delaware-item-suggestions" role="listbox" className="overflow-hidden rounded-xl border border-[#dfe5dc] bg-white py-1 shadow-lg">
                        {suggestionsLoading && <p className="px-4 py-3 text-sm text-[#718076]">Searching official Delaware items…</p>}
                        {!suggestionsLoading && suggestions.map((suggestion) => (
                          <button key={suggestion.title} role="option" aria-selected="false" type="button" onClick={() => chooseSuggestion(suggestion.title)} className="block w-full px-4 py-3 text-left transition hover:bg-[#f2f8ee]">
                            <span className="block text-sm font-semibold text-[#24412e]">{suggestion.title}</span>
                            <span className="mt-0.5 block text-xs text-[#718076]">{suggestion.category}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
              {isScanning && (
                <div className="flex min-h-[420px] flex-col items-center justify-center text-center">
                  <div className="relative grid h-24 w-24 place-items-center rounded-[2rem] bg-[#e8f4e2] text-[#237442]">
                    <LoaderCircle className="animate-spin" size={38} />
                    <span className="absolute -inset-2 rounded-[2.25rem] border border-[#9dcc9b] animate-ping opacity-30" />
                  </div>
                  <h3 className="mt-7 text-xl font-semibold">
                    Identifying the item…
                  </h3>
                  <p className="mt-2 text-sm text-[#748176]">
                    One visual check, then a secure Delaware catalog search
                  </p>
                </div>
              )}
              {result && <ResultCard result={result} reset={reset} imageUrl={uploadedImage} />}
            </div>
          </div>
        </div>
        <aside className="space-y-5 pt-2">
          <div className="rounded-[1.5rem] bg-[#173d2a] p-6 text-white shadow-[0_20px_45px_-28px_rgba(19,61,42,.75)]">
            <div className="flex items-center justify-between">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10">
                <Flame className="text-[#f8c755]" fill="currentColor" />
              </span>
              <span className="text-sm font-medium text-white/55">
                This week
              </span>
            </div>
            <p className="mt-6 text-3xl font-semibold tracking-[-.05em]">
              {progress?.total_scans ?? 0}{" "}
              <span className="text-base font-medium text-white/55">
                items scanned
              </span>
            </p>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/15">
              <div className="h-full w-[42%] rounded-full bg-[#9bd487]" />
            </div>
            <p className="mt-2 text-xs text-white/60">
              {Math.max(0, 8 - (progress?.total_scans ?? 0))} more scans to
              reach your weekly goal
            </p>
          </div>
          <div className="rounded-[1.5rem] border border-[#dfe6dc] bg-white p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Your impact</h2>
              <button className="text-xs font-bold text-[#317a45]">
                View all
              </button>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <Stat value={`${progress?.xp ?? 0}`} label="XP earned" />
              <Stat value={`${avoidedKg} kg`} label="CO₂ avoided" />
              <Stat
                value={`${progress?.streak_days ?? 0}`}
                label="Day streak"
              />
              <Stat value={`Top ${communityRank}%`} label="Community rank" />
            </div>
          </div>
          <div className="rounded-[1.5rem] border border-[#dfe6dc] bg-[#eff8eb] p-6">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-[#3b8d4c]">
              <CircleHelp size={21} />
            </span>
            <h2 className="mt-4 font-semibold">Not sure about it?</h2>
            <p className="mt-1 text-sm leading-6 text-[#63776a]">
              Our guides explain the why behind every recycling decision.
            </p>
            <button
              onClick={() =>
                window.dispatchEvent(new Event("ecolearn-open-learn"))
              }
              className="mt-4 flex items-center gap-1 text-sm font-bold text-[#24723e]"
            >
              Explore learning <ChevronRight size={16} />
            </button>
          </div>
        </aside>
      </section>
      <ScanUtilities verifiedItem={result?.dnrec?.title} />
    </div>
  );
}

function ResultCard({
  result,
  reset,
  imageUrl,
}: {
  result: ScanResult;
  reset: () => void;
  imageUrl: string | null;
}) {
  const good = Boolean(result.dnrec?.curbside);
  const multipleItems = result.imageStatus === "multiple_items";
  const relatedVideos = result.dnrec
    ? videosForScan([
        result.item,
        result.category,
        result.material,
        result.instructions,
        ...(result.dnrec.tags ?? []),
      ])
    : [];
  return (
    <div className="animate-in fade-in slide-in-from-bottom-3 duration-500">
      <div className="grid gap-5 sm:grid-cols-[150px_1fr] sm:items-center">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={result.dnrec ? `Verified ${result.item}` : "Item awaiting official Delaware verification"}
            className="aspect-square w-full rounded-2xl object-cover"
          />
        ) : (
          <div
            className={`grid aspect-square place-items-center rounded-2xl ${good ? "bg-[#e5f4df] text-[#307b43]" : "bg-[#fff0ed] text-[#d85f52]"}`}
          >
            {good ? <Recycle size={51} /> : <Trash2 size={51} />}
          </div>
        )}
        <div>
          <p className="text-sm font-semibold text-[#6d796f]">{result.dnrec ? "Official DNREC match" : "Visual identification"}</p>
          <h3 className="mt-1 text-2xl font-semibold tracking-[-.04em]">
            {result.item}
          </h3>
          {!result.dnrec && result.material && (
            <p className="mt-1 text-sm text-[#68766c]">Likely material: {result.material}</p>
          )}
          <div
            className={`mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-bold ${good ? "bg-[#e5f4df] text-[#287540]" : "bg-[#fff0ed] text-[#c84c40]"}`}
          >
            {good ? <Recycle size={16} /> : <Trash2 size={16} />}
            {result.dnrec
              ? "Official DNREC record"
              : multipleItems
                ? "Multiple items—retake photo"
                : "No official DNREC match"}
          </div>
        </div>
      </div>
      <div className="mt-6 rounded-2xl border border-[#e4e9e1] bg-[#fafcf9] p-5">
        <p className="text-xs font-bold uppercase tracking-[.14em] text-[#7d8a80]">
          {result.dnrec ? "Official Delaware protocol" : "What happens next"}
        </p>
        <p className="mt-2 font-medium leading-6 text-[#274033]">
          {result.instructions}
        </p>
        {!result.dnrec && result.visibleEvidence && (
          <p className="mt-3 rounded-xl bg-white px-3 py-2 text-sm leading-6 text-[#617166]">
            Visible evidence: {result.visibleEvidence}
          </p>
        )}
        <div className="mt-4 space-y-2.5">
          {result.tips.map((tip) => (
            <p key={tip} className="flex gap-2 text-sm text-[#627167]">
              <Check size={16} className="mt-0.5 shrink-0 text-[#3a944f]" />
              {tip}
            </p>
          ))}
        </div>
      </div>
      {result.dnrec && (
        <div className="mt-4 flex min-w-0 flex-wrap items-center gap-x-4 gap-y-3">
          <button
            type="button"
            onClick={() => document.getElementById("available-locations")?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-[#a8cc9e] bg-[#f4faef] px-4 py-3 text-sm font-semibold text-[#286d3b] transition hover:bg-[#e9f5e4]"
          >
            <MapPin size={17} /> See available locations
          </button>
          <a
            href={result.dnrec.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="min-w-0 break-words text-xs font-bold leading-5 text-[#287640] underline underline-offset-2"
          >
            Verified source: Delaware DNREC Recyclopedia ↗
          </a>
        </div>
      )}
      {result.dnrec && /see solutions below/i.test(result.instructions) && (
        <p className="mt-3 text-xs leading-5 text-[#617166]">
          DNREC uses “solutions” to mean its mapped facilities and approved programs. Use <span className="font-semibold">See available locations</span> to find nearby options for this item.
        </p>
      )}
      {relatedVideos.length > 0 && (
        <section className="mt-6 rounded-2xl bg-[#f4f8f0] p-4 sm:p-5">
          <p className="text-xs font-bold uppercase tracking-[.14em] text-[#438b52]">
            Learn more from DSWA Education
          </p>
          <p className="mt-2 text-sm leading-6 text-[#657369]">
            This official Delaware video is selected from the verified item category, not from the product brand.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {relatedVideos.map((video) => <DSWAVideoCard key={video.id} video={video} compact />)}
          </div>
        </section>
      )}
      <p className="mt-4 text-[11px] leading-4 text-[#758277]">
        The image is used for this visual check only. EcoLearn does not store it
        or use it for training.
      </p>
      <button
        onClick={reset}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#173d2a] py-3.5 text-sm font-semibold text-white transition hover:bg-[#245139]"
      >
        <Camera size={17} /> Scan another item <ArrowRight size={16} />
      </button>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl bg-[#f6f8f4] p-3">
      <p className="text-lg font-semibold tracking-[-.04em] text-[#1e3c2a]">
        {value}
      </p>
      <p className="mt-0.5 text-[11px] font-medium text-[#7b877e]">{label}</p>
    </div>
  );
}
function ScanIcon() {
  return (
    <span className="relative block h-4 w-4 rounded border-2 border-current before:absolute before:left-1/2 before:top-1/2 before:h-1 before:w-1 before:-translate-x-1/2 before:-translate-y-1/2 before:rounded-full before:bg-current" />
  );
}
