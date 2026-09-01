import { useCallback, useEffect, useState } from "react";
import {
  Bell,
  BookOpen,
  Flame,
  Leaf,
  MapPinned,
  MoreHorizontal,
  ScanLine,
  UsersRound,
  UserRound,
} from "lucide-react";
import Scanner from "./pages/Scanner";
import { Legal } from "./pages/Legal";
import { AuthProvider } from "./contexts/AuthContext";
import { Toaster } from "@/components/ui/toaster";
import {
  AuthDialog,
  Challenges,
  Home,
  Learn,
  Profile,
} from "@/components/EcoExperience";
import {
  Admin,
  Community,
  LocalRules,
  Notifications,
  Organization,
  ScannerTools,
  Schools,
} from "@/components/PlatformHubs";
import { MapHub } from "@/components/MapHub";
import { useAuth } from "@/contexts/AuthContext";
import { useAdmin } from "@/hooks/useAdmin";
import { useProgress } from "@/hooks/useProgress";

const navigation = [
  { label: "Home", icon: Leaf },
  { label: "Scan", icon: ScanLine },
  { label: "Map", icon: MapPinned },
  { label: "Learn", icon: BookOpen },
  { label: "Community", icon: UsersRound },
] as const;

const paths = {
  Home: "/",
  Scan: "/scan",
  Map: "/map",
  Learn: "/learn",
  Challenges: "/challenges",
  Profile: "/profile",
  Rules: "/delaware-rules",
  Community: "/community",
  Schools: "/schools",
  Organization: "/organizations",
  Admin: "/admin",
  Tools: "/scan-tools",
  Notifications: "/notifications",
} as const;

type Section = keyof typeof paths;
type LegalPage = "privacy" | "terms" | "delete-account" | "support" | "licenses";

const activeForPath = (path: string): Section =>
  (Object.entries(paths).find(([, value]) => value === path)?.[0] as Section | undefined) ??
  "Home";

const readLegalPage = (): LegalPage | null => {
  const hash = window.location.hash.replace("#", "").toLowerCase();
  if (hash === "privacy" || hash === "terms" || hash === "delete-account" || hash === "support" || hash === "licenses") return hash;
  const path = window.location.pathname.toLowerCase();
  if (path === "/privacy" || path === "/terms" || path === "/delete-account" || path === "/support" || path === "/licenses") {
    return path.slice(1) as LegalPage;
  }
  return null;
};

