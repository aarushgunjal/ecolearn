import { useRef, useState } from "react";
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
import { useAchievements } from "@/hooks/useAchievements";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { openRouterJson } from "@/lib/openrouter";

type ScanResult = {
  item: string;
  recyclable: boolean;
  confidence: number;
  category: string;
  instructions: string;
  image?: string;
  top_predictions?: { class: string; confidence: number }[];
  tips: string[];
};

const fallbackLookup = (query: string): ScanResult => {
  const term = query.toLowerCase();
  const recyclable = /(bottle|can|jar|cardboard|paper|aluminum|tin)/.test(term);
  const item = query.trim().replace(/\b\w/g, (c) => c.toUpperCase());
  return {
    item,
    recyclable,
    confidence: recyclable ? 91 : 76,
    category: recyclable ? "Mixed recycling" : "Landfill",
    instructions: recyclable
      ? "Empty, rinse, and place loose in your recycling bin."
      : "Keep this out of recycling to prevent contamination.",
    tips: recyclable
      ? [
          "Empty all contents",
          "Give it a quick rinse",
          "Keep it loose — never bag recyclables",
        ]
      : [
          "Place it in your trash bin",
          "Do not place it in recycling",
          "Check for a specialty drop-off option",
        ],
  };
};

const lookup = async (query: string): Promise<ScanResult> => {
  const item = query.trim();
  if (!item) return fallbackLookup(query);

  const result = await openRouterJson<ScanResult>({
    system:
      "You classify consumer items for recycling guidance. Return only JSON with item, recyclable, confidence, category, instructions, tips, and optional top_predictions. Use confidence as a percentage from 0 to 100.",
    user: `Classify this item by name: ${item}`,
    fallback: fallbackLookup(query),
  });

  const fallback = fallbackLookup(query);
  return {
    ...fallback,
    ...result,
    item: result.item?.trim() || fallback.item,
    confidence: Number.isFinite(result.confidence)
      ? Math.max(0, Math.min(100, Number(result.confidence)))
      : fallback.confidence,
    tips: result.tips?.length > 0 ? result.tips : fallback.tips,
  };
};

export default function Scanner() {
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { addXP, incrementScans, updateStreak, progress, refreshProgress } =
    useProgress();
  const { checkAndAwardAchievements } = useAchievements();
  const { toast } = useToast();
  const avoidedKg = ((progress?.total_scans ?? 0) * 0.18).toFixed(1);
  const communityRank = Math.max(
    5,
    50 - Math.min(progress?.total_scans ?? 0, 15) * 2,
  );

  const saveScanToHistory = async (scanResult: ScanResult) => {
    if (!user) return;
    try {
      await supabase.from("scan_history").insert({
        user_id: user.id,
        item_name: scanResult.item,
        is_recyclable: scanResult.recyclable,
        confidence_score: scanResult.confidence,
        category: scanResult.category,
        instructions: scanResult.instructions,
      });
      await incrementScans();
      await updateStreak();
      await addXP(10);
      const latestProgress = await refreshProgress();
      if (latestProgress) await checkAndAwardAchievements(latestProgress);
    } catch (error) {
      console.error("Error saving scan:", error);
    }
  };

  const finish = async (scanResult: ScanResult) => {
    setResult(scanResult);
    await saveScanToHistory(scanResult);
    setIsScanning(false);
    toast({
      title: "+10 XP earned",
      description: `${scanResult.item} was added to your impact.`,
    });
  };

  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadedImage(URL.createObjectURL(file));
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
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(
        "https://aarugunj-waste-classifier.hf.space/predict",
        { method: "POST", body: formData },
      );
      if (!response.ok) throw new Error("Analysis failed");
      const data = await response.json();
      clearTimeout(delayedNotice);
      await finish({
        item: data.item || "Unknown item",
        recyclable: Boolean(data.recyclable),
        confidence: Number(data.confidence || 0),
        category: data.category || "Unknown",
        instructions:
          data.instructions || "Check local guidance before disposal.",
        image: data.image,
        top_predictions: data.top_predictions,
        tips: data.recyclable
          ? [
              "Empty all contents",
              "Rinse before recycling",
              "Check your local program",
            ]
          : [
              "Keep this out of recycling",
              "Place in regular trash",
              "Check for specialist drop-off options",
            ],
      });
    } catch (error) {
      clearTimeout(delayedNotice);
      setIsScanning(false);
      console.error(error);
      toast({
        title: "We couldn't read that image",
        description: "Try another photo with better lighting.",
        variant: "destructive",
      });
    }
  };

  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    setResult(null);
    setIsScanning(true);
    window.setTimeout(() => void lookup(searchQuery).then(finish), 550);
  };

  const reset = () => {
    setResult(null);
    setUploadedImage(null);
    setSearchQuery("");
    if (fileInputRef.current) fileInputRef.current.value = "";
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
              Scan an item for clear, local disposal guidance and make every
              choice count.
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
                <MapPin size={13} /> New York, NY
              </span>
            </div>
            <div className="p-5 sm:p-6">
              {!result && !isScanning && (
                <div className="space-y-5">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="group relative flex min-h-[280px] w-full flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed border-[#bcd6b8] bg-[#f6fbf3] px-5 transition hover:border-[#5a9b62] hover:bg-[#f0f9eb]"
                    aria-label="Upload an item photo"
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
                          Drop a photo to scan
                        </span>
                        <span className="mt-1 text-sm text-[#7c897f]">
                          or click to browse your gallery
                        </span>
                      </>
                    )}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  <div className="relative flex items-center">
                    <div className="h-px flex-1 bg-[#e9ece7]" />
                    <span className="px-3 text-xs font-medium uppercase tracking-wider text-[#9aa39b]">
                      or identify by name
                    </span>
                    <div className="h-px flex-1 bg-[#e9ece7]" />
                  </div>
                  <div className="flex gap-2 rounded-xl border border-[#dfe5dc] bg-white p-1.5 shadow-sm">
                    <Search className="ml-2 mt-2.5 text-[#7a867d]" size={18} />
                    <input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                      placeholder="Try “plastic water bottle”"
                      className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none placeholder:text-[#a3aca4]"
                    />
                    <button
                      onClick={handleSearch}
                      disabled={!searchQuery.trim()}
                      className="rounded-lg bg-[#173d2a] px-4 text-sm font-semibold text-white disabled:opacity-40"
                    >
                      Check
                    </button>
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
                    Looking closely…
                  </h3>
                  <p className="mt-2 text-sm text-[#748176]">
                    Matching materials with local guidance
                  </p>
                </div>
              )}
              {result && <ResultCard result={result} reset={reset} />}
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
    </div>
  );
}

