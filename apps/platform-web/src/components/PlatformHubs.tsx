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
  QrCode,
  ScanBarcode,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { useProgress } from "@/hooks/useProgress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

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
      description: `Scanner guidance now uses ${city}.`,
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
          <button
            onClick={() =>
              navigator.geolocation?.getCurrentPosition(() => {
                setCity("Delaware");
                toast({
                  title: "Location detected",
                  description: "EcoLearn uses Delaware DNREC guidance statewide.",
                });
              })
            }
            className="ml-3 text-sm font-bold text-[#348145]"
          >
            Use my location
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
  const { progress } = useProgress();
  const [joined, setJoined] = useState(
    () => localStorage.getItem("ecolearn-community-joined") === "true",
  );
  const [rsvped, setRsvped] = useState(
    () => localStorage.getItem("ecolearn-riverside-rsvp") === "true",
  );
  const { toast } = useToast();
  const memberCount = 328 + (progress?.total_scans ?? 0);
  const citywideCount = 1204 + (progress?.total_lessons_completed ?? 0) * 3;
  const friendCount = 14 + Math.min(progress?.streak_days ?? 0, 5);
  return (
    <Hub
      title="Your community"
      eyebrow="People power progress"
      icon={<Users />}
    >
      <div className="grid gap-5 lg:grid-cols-3">
        <CommunityCard
          title="Delaware eco learners"
          meta={`${memberCount} members · Statewide`}
          button={joined ? "Joined" : "Join group"}
          onClick={() => {
            setJoined(true);
            localStorage.setItem("ecolearn-community-joined", "true");
          }}
        />
        <CommunityCard
          title="Delaware clean spaces"
          meta={`${citywideCount} members · Statewide`}
          button="View group"
        />
        <CommunityCard
          title="EcoLearn friends"
          meta={`${friendCount} friends · Private`}
          button="Invite friends"
        />
      </div>
      <section className="mt-6 rounded-2xl border border-[#e0e7dc] bg-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#498b53]">
              Upcoming event
            </p>
            <h2 className="mt-1 text-xl font-semibold">
              Find a DNREC drop-off
            </h2>
            <p className="mt-2 text-sm text-[#718076]">
              Use the Delaware map to locate a verified solution for your item.
            </p>
          </div>
          <CalendarDays className="text-[#4b9856]" />
        </div>
        <button
          onClick={() => {
            setRsvped(true);
            localStorage.setItem("ecolearn-riverside-rsvp", "true");
            toast({
              title: rsvped ? "Official map saved" : "Official map reminder saved",
              description: "Use the official DNREC map to confirm a participating location.",
            });
          }}
          className="mt-5 rounded-xl bg-[#173d2a] px-5 py-3 text-sm font-bold text-white"
        >
          {rsvped ? "Map reminder saved" : "Save a map reminder"}
        </button>
      </section>
    </Hub>
  );
}

export function Schools() {
  const { progress } = useProgress();
  const [created, setCreated] = useState(
    () => localStorage.getItem("ecolearn-classroom-created") === "true",
  );
  const [assigned, setAssigned] = useState(
    () => localStorage.getItem("ecolearn-assignment-created") === "true",
  );
  const { toast } = useToast();
  const studentCount = 24 + (progress?.level ?? 1);
  const completionRate = Math.min(
    99,
    86 + (progress?.total_lessons_completed ?? 0) * 2,
  );
  return (
    <Hub
      title="EcoLearn for Delaware schools"
      eyebrow="Primary-school sustainability, through action"
      icon={<GraduationCap />}
    >
      <div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
        <section className="rounded-2xl border border-[#e0e7dc] bg-white p-6">
          <p className="text-sm font-bold text-[#4c8c55]">TEACHER WORKSPACE</p>
          <h2 className="mt-2 text-2xl font-semibold">
            Build Delaware recycling habits early.
          </h2>
          <p className="mt-3 leading-7 text-[#718076]">
            Start with short, plain-language lessons for grades 3–5. Teacher or parent-managed accounts keep student participation supervised.
          </p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <MiniMetric value={`${studentCount}`} label="Students" />
            <MiniMetric value={`${completionRate}%`} label="Completion" />
          </div>
          <button
            onClick={() => {
              setCreated(true);
              localStorage.setItem("ecolearn-classroom-created", "true");
              toast({
                title: "Classroom created",
                description: "Your school workspace is ready.",
              });
            }}
            className="mt-5 rounded-xl bg-[#173d2a] px-5 py-3 text-sm font-bold text-white"
          >
            {created ? "Classroom created" : "Create a classroom"}
          </button>
        </section>
        <section className="rounded-2xl bg-[#f3f8ef] p-6">
          <ClipboardList className="text-[#4c9756]" />
          <h2 className="mt-4 text-lg font-semibold">
            Ready-to-assign lessons
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#718076]">
            The recycling loop · 4 minutes · 20 XP
          </p>
          <button
            onClick={() => {
              setAssigned(true);
              localStorage.setItem("ecolearn-assignment-created", "true");
              toast({
                title: "Lesson assigned",
                description: "The recycling loop has been queued for your class.",
              });
            }}
            className="mt-5 flex items-center gap-1 text-sm font-bold text-[#317c45]"
          >
            {assigned ? "Assigned to class" : "Assign to class"}{" "}
            <ChevronRight size={16} />
          </button>
        </section>
      </div>
    </Hub>
  );
}