function AppShell() {
  const [active, setActive] = useState<Section>(() => activeForPath(window.location.pathname));
  const [legalPage, setLegalPage] = useState<LegalPage | null>(() => readLegalPage());
  const [authOpen, setAuthOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const { user, recoveringPassword } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const { progress } = useProgress();

  const navigate = useCallback((next: Section, replace = false) => {
    setActive(next);
    setLegalPage(null);
    setMoreOpen(false);
    const path = paths[next];
    if (window.location.pathname !== path || window.location.hash) {
      window.history[replace ? "replaceState" : "pushState"]({}, "", path);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  useEffect(() => {
    const handleOpenNotifications = () => navigate("Notifications");
    const handleOpenLearn = () => navigate("Learn");
    const handleOpenAuth = () => setAuthOpen(true);
    const handleHistoryChange = () => {
      setLegalPage(readLegalPage());
      setActive(activeForPath(window.location.pathname));
      setMoreOpen(false);
    };
    window.addEventListener("ecolearn-open-notifications", handleOpenNotifications);
    window.addEventListener("ecolearn-open-learn", handleOpenLearn);
    window.addEventListener("ecolearn-open-auth", handleOpenAuth);
    window.addEventListener("hashchange", handleHistoryChange);
    window.addEventListener("popstate", handleHistoryChange);
    return () => {
      window.removeEventListener("ecolearn-open-notifications", handleOpenNotifications);
      window.removeEventListener("ecolearn-open-learn", handleOpenLearn);
      window.removeEventListener("ecolearn-open-auth", handleOpenAuth);
      window.removeEventListener("hashchange", handleHistoryChange);
      window.removeEventListener("popstate", handleHistoryChange);
    };
  }, [navigate]);

  useEffect(() => {
    const legalTitles: Record<LegalPage, string> = {
      privacy: "Privacy",
      terms: "Terms",
      "delete-account": "Account deletion",
      support: "Support",
      licenses: "Open source licenses",
    };
    const title = legalPage ? legalTitles[legalPage] : active;
    document.title = title === "Home" ? "EcoLearn Delaware" : `${title} · EcoLearn Delaware`;
  }, [active, legalPage]);

  const openLegal = (page: LegalPage) => {
    window.history.pushState({}, "", `/${page}`);
    setLegalPage(page);
    setMoreOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (legalPage) return <Legal page={legalPage} onBack={() => navigate("Home")} />;

  return (
    <div className="min-h-screen bg-[#f7f8f4] text-[#16251e]">
      <header className="sticky top-0 z-30 border-b border-[#e6e9e2]/90 bg-[#f7f8f4]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-5 lg:px-8">
          <button className="flex items-center gap-2.5" onClick={() => navigate("Home")} aria-label="EcoLearn home">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#173d2a] text-white shadow-lg shadow-[#173d2a]/15">
              <Leaf size={19} fill="currentColor" />
            </span>
            <span className="text-xl font-semibold tracking-[-0.05em]">ecolearn</span>
          </button>
          <nav className="hidden items-center rounded-full border border-[#e5e9e1] bg-white p-1 lg:flex" aria-label="Main navigation">
            {navigation.slice(0, 5).map(({ label, icon: Icon }) => (
              <button
                key={label}
                onClick={() => navigate(label)}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${active === label ? "bg-[#e8f3df] text-[#173d2a]" : "text-[#66746a] hover:text-[#173d2a]"}`}
              >
                <Icon size={15} />
                {label}
              </button>
            ))}
            <button
              onClick={() => setMoreOpen((open) => !open)}
              className={`grid h-8 w-8 place-items-center rounded-full ${moreOpen ? "bg-[#e8f3df] text-[#173d2a]" : "text-[#66746a]"}`}
              aria-label="More EcoLearn tools"
              aria-expanded={moreOpen}
            >
              <MoreHorizontal size={18} />
            </button>
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <button className="hidden items-center gap-1.5 rounded-full bg-[#fff3d5] px-3 py-2 text-sm font-semibold text-[#976700] sm:flex">
              <Flame size={16} fill="currentColor" /> {progress?.streak_days ?? 0} day streak
            </button>
            <button
              onClick={() => navigate("Notifications")}
              className="grid h-10 w-10 place-items-center rounded-full bg-white text-[#5f6d63] ring-1 ring-[#e5e9e1]"
              aria-label="Notifications"
            >
              <Bell size={18} />
            </button>
            <button
              onClick={() => setMoreOpen((open) => !open)}
              className="grid h-10 w-10 place-items-center rounded-full bg-white text-[#5f6d63] ring-1 ring-[#e5e9e1] lg:hidden"
              aria-label="More EcoLearn tools"
              aria-expanded={moreOpen}
            >
              <MoreHorizontal size={18} />
            </button>
            {user ? (
              <button onClick={() => navigate("Profile")} className="grid h-10 w-10 place-items-center rounded-full bg-[#d9edcf] text-sm font-bold text-[#245533]" aria-label="Profile">
                {user.email?.slice(0, 2).toUpperCase()}
              </button>
            ) : (
              <button onClick={() => setAuthOpen(true)} className="rounded-xl bg-[#173d2a] px-4 py-2.5 text-sm font-bold text-white">
                Join free
              </button>
            )}
          </div>
        </div>
      </header>

      {moreOpen && (
        <div className="fixed inset-x-4 top-[84px] z-40 mx-auto grid max-w-xl grid-cols-2 gap-2 rounded-2xl border border-[#dfe6dc] bg-white p-3 shadow-2xl sm:grid-cols-3">
          {([
            ["Challenges", "Challenges"],
            ["Rules", "Local rules"],
            ["Schools", "Schools"],
            ["Profile", "Profile"],
            ["Organization", "Organizations"],
            ...(isAdmin ? [["Admin", "Admin portal"]] : []),
            ["Tools", "Scan tools"],
            ["Notifications", "Notifications"],
          ] as [Section, string][]).map(([key, label]) => (
            <button key={key} onClick={() => navigate(key)} className="rounded-xl px-3 py-3 text-left text-sm font-semibold text-[#476151] hover:bg-[#f0f7ed]">
              {label}
            </button>
          ))}
        </div>
      )}

      <main className="mx-auto max-w-7xl px-5 pb-28 pt-8 lg:px-8 lg:pt-12">
        {active === "Home" && <Home />}
        {active === "Scan" && <Scanner />}
        {active === "Map" && <MapHub />}
        {active === "Learn" && <Learn />}
        {active === "Challenges" && <Challenges />}
        {active === "Profile" && (user ? <Profile /> : <SignInPrompt onSignIn={() => setAuthOpen(true)} />)}
        {active === "Rules" && <LocalRules />}
        {active === "Community" && <Community />}
        {active === "Schools" && <Schools />}
        {active === "Organization" && <Organization />}
        {active === "Admin" && (adminLoading ? <LoadingSection /> : isAdmin ? <Admin /> : <RestrictedSection signedIn={Boolean(user)} onSignIn={() => setAuthOpen(true)} />)}
        {active === "Tools" && <ScannerTools />}
        {active === "Notifications" && <Notifications />}
      </main>

      <footer className="mx-auto flex max-w-7xl flex-col gap-3 border-t border-[#e2e8de] px-5 py-7 text-sm text-[#58675d] sm:flex-row sm:items-center sm:justify-between lg:px-8">
        <p>© {new Date().getFullYear()} EcoLearn. Small choices, real impact.</p>
        <div className="flex gap-5 font-semibold">
          <a href="/privacy" onClick={(event) => { event.preventDefault(); openLegal("privacy"); }} className="hover:text-[#286b3a]">Privacy Policy</a>
          <a href="/terms" onClick={(event) => { event.preventDefault(); openLegal("terms"); }} className="hover:text-[#286b3a]">Terms of Service</a>
          <a href="/delete-account" onClick={(event) => { event.preventDefault(); openLegal("delete-account"); }} className="hover:text-[#286b3a]">Delete account</a>
          <a href="/support" onClick={(event) => { event.preventDefault(); openLegal("support"); }} className="hover:text-[#286b3a]">Support</a>
          <a href="/licenses" onClick={(event) => { event.preventDefault(); openLegal("licenses"); }} className="hover:text-[#286b3a]">Licenses</a>
        </div>
      </footer>

      <nav className="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-[#e5e9e1] bg-white/95 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur lg:hidden" aria-label="Mobile navigation">
        {navigation.map(({ label, icon: Icon }) => (
          <button key={label} onClick={() => navigate(label)} className={`flex min-w-14 flex-col items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold ${active === label ? "text-[#237342]" : "text-[#56645a]"}`}>
            <Icon size={19} />
            {label}
          </button>
        ))}
      </nav>
      {(authOpen || recoveringPassword) && <AuthDialog close={() => setAuthOpen(false)} />}
    </div>
  );
}

function SignInPrompt({ onSignIn }: { onSignIn: () => void }) {
  return (
    <section className="grid min-h-[55vh] place-items-center rounded-[2rem] border border-[#e4e9df] bg-white p-8 text-center">
      <div className="max-w-md">
        <span className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-[#e7f3df] text-[#237342]"><UserRound /></span>
        <h1 className="text-3xl font-semibold tracking-[-.05em]">Your impact starts here.</h1>
        <p className="mt-3 leading-7 text-[#69766d]">Create a free account to save scans, earn XP, and join your community.</p>
        <button onClick={onSignIn} className="mt-7 rounded-xl bg-[#173d2a] px-5 py-3 text-sm font-semibold text-white">Create free account</button>
      </div>
    </section>
  );
}

function RestrictedSection({ signedIn, onSignIn }: { signedIn: boolean; onSignIn: () => void }) {
  return (
    <section className="grid min-h-[45vh] place-items-center rounded-[2rem] border border-[#e4e9df] bg-white p-8 text-center">
      <div className="max-w-md">
        <h1 className="text-3xl font-semibold tracking-[-.05em]">Admin access required.</h1>
        <p className="mt-3 leading-7 text-[#69766d]">This area is limited to designated EcoLearn reviewers.</p>
        {!signedIn && <button onClick={onSignIn} className="mt-7 rounded-xl bg-[#173d2a] px-5 py-3 text-sm font-semibold text-white">Sign in</button>}
      </div>
    </section>
  );
}

function LoadingSection() {
  return <section className="grid min-h-[45vh] place-items-center text-sm font-semibold text-[#69766d]">Checking access…</section>;
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
      <Toaster />
    </AuthProvider>
  );
}
