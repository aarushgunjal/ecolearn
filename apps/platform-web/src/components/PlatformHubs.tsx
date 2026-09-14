import { useEffect, useState } from "react";
import {
  BarChart3,
  BellRing,
  BookOpen,
  CalendarDays,
  Check,
  ChevronRight,
  ClipboardList,
  Download,
  FileText,
  GraduationCap,
  MapPin,
  ScanBarcode,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { useProgress } from "@/hooks/useProgress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ScanUtilities } from "@/components/ScanUtilities";
import { CommunityWorkspace } from "@/components/CommunityWorkspace";

const municipalities = [
  "Delaware",
  "New Castle County, DE",
  "Kent County, DE",
  "Sussex County, DE",
];

export function LocalRules() {
  const [city, setCity] = useState(
    () => localStorage.getItem("ecolearn-city") || "Delaware",
  );
  const { toast } = useToast();
  const save = () => {
    localStorage.setItem("ecolearn-city", city);
    toast({
      title: "Local rules updated",
      description: `Saved ${city}. Official Delaware guidance applies statewide.`,
    });
  };
  return (
    <Hub
      title="Delaware recycling rules"
      eyebrow="Official DNREC guidance"
      icon={<MapPin />}
    >
      <div className="grid gap-5 lg:grid-cols-[1fr_.8fr]">
        <section className="rounded-2xl border border-[#e0e7dc] bg-white p-6">
          <label className="text-sm font-bold">Your municipality</label>
          <select
            aria-label="Your municipality"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="mt-3 w-full rounded-xl border border-[#dce4d8] bg-white px-4 py-3 outline-none"
          >
            {municipalities.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <button
            onClick={save}
            className="mt-4 rounded-xl bg-[#173d2a] px-5 py-3 text-sm font-bold text-white"
          >
            Save location
          </button>

        </section>
        <section className="rounded-2xl bg-[#edf7e8] p-6">
          <p className="text-sm font-bold text-[#347b43]">
            IN {city.toUpperCase()}
          </p>
          <h2 className="mt-2 text-xl font-semibold">
            Keep these loose and clean
          </h2>
          <ul className="mt-4 space-y-3 text-sm text-[#59715d]">
            <li className="flex gap-2">
              <Check size={17} className="text-[#3f934d]" />
              Metal cans, paper, cardboard, glass jars
            </li>
            <li className="flex gap-2">
              <Check size={17} className="text-[#3f934d]" />
              Empty plastic bottles and containers
            </li>
            <li className="flex gap-2">
              <X size={17} className="text-[#b86152]" />
              Bags, greasy paper, batteries, and cords
            </li>
          </ul>
          <a
            href="https://dnrec.delaware.gov/waste-hazardous/recycling/what/"
            target="_blank"
            rel="noreferrer"
            className="mt-5 inline-flex text-sm font-bold text-[#317a45] underline underline-offset-2"
          >
            Open Delaware DNREC Recyclopedia ↗
          </a>
        </section>
      </div>
    </Hub>
  );
}

export function Community() {
  return <CommunityWorkspace mode="community" />;
}

export function Schools() {
  return <CommunityWorkspace mode="school" />;
}

export function Organization() {
  return <CommunityWorkspace mode="organization" />;
}

export function Admin() {
  const { progress } = useProgress();
  const { toast } = useToast();
  const [scanCategories, setScanCategories] = useState<Array<[string, number]>>(
    [],
  );
  const [scanStats, setScanStats] = useState({ total: 0, avgConfidence: 0 });
  const [itemAnalytics, setItemAnalytics] = useState<Array<{
    item_name: string;
    searches: number;
    scans: number;
    confusing_events: number;
    confusion_rate: number;
  }>>([]);
  const [itemAnalyticsReady, setItemAnalyticsReady] = useState(true);
  useEffect(() => {
    const loadScanCategories = async () => {
      const { data } = await supabase
        .from("scan_history")
        .select("category, confidence_score");
      const counts = new Map<string, number>();
      let confidenceTotal = 0;
      let confidenceCount = 0;

      for (const row of data || []) {
        const category = row.category || "Uncategorized";
        counts.set(category, (counts.get(category) || 0) + 1);
        if (typeof row.confidence_score === "number") {
          confidenceTotal += row.confidence_score;
          confidenceCount += 1;
        }
      }

      const sorted = Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4);

      setScanStats({
        total: data?.length || 0,
        avgConfidence:
          confidenceCount > 0 ? confidenceTotal / confidenceCount : 0,
      });
      setScanCategories(sorted);
    };

    void loadScanCategories();
  }, [progress?.total_scans]);
  useEffect(() => {
    const loadItemAnalytics = async () => {
      const { data, error } = await supabase.rpc("get_item_interaction_analytics", {
        p_days: 30,
        p_limit: 12,
      });
      if (error) {
        console.warn("Item analytics unavailable", error);
        setItemAnalyticsReady(false);
        return;
      }
      setItemAnalyticsReady(true);
      setItemAnalytics((data ?? []).map((row) => ({
        item_name: String(row.item_name ?? "Unknown item"),
        searches: Number(row.searches ?? 0),
        scans: Number(row.scans ?? 0),
        confusing_events: Number(row.confusing_events ?? 0),
        confusion_rate: Number(row.confusion_rate ?? 0),
      })));
    };
    void loadItemAnalytics();
  }, []);
  return (
    <Hub
      title="Personal analytics"
      eyebrow="Your activity dashboard"
      icon={<BarChart3 />}
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MiniMetric value={`${scanStats.total}`} label="Your scans" />
        <MiniMetric
          value={`${scanStats.avgConfidence.toFixed(1)}%`}
          label="Avg confidence"
        />
        <MiniMetric value={`${progress?.xp ?? 0}`} label="Lifetime XP" />
        <MiniMetric value={`${progress?.total_lessons_completed ?? 0}`} label="Lessons completed" />
      </div>
      <section className="mt-6 grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-[#e0e7dc] bg-white p-6">
          <h2 className="font-semibold">Popular scan categories</h2>
          {scanCategories.length === 0 ? (
            <p className="mt-5 text-sm leading-6 text-[#6b796f]">
              No saved scans yet. Real categories will appear after scans are completed.
            </p>
          ) : <div className="mt-5 space-y-4">
            {scanCategories.map(([name, count], index) => {
              const maxCount = scanCategories[0]?.[1] || count || 1;
              const width = Math.max(12, Math.round((count / maxCount) * 100));
              return (
                <div key={String(name)}>
                  <div className="flex justify-between text-sm">
                    <span>{name}</span>
                    <span className="font-bold text-[#41854c]">{count}</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-[#eef1ec]">
                    <div
                      className="h-full rounded-full bg-[#55a457]"
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>}
        </div>
        <div className="rounded-2xl border border-[#e0e7dc] bg-white p-6">
          <h2 className="font-semibold">Export your activity</h2>
          <button className="mt-5 rounded-xl border p-4" onClick={() => {
            const blob = new Blob([JSON.stringify({ exported_at: new Date().toISOString(), progress, scanStats, scanCategories }, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a"); link.href = url; link.download = "ecolearn-activity.json"; link.click(); URL.revokeObjectURL(url);
          }}>Download activity report</button>
        </div>
      </section>
      <section className="mt-5 rounded-2xl border border-[#e0e7dc] bg-white p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-semibold">Item demand and confusion</h2>
            <p className="mt-1 text-sm text-[#6b796f]">
              Aggregate searches and scans from the last 30 days. Photos, locations, and user identities are not recorded here.
            </p>
          </div>
          <span className="rounded-full bg-[#edf7e8] px-3 py-1 text-xs font-bold text-[#347a43]">
            {itemAnalytics.reduce((total, row) => total + row.searches + row.scans, 0)} interactions
          </span>
        </div>
        {!itemAnalyticsReady ? (
          <p className="mt-5 rounded-xl bg-[#fff7e6] p-4 text-sm text-[#76551f]">
            Apply the item-interaction analytics migration to begin collecting aggregate results.
          </p>
        ) : itemAnalytics.length === 0 ? (
          <p className="mt-5 text-sm text-[#6b796f]">
            No item analytics have been collected yet.
          </p>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead className="text-xs uppercase tracking-[.08em] text-[#748177]">
                <tr>
                  <th className="pb-3 pr-4">Item</th>
                  <th className="pb-3 pr-4">Searches</th>
                  <th className="pb-3 pr-4">Scans</th>
                  <th className="pb-3 pr-4">Confusing</th>
                  <th className="pb-3">Confusion rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e8ede5]">
                {itemAnalytics.map((row) => (
                  <tr key={row.item_name}>
                    <td className="py-3 pr-4 font-semibold text-[#294332]">{row.item_name}</td>
                    <td className="py-3 pr-4">{row.searches}</td>
                    <td className="py-3 pr-4">{row.scans}</td>
                    <td className="py-3 pr-4">{row.confusing_events}</td>
                    <td className="py-3">{row.confusion_rate.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </Hub>
  );
}

export function ScannerTools() {
  return (
    <Hub
      title="Smart scan tools"
      eyebrow="More ways to identify an item"
      icon={<ScanBarcode />}
    >
      <p className="mb-5 max-w-3xl text-sm leading-6 text-[#66746a]">
        Use a barcode, read a package label, or explore nearby Delaware
        recycling and special-waste locations. Location is requested only when
        you start a nearby search.
      </p>
      <ScanUtilities allowGenericLocations />
    </Hub>
  );
}

export { NotificationCenter as Notifications } from "./NotificationCenter";

function Hub({
  title,
  eyebrow,
  icon,
  children,
}: {
  title: string;
  eyebrow: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="animate-in fade-in duration-500">
      <div className="mb-8">
        <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-[.14em] text-[#468b52]">
          {icon}
          {eyebrow}
        </p>
        <h1 className="display-serif mt-2 text-4xl tracking-[-.05em] sm:text-5xl">
          {title}
        </h1>
      </div>
      {children}
    </div>
  );
}
function MiniMetric({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-[#e0e7dc] bg-white p-5">
      <p className="text-2xl font-semibold tracking-[-.05em] text-[#1c492b]">
        {value}
      </p>
      <p className="mt-1 text-sm text-[#748176]">{label}</p>
    </div>
  );
}
