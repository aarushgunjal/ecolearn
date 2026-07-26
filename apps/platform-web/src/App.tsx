import { useEffect, useState } from "react";
import {
  Bell,
  BookOpen,
  Flame,
  Leaf,
  MoreHorizontal,
  ScanLine,
  Trophy,
  UserRound,
} from "lucide-react";
import Scanner from "./pages/Scanner";
import { AuthProvider } from "./contexts/AuthContext";
import { Toaster } from "@/components/ui/toaster";
import {
  AuthDialog,
  Challenges,
  Home,
  Leaderboard,
  Learn,
  Profile,
} from "@/components/EcoExperience";
import { useAuth } from "@/contexts/AuthContext";
import {
  Admin,
  Community,
  LocalRules,
  Notifications,
  Organization,
  ScannerTools,
  Schools,
} from "@/components/PlatformHubs";
import { useProgress } from "@/hooks/useProgress";
import { AdminReview } from "@/components/AdminReview";

const navigation = [
  { label: "Home", icon: Leaf },
  { label: "Scan", icon: ScanLine },
  { label: "Learn", icon: BookOpen },
  { label: "Challenges", icon: Trophy },
  { label: "Ranks", icon: Trophy },
  { label: "Profile", icon: UserRound },
];

function AppShell() {
  const [active, setActive] = useState("Home");
  const [authOpen, setAuthOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const { user } = useAuth();
  const { progress } = useProgress();

  useEffect(() => {
    const handleOpenNotifications = () => setActive("Notifications");
    const handleOpenLearn = () => setActive("Learn");
    window.addEventListener(
      "ecolearn-open-notifications",
      handleOpenNotifications,
    );
    window.addEventListener("ecolearn-open-learn", handleOpenLearn);
    return () => {
      window.removeEventListener(
        "ecolearn-open-notifications",
        handleOpenNotifications,
      );
      window.removeEventListener("ecolearn-open-learn", handleOpenLearn);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#f7f8f4] text-[#16251e]">
      <header className="sticky top-0 z-30 border-b border-[#e6e9e2]/90 bg-[#f7f8f4]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-5 lg:px-8">
          <button
            className="flex items-center gap-2.5"
            onClick={() => setActive("Home")}
            aria-label="EcoLearn home"
          >
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#173d2a] text-white shadow-lg shadow-[#173d2a]/15">
              <Leaf size={19} fill="currentColor" />
            </span>
            <span className="text-xl font-semibold tracking-[-0.05em]">
              ecolearn
            </span>
          </button>
          <nav
            className="hidden items-center rounded-full border border-[#e5e9e1] bg-white p-1 md:flex"
            aria-label="Main navigation"
          >
            {navigation.slice(0, 5).map(({ label, icon: Icon }) => (
              <button
                key={label}
                onClick={() => setActive(label)}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${active === label ? "bg-[#e8f3df] text-[#173d2a]" : "text-[#66746a] hover:text-[#173d2a]"}`}
              >
                <Icon size={15} />
                {label}
              </button>
            ))}
            <button
              onClick={() => setMoreOpen(!moreOpen)}
              className={`grid h-8 w-8 place-items-center rounded-full ${moreOpen ? "bg-[#e8f3df] text-[#173d2a]" : "text-[#66746a]"}`}
              aria-label="More EcoLearn tools"
            >
              <MoreHorizontal size={18} />
            </button>
          </nav>
          <div className="flex items-center gap-3">
            <button className="hidden items-center gap-1.5 rounded-full bg-[#fff3d5] px-3 py-2 text-sm font-semibold text-[#976700] sm:flex">
              <Flame size={16} fill="currentColor" />{" "}
              {progress?.streak_days ?? 0} day streak
            </button>
            <button
              onClick={() => setActive("Notifications")}
              className="grid h-10 w-10 place-items-center rounded-full bg-white text-[#5f6d63] ring-1 ring-[#e5e9e1]"
              aria-label="Notifications"
            >
              <Bell size={18} />
            </button>
            {user ? (
              <button
                onClick={() => setActive("Profile")}
                className="grid h-10 w-10 place-items-center rounded-full bg-[#d9edcf] text-sm font-bold text-[#245533]"
              >
                {user.email?.slice(0, 2).toUpperCase()}
              </button>
            ) : (
              <button
                onClick={() => setAuthOpen(true)}
                className="rounded-xl bg-[#173d2a] px-4 py-2.5 text-sm font-bold text-white"
              >
                Join free
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 pb-28 pt-8 lg:px-8 lg:pt-12">
        {active === "Home" && <Home />}
        {active === "Scan" && <Scanner />}
        {active === "Learn" && <Learn />}
        {active === "Challenges" && <Challenges />}
        {active === "Ranks" && <Leaderboard />}
        {active === "Profile" &&
          (user ? (
            <Profile />
          ) : (
            <SignInPrompt onSignIn={() => setAuthOpen(true)} />
          ))}
        {active === "Rules" && <LocalRules />}
        {active === "Community" && <Community />}
        {active === "Schools" && <Schools />}
        {active === "Organization" && <Organization />}
        {active === "Admin" && <AdminReview />}
        {active === "Tools" && <ScannerTools />}
        {active === "Notifications" && <Notifications />}
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-[#e5e9e1] bg-white/95 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur md:hidden"
        aria-label="Mobile navigation"
      >
        {navigation.map(({ label, icon: Icon }) => (
          <button
            key={label}
            onClick={() => setActive(label)}
            className={`flex min-w-14 flex-col items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold ${active === label ? "text-[#237342]" : "text-[#77847a]"}`}
          >
            <Icon size={19} />
            {label}
          </button>
        ))}
      </nav>
      {moreOpen && (
        <div className="fixed inset-x-4 top-[84px] z-40 mx-auto grid max-w-xl grid-cols-2 gap-2 rounded-2xl border border-[#dfe6dc] bg-white p-3 shadow-2xl sm:grid-cols-3">
          {[
            ["Admin", "Admin portal"],
            ["Tools", "Scan tools"],
            ["Notifications", "Notifications"],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => {
                setActive(key);
                setMoreOpen(false);
              }}
              className="rounded-xl px-3 py-3 text-left text-sm font-semibold text-[#476151] hover:bg-[#f0f7ed]"
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {authOpen && <AuthDialog close={() => setAuthOpen(false)} />}
    </div>
  );
}

function SignInPrompt({ onSignIn }: { onSignIn: () => void }) {
  return (
    <section className="grid min-h-[55vh] place-items-center rounded-[2rem] border border-[#e4e9df] bg-white p-8 text-center">
      <div className="max-w-md">
        <span className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-[#e7f3df] text-[#237342]">
          <UserRound />
        </span>
        <h1 className="text-3xl font-semibold tracking-[-.05em]">
          Your impact starts here.
        </h1>
        <p className="mt-3 leading-7 text-[#69766d]">
          Create a free account to save scans, earn XP, and join your community.
        </p>
        <button
          onClick={onSignIn}
          className="mt-7 rounded-xl bg-[#173d2a] px-5 py-3 text-sm font-semibold text-white"
        >
          Create free account
        </button>
      </div>
    </section>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
      <Toaster />
    </AuthProvider>
  );
}