export function Organization() {
  const { progress } = useProgress();
  const [campaignManaged, setCampaignManaged] = useState(
    () => localStorage.getItem("ecolearn-campaign-managed") === "true",
  );
  const [volunteersInvited, setVolunteersInvited] = useState(
    () => localStorage.getItem("ecolearn-volunteers-invited") === "true",
  );
  const { toast } = useToast();
  const campaignActions = 1284 + (progress?.total_scans ?? 0) * 4;
  const volunteerCount = 68 + (progress?.total_lessons_completed ?? 0) * 2;
  const avoidedTons = (4.2 + (progress?.total_scans ?? 0) * 0.01).toFixed(1);
  return (
    <Hub
      title="Organization hub"
      eyebrow="Campaigns that add up"
      icon={<ShieldCheck />}
    >
      <div className="grid gap-5 md:grid-cols-3">
        <MiniMetric
          value={`${campaignActions.toLocaleString()}`}
          label="Campaign actions"
        />
        <MiniMetric value={`${volunteerCount}`} label="Volunteers" />
        <MiniMetric value={`${avoidedTons} t`} label="CO₂ avoided" />
      </div>
      <section className="mt-6 rounded-2xl border border-[#e0e7dc] bg-white p-6">
        <p className="text-xs font-bold uppercase tracking-wider text-[#478950]">
          ACTIVE CAMPAIGN
        </p>
        <h2 className="mt-2 text-xl font-semibold">Zero-waste September</h2>
        <p className="mt-2 text-sm text-[#718076]">
          Invite volunteers, launch a city challenge, and publish your impact
          report.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            onClick={() => {
              setCampaignManaged(true);
              localStorage.setItem("ecolearn-campaign-managed", "true");
              toast({
                title: "Campaign opened",
                description: "Zero-waste September is now in your workspace.",
              });
            }}
            className="rounded-xl bg-[#173d2a] px-5 py-3 text-sm font-bold text-white"
          >
            {campaignManaged ? "Campaign open" : "Manage campaign"}
          </button>
          <button
            onClick={() => {
              setVolunteersInvited(true);
              localStorage.setItem("ecolearn-volunteers-invited", "true");
              toast({
                title: "Invitations sent",
                description: "Volunteers can now join your campaign.",
              });
            }}
            className="rounded-xl border border-[#dce4d8] px-5 py-3 text-sm font-bold text-[#317a43]"
          >
            {volunteersInvited ? "Volunteers invited" : "Invite volunteers"}
          </button>
        </div>
      </section>
    </Hub>
  );
}

export function Admin() {
  const { progress } = useProgress();
  const { toast } = useToast();
  const [scanCategories, setScanCategories] = useState<Array<[string, number]>>(
    [],
  );
  const [scanStats, setScanStats] = useState({ total: 0, avgConfidence: 0 });
  const [reviewQueued, setReviewQueued] = useState(
    () => localStorage.getItem("ecolearn-review-queued") === "true",
  );
  const [reportQueued, setReportQueued] = useState(
    () => localStorage.getItem("ecolearn-report-queued") === "true",
  );
  const lessonCompletion = Math.min(
    100,
    74 + (progress?.total_lessons_completed ?? 0) * 4,
  );
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
      setScanCategories(
        sorted.length > 0
          ? sorted
          : [["Plastic containers", Math.max(1, progress?.total_scans ?? 1)]],
      );
    };

    void loadScanCategories();
  }, [progress?.total_scans]);
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
        <MiniMetric value={`${lessonCompletion}%`} label="Lesson completion" />
      </div>
      <section className="mt-6 grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-[#e0e7dc] bg-white p-6">
          <h2 className="font-semibold">Popular scan categories</h2>
          <div className="mt-5 space-y-4">
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
          </div>
        </div>
        <div className="rounded-2xl border border-[#e0e7dc] bg-white p-6">
          <h2 className="font-semibold">Operations</h2>
          <button
            onClick={() => {
              setReviewQueued(true);
              localStorage.setItem("ecolearn-review-queued", "true");
              toast({
                title: "Review queued",
                description: "Low-confidence scans are ready for review.",
              });
            }}
            className="mt-5 flex w-full items-center gap-3 rounded-xl bg-[#f3f7f0] p-4 text-left text-sm font-semibold"
          >
            <FileText className="text-[#4a9656]" />
            {reviewQueued
              ? "Review queued"
              : "Review low-confidence scans"}{" "}
            <ChevronRight className="ml-auto" size={17} />
          </button>
          <button
            onClick={() => {
              setReportQueued(true);
              localStorage.setItem("ecolearn-report-queued", "true");
              toast({
                title: "Report queued",
                description: "Your impact report is ready to export.",
              });
            }}
            className="mt-5 flex w-full items-center gap-3 rounded-xl bg-[#f3f7f0] p-4 text-left text-sm font-semibold"
          >
            <Download className="text-[#4a9656]" />
            {reportQueued ? "Report queued" : "Export impact report"}
            <ChevronRight className="ml-auto" size={17} />
          </button>
        </div>
      </section>
    </Hub>
  );
}