function ResultCard({
  result,
  reset,
}: {
  result: ScanResult;
  reset: () => void;
}) {
  const good = result.recyclable;
  const confidence = Math.round(
    result.confidence * (result.confidence <= 1 ? 100 : 1),
  );
  return (
    <div className="animate-in fade-in slide-in-from-bottom-3 duration-500">
      <div className="grid gap-5 sm:grid-cols-[150px_1fr] sm:items-center">
        {result.image ? (
          <img
            src={`data:image/jpeg;base64,${result.image}`}
            alt={`Analyzed ${result.item}`}
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
          <p className="text-sm font-semibold text-[#6d796f]">We found</p>
          <h3 className="mt-1 text-2xl font-semibold tracking-[-.04em]">
            {result.item}
          </h3>
          <div
            className={`mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-bold ${good ? "bg-[#e5f4df] text-[#287540]" : "bg-[#fff0ed] text-[#c84c40]"}`}
          >
            {good ? <Recycle size={16} /> : <Trash2 size={16} />}
            {good ? "Recyclable" : "Not recyclable"}
            <span className="h-3 w-px bg-current opacity-25" />
            {confidence}% sure
          </div>
        </div>
      </div>
      <div className="mt-6 rounded-2xl border border-[#e4e9e1] bg-[#fafcf9] p-5">
        <p className="text-xs font-bold uppercase tracking-[.14em] text-[#7d8a80]">
          What to do
        </p>
        <p className="mt-2 font-medium leading-6 text-[#274033]">
          {result.instructions}
        </p>
        <div className="mt-4 space-y-2.5">
          {result.tips.map((tip) => (
            <p key={tip} className="flex gap-2 text-sm text-[#627167]">
              <Check size={16} className="mt-0.5 shrink-0 text-[#3a944f]" />
              {tip}
            </p>
          ))}
        </div>
      </div>
      {result.top_predictions?.length ? (
        <div className="mt-5">
          <p className="text-xs font-bold uppercase tracking-[.14em] text-[#7d8a80]">
            Also considered
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {result.top_predictions.slice(0, 3).map((pred) => (
              <span
                key={pred.class}
                className="rounded-lg bg-[#f0f3ee] px-3 py-1.5 text-xs text-[#68766c]"
              >
                {pred.class} · {Math.round(pred.confidence * 100)}%
              </span>
            ))}
          </div>
        </div>
      ) : null}
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