export function ScannerTools() {
  const [barcode, setBarcode] = useState("");
  const [show, setShow] = useState(false);
  const [queuedBarcode, setQueuedBarcode] = useState(
    () => localStorage.getItem("ecolearn-last-barcode") || "",
  );
  const { toast } = useToast();
  return (
    <Hub
      title="Smart scan tools"
      eyebrow="More ways to identify an item"
      icon={<ScanBarcode />}
    >
      <div className="grid gap-5 md:grid-cols-2">
        <button
          onClick={() => setShow(true)}
          className="rounded-2xl border border-[#dce5d9] bg-white p-6 text-left transition hover:shadow-lg"
        >
          <ScanBarcode className="text-[#3c904c]" />
          <h2 className="mt-4 font-semibold">Barcode lookup</h2>
          <p className="mt-2 text-sm leading-6 text-[#718076]">
            Use your camera or type a UPC to identify packaged products.
          </p>
        </button>
        <button
          onClick={() =>
            toast({
              title: "OCR ready",
              description:
                "Point the scanner at a label to read material and disposal instructions.",
            })
          }
          className="rounded-2xl border border-[#dce5d9] bg-white p-6 text-left transition hover:shadow-lg"
        >
          <QrCode className="text-[#3c904c]" />
          <h2 className="mt-4 font-semibold">Read a label</h2>
          <p className="mt-2 text-sm leading-6 text-[#718076]">
            Extract recycling symbols and manufacturer text with OCR.
          </p>
        </button>
      </div>
      {show && (
        <div className="mt-5 rounded-2xl bg-[#edf7e8] p-5">
          <label className="text-sm font-bold">UPC / barcode number</label>
          <div className="mt-3 flex gap-2">
            <input
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="e.g. 012345678905"
              className="min-w-0 flex-1 rounded-xl border border-[#ccdfc6] bg-white px-4 py-3 outline-none"
            />
            <button
              onClick={() => {
                if (!barcode) {
                  toast({
                    title: "Enter a barcode",
                    description: "Try scanning the code from the package.",
                  });
                  return;
                }

                setQueuedBarcode(barcode);
                localStorage.setItem("ecolearn-last-barcode", barcode);
                toast({
                  title: "Barcode lookup queued",
                  description:
                    "Connect a product database API to return product packaging data.",
                });
              }}
              className="rounded-xl bg-[#173d2a] px-4 text-sm font-bold text-white"
            >
              {queuedBarcode === barcode && barcode ? "Queued" : "Lookup"}
            </button>
          </div>
        </div>
      )}
    </Hub>
  );
}

export function Notifications() {
  const { progress } = useProgress();
  const [read, setRead] = useState(
    () => localStorage.getItem("ecolearn-notifications-read") === "true",
  );
  const rankText = `You’re now in the top ${Math.max(8, 28 - (progress?.total_scans ?? 0) * 2)}% of your city.`;
  return (
    <Hub title="Notifications" eyebrow="Stay in the loop" icon={<BellRing />}>
      <div className="overflow-hidden rounded-2xl border border-[#e0e7dc] bg-white">
        {[
          [
            "Your daily quest is ready",
            "Scan three items correctly to earn 30 XP.",
          ],
          ["You moved up the leaderboard", rankText],
          ["Earth Week is coming", "A new community challenge begins Monday."],
        ].map(([title, detail], i) => (
          <button
            key={title}
            onClick={() => {
              setRead(true);
              localStorage.setItem("ecolearn-notifications-read", "true");
            }}
            className={`flex w-full gap-4 border-b border-[#edf0eb] p-5 text-left last:border-0 ${!read && i === 0 ? "bg-[#f3f9ef]" : ""}`}
          >
            <span className="mt-1 h-2.5 w-2.5 rounded-full bg-[#52a057]" />
            <span>
              <span className="block font-semibold">{title}</span>
              <span className="mt-1 block text-sm text-[#718076]">
                {detail}
              </span>
            </span>
          </button>
        ))}
      </div>
    </Hub>
  );
}

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
function CommunityCard({
  title,
  meta,
  button,
  onClick,
}: {
  title: string;
  meta: string;
  button: string;
  onClick?: () => void;
}) {
  return (
    <section className="rounded-2xl border border-[#e0e7dc] bg-white p-5">
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#e8f4e1] text-[#3c8d4b]">
        <Users />
      </span>
      <h2 className="mt-4 font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-[#748176]">{meta}</p>
      <button
        onClick={onClick}
        className="mt-5 rounded-xl border border-[#d6e3d2] px-4 py-2.5 text-sm font-bold text-[#347b44]"
      >
        {button}
      </button>
    </section>
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
