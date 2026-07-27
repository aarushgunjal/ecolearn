import { useEffect, useState } from "react";
import {
  Award,
  BookOpen,
  Check,
  ChevronRight,
  CircleCheck,
  CircleHelp,
  Crown,
  Flame,
  Leaf,
  Lock,
  Play,
  Recycle,
  Save,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  Users,
  X,
  Zap,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAchievements } from "@/hooks/useAchievements";
import { useLessonProgress } from "@/hooks/useLessonProgress";
import { useProgress } from "@/hooks/useProgress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { AdminReview } from "@/components/AdminReview";

const lessons = [
  {
    id: "10000000-0000-4000-8000-000000000001",
    title: "The recycling loop",
    topic: "Recycling basics",
    duration: "4 min",
    xp: 20,
    color: "bg-[#dff2d5]",
    icon: Recycle,
  },
  {
    id: "10000000-0000-4000-8000-000000000002",
    title: "Plastic, decoded",
    topic: "Materials",
    duration: "6 min",
    xp: 30,
    color: "bg-[#dceef4]",
    icon: Leaf,
  },
  {
    id: "10000000-0000-4000-8000-000000000003",
    title: "Wishcycling myths",
    topic: "Smart sorting",
    duration: "5 min",
    xp: 25,
    color: "bg-[#f9ead0]",
    icon: CircleHelp,
  },
  {
    id: "10000000-0000-4000-8000-000000000004",
    title: "Food's second life",
    topic: "Composting",
    duration: "7 min",
    xp: 35,
    color: "bg-[#f0e3d2]",
    icon: Sparkles,
  },
  {
    id: "10000000-0000-4000-8000-000000000005",
    title: "Glass and metal basics",
    topic: "Materials",
    duration: "5 min",
    xp: 25,
    color: "bg-[#e2eef2]",
    icon: Trophy,
  },
  {
    id: "10000000-0000-4000-8000-000000000006",
    title: "Smarter compost habits",
    topic: "Organic waste",
    duration: "6 min",
    xp: 30,
    color: "bg-[#e8f0d8]",
    icon: Leaf,
  },
];
const lessonContent: Record<
  string,
  {
    intro: string;
    facts: { title: string; body: string }[];
    question: string;
    choices: string[];
    answer: number;
    explanation: string;
  }
> = {
  "10000000-0000-4000-8000-000000000001": {
    intro:
      "Recycling is a system, not a wish. When we sort items carefully, materials can become useful things again instead of waste.",
    facts: [
      {
        title: "Start clean",
        body: "Food and liquid can contaminate whole batches of recyclable material. Empty containers and give them a quick rinse.",
      },
      {
        title: "Keep it loose",
        body: "Loose items can be sorted by equipment. Plastic bags wrap around sorting machinery, so take them to a dedicated drop-off.",
      },
      {
        title: "When in doubt, check",
        body: "Rules differ between towns. A material accepted in one program may not be accepted in another.",
      },
    ],
    question: "Which action best helps a recycling facility sort materials?",
    choices: [
      "Put recyclables in a plastic bag",
      "Keep empty items loose in the bin",
      "Recycle every item with a triangle",
    ],
    answer: 1,
    explanation:
      "Correct. Loose, clean, empty items are much easier for a facility to sort.",
  },
  "10000000-0000-4000-8000-000000000002": {
    intro:
      "Plastic numbers identify resin types, but the number alone does not promise that an item belongs in your curbside bin.",
    facts: [
      {
        title: "Shape matters",
        body: "Bottles, jars, and tubs are commonly accepted because there are reliable markets for them.",
      },
      {
        title: "Film is different",
        body: "Bags, wrappers, and film are often recyclable only through store drop-off programs.",
      },
      {
        title: "Caps stay on",
        body: "In many modern programs, caps can stay on bottles. Your local guidance is the final authority.",
      },
    ],
    question: "What is the safest choice for plastic bags and film?",
    choices: [
      "Place them loose in curbside recycling",
      "Use a dedicated store drop-off if available",
      "Put them in with paper",
    ],
    answer: 1,
    explanation:
      "Exactly. Film plastic tangles sorting equipment; use a dedicated film collection program.",
  },
  "10000000-0000-4000-8000-000000000003": {
    intro:
      "Wishcycling happens when good intentions put the wrong item in recycling. It raises costs and can spoil recoverable material.",
    facts: [
      {
        title: "No mystery items",
        body: "If you cannot identify the material or the program does not list it, keep it out of curbside recycling.",
      },
      {
        title: "Grease changes paper",
        body: "Food-soiled cardboard and paper fibers cannot be recycled into clean paper products.",
      },
      {
        title: "Special waste needs special handling",
        body: "Batteries, electronics, and chemicals can be hazardous. Find a dedicated collection point.",
      },
    ],
    question: "Why should a greasy pizza box stay out of paper recycling?",
    choices: [
      "It is too heavy",
      "Grease contaminates the paper fibers",
      "Cardboard is never recyclable",
    ],
    answer: 1,
    explanation:
      "Right. Clean cardboard is valuable; grease makes its fibers unsuitable for recycling.",
  },
  "10000000-0000-4000-8000-000000000004": {
    intro:
      "Food scraps are a resource. Composting returns nutrients to soil and helps keep methane-producing organic waste out of landfill.",
    facts: [
      {
        title: "Compost the right scraps",
        body: "Fruit and vegetable scraps, coffee grounds, and yard trimmings are great starting materials.",
      },
      {
        title: "Balance matters",
        body: "Healthy compost needs moist green material and dry brown material such as leaves or shredded paper.",
      },
      {
        title: "Use local programs",
        body: "If you do not have a backyard bin, a municipal or community program may accept food scraps.",
      },
    ],
    question: "Which is a useful 'brown' material for a compost pile?",
    choices: ["Dry leaves", "A plastic wrapper", "A battery"],
    answer: 0,
    explanation:
      "Yes. Dry leaves add carbon-rich brown material and help balance moist food scraps.",
  },
  "10000000-0000-4000-8000-000000000005": {
    intro:
      "Glass and metal are durable materials, but they still need the right prep before they go into your bin.",
    facts: [
      {
        title: "Rinse first",
        body: "Leftover food or drink can make a clean container unusable, so empty and rinse items before sorting them.",
      },
      {
        title: "Separate hazardous items",
        body: "Broken glass, sharp metal, and pressurized containers may need special handling based on local rules.",
      },
      {
        title: "Check lids and caps",
        body: "Small metal lids are often accepted, but local programs can differ on whether they should stay attached.",
      },
    ],
    question: "What should you do before recycling a food jar or soda can?",
    choices: [
      "Leave food residue inside",
      "Empty and rinse it",
      "Wrap it in a bag",
    ],
    answer: 1,
    explanation:
      "Correct. Empty, clean containers give the recycling system the best chance of success.",
  },
  "10000000-0000-4000-8000-000000000006": {
    intro:
      "Composting works best when you understand what belongs in the pile and what should stay out.",
    facts: [
      {
        title: "Green and brown",
        body: "Moist food scraps are 'green' material, while dry leaves and paper are 'brown' material that add structure and carbon.",
      },
      {
        title: "Avoid contamination",
        body: "Plastic labels, stickers, and compostable-looking packaging can still cause problems if they do not break down properly.",
      },
      {
        title: "Local pickup helps",
        body: "If home composting is not practical, many cities and schools collect food scraps separately.",
      },
    ],
    question: "Which item is usually safe to add to a compost bin?",
    choices: ["Dry leaves", "A battery", "Plastic cutlery"],
    answer: 0,
    explanation:
      "Right. Dry leaves are a classic compost ingredient and help balance food scraps.",
  },
};
const leaderboard = [
  { name: "Maya Chen", xp: 0, initials: "MC", color: "bg-[#f4d2a4]" },
  { name: "Jordan Kim", xp: 0, initials: "JK", color: "bg-[#cde3f5]" },
  { name: "You", xp: 0, initials: "AG", color: "bg-[#d9edcf]" },
  { name: "Noah Williams", xp: 0, initials: "NW", color: "bg-[#ded2f2]" },
];

export function Home() {
  const { progress, addXP } = useProgress();
  const { completedLessonIds } = useLessonProgress();
  const { user } = useAuth();
  const { toast } = useToast();
  const [questClaimed, setQuestClaimed] = useState(
    () => localStorage.getItem("ecolearn-home-quest-claimed") === "true",
  );
  const displayName =
    user?.user_metadata?.full_name?.split(" ")[0] || "Eco learner";
  const weeklyScans = progress?.total_scans ?? 0;
  const avoidedKg = (
    weeklyScans * 0.4 +
    (progress?.total_lessons_completed ?? 0) * 0.25
  ).toFixed(1);
  const weekLift = Math.min(18 + weeklyScans * 2, 99);
  const questProgress = Math.min(progress?.total_scans ?? 0, 3);
  const questComplete = questProgress >= 3;
  const claimQuest = async () => {
    if (!questComplete || questClaimed) return;

    setQuestClaimed(true);
    localStorage.setItem("ecolearn-home-quest-claimed", "true");
    await addXP(15);
    toast({
      title: "+15 XP earned",
      description: "Today’s quest is complete.",
    });
  };
  return (
    <div className="space-y-7 animate-in fade-in duration-500">
      <section className="overflow-hidden rounded-[2rem] bg-[#173d2a] px-6 py-8 text-white shadow-[0_25px_65px_-35px_rgba(18,58,39,.8)] sm:px-9 sm:py-10">
        <div className="relative z-10 max-w-xl">
          <p className="flex items-center gap-2 text-sm font-bold text-[#acd69b]">
            <Sparkles size={16} /> GOOD TO SEE YOU, {displayName.toUpperCase()}
          </p>
          <h1 className="display-serif mt-4 text-4xl leading-[1.05] tracking-[-.05em] sm:text-5xl">
            Small choices.
            <br />
            <em className="text-[#a8da8c]">Real impact.</em>
          </h1>
          <p className="mt-4 max-w-md leading-7 text-white/65">
            You are one sustainable action away from a stronger streak.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Pill
              icon={<Flame size={16} fill="currentColor" />}
              text={`${progress?.streak_days ?? 0} day streak`}
            />
            <Pill
              icon={<Zap size={16} fill="currentColor" />}
              text={`${progress?.xp ?? 0} XP`}
            />
          </div>
        </div>
        <Leaf
          className="absolute right-8 top-32 hidden rotate-[25deg] text-[#88be72]/20 sm:block"
          size={250}
          fill="currentColor"
        />
      </section>
      <div className="grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
        <section className="rounded-[1.5rem] border border-[#e0e7dc] bg-white p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.14em] text-[#6a9d5d]">
                Today’s quest
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-[-.035em]">
                Sort three items correctly
              </h2>
            </div>
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#edf7e8] text-[#3d914d]">
              <Target />
            </span>
          </div>
          <p className="mt-3 text-sm leading-6 text-[#728076]">
            Use the scanner to keep contamination out of your recycling bin.
          </p>
          <div className="mt-5 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#edf0eb]">
              <div
                className="h-full rounded-full bg-[#55a457] transition-all"
                style={{ width: `${(questProgress / 3) * 100}%` }}
              />
            </div>
            <span className="text-xs font-bold text-[#3d914d]">
              {questProgress} / 3
            </span>
          </div>
          <button
            onClick={() => void claimQuest()}
            disabled={!questComplete || questClaimed}
            className="mt-5 flex items-center gap-1 text-sm font-bold text-[#26753f] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {questClaimed
              ? "Quest completed"
              : questComplete
                ? "Claim 15 XP"
                : "Keep scanning"}
            <ChevronRight size={16} />
          </button>
        </section>
        <section className="rounded-[1.5rem] border border-[#e0e7dc] bg-white p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Weekly impact</h2>
            <span className="text-xs font-bold text-[#39804d]">
              +{weekLift}%
            </span>
          </div>
          <div className="mt-6 flex items-end gap-2">
            <span className="text-4xl font-semibold tracking-[-.06em]">
              {avoidedKg}
            </span>
            <span className="mb-1 text-sm text-[#718076]">kg CO₂ avoided</span>
          </div>
          <div className="mt-5 flex h-16 items-end gap-2">
            {[35, 52, 40, 78, 60, 94, 72].map((h, i) => (
              <span
                key={i}
                className={`flex-1 rounded-t-md ${i === 5 ? "bg-[#3d914d]" : "bg-[#dcebd7]"}`}
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
          <p className="mt-2 text-xs text-[#7d8980]">Your actions this week</p>
        </section>
      </div>
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold tracking-[-.04em]">
            Continue learning
          </h2>
          <button
            onClick={() => {
              window.dispatchEvent(new Event("ecolearn-open-learn"));
            }}
            className="text-sm font-bold text-[#307c46]"
          >
            See path
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {lessons.slice(0, 4).map((lesson, index) => (
            <LessonTile
              key={lesson.id}
              lesson={lesson}
              locked={
                index > 0 && !completedLessonIds.includes(lessons[index - 1].id)
              }
              completed={completedLessonIds.includes(lesson.id)}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

export function Learn() {
  const [activeLesson, setActiveLesson] = useState<
    (typeof lessons)[number] | null
  >(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const { refreshProgress } = useProgress();
  const {
    completedLessonIds,
    loading,
    refreshCompletedLessons,
    markLessonsChanged,
  } = useLessonProgress();
  const completeLesson = async (lesson: (typeof lessons)[number]) => {
    if (completedLessonIds.includes(lesson.id)) {
      setActiveLesson(null);
      return;
    }
    if (!user) {
      toast({
        title: "Create an account to save progress",
        description: "Your lesson path and XP will sync across devices.",
      });
      return;
    }
    const { error } = await supabase.rpc("complete_lesson", {
      p_lesson_id: lesson.id,
    });
    if (error) {
      toast({
        title: "Couldn’t save completion",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    await refreshProgress();
    await refreshCompletedLessons();
    markLessonsChanged();
    toast({
      title: `+${lesson.xp} XP earned`,
      description: `${lesson.title} is complete.`,
    });
    setActiveLesson(null);
  };
  if (activeLesson)
    return (
      <LessonPlayer
        lesson={activeLesson}
        onClose={() => setActiveLesson(null)}
        onComplete={() => void completeLesson(activeLesson)}
      />
    );
  const unlocked = (index: number) =>
    index === 0 || completedLessonIds.includes(lessons[index - 1].id);
  const percentage = Math.round(
    (completedLessonIds.length / lessons.length) * 100,
  );
  return (
    <div className="animate-in fade-in duration-500">
      <p className="text-sm font-bold uppercase tracking-[.15em] text-[#438b52]">
        Learn by doing
      </p>
      <h1 className="display-serif mt-2 text-4xl tracking-[-.05em] sm:text-5xl">
        Build your <em className="text-[#4d9b58]">eco instinct.</em>
      </h1>
      <p className="mt-4 max-w-xl leading-7 text-[#718076]">
        Short lessons, meaningful choices, and a quiz that proves you
        understand.
      </p>
      <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_.42fr]">
        <div className="space-y-4">
          {lessons.map((lesson, index) => {
            const Icon = lesson.icon;
            const done = completedLessonIds.includes(lesson.id);
            const isUnlocked = unlocked(index);
            return (
              <button
                key={lesson.id}
                onClick={() => isUnlocked && setActiveLesson(lesson)}
                className={`flex w-full items-center gap-4 rounded-2xl border border-[#e0e7dc] bg-white p-4 text-left transition ${isUnlocked ? "hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#1d5c37]/5" : "cursor-not-allowed opacity-50"}`}
                disabled={!isUnlocked || loading}
              >
                <span
                  className={`grid h-14 w-14 shrink-0 place-items-center rounded-xl ${lesson.color} text-[#286c3d]`}
                >
                  {done ? (
                    <CircleCheck />
                  ) : !isUnlocked ? (
                    <Lock size={20} />
                  ) : (
                    <Icon />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-xs font-bold uppercase tracking-wide text-[#78867b]">
                    {lesson.topic}
                  </span>
                  <span className="mt-1 block font-semibold">
                    {lesson.title}
                  </span>
                  <span className="mt-1 block text-xs text-[#849087]">
                    {lesson.duration} · {lesson.xp} XP · Quiz included
                  </span>
                </span>
                {done ? (
                  <span className="rounded-full bg-[#e5f4df] px-3 py-1 text-xs font-bold text-[#318044]">
                    Review
                  </span>
                ) : isUnlocked ? (
                  <Play size={19} className="text-[#39834b]" />
                ) : null}
              </button>
            );
          })}
        </div>
        <div className="h-fit rounded-[1.5rem] bg-[#f4f8f0] p-6">
          <Award className="text-[#4a9956]" />
          <h2 className="mt-4 text-lg font-semibold">Your learning path</h2>
          <p className="mt-2 text-sm leading-6 text-[#718076]">
            Finish each quiz to unlock the next practical skill.
          </p>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-[#dce8d8]">
            <div
              className="h-full bg-[#55a457] transition-all"
              style={{ width: `${percentage}%` }}
            />
          </div>
          <p className="mt-2 text-xs font-semibold text-[#44854e]">
            {completedLessonIds.length} of {lessons.length} lessons complete
          </p>
        </div>
      </div>
    </div>
  );
}

function LessonPlayer({
  lesson,
  onClose,
  onComplete,
}: {
  lesson: (typeof lessons)[number];
  onClose: () => void;
  onComplete: () => void;
}) {
  const content = lessonContent[lesson.id];
  const [step, setStep] = useState(0);
  const [answer, setAnswer] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const lastContentStep = content.facts.length;
  const isQuiz = step > lastContentStep;
  const correct = answer === content.answer;
  const finish = async () => {
    if (!checked || !correct) {
      toast({
        title: "Answer the question first",
        description: "Pick the correct answer before finishing this lesson.",
      });
      return;
    }

    if (user)
      await supabase.from("quiz_attempts").insert({
        user_id: user.id,
        lesson_id: lesson.id,
        answers: { selected: answer },
        score: 100,
      });
    onComplete();
  };
  return (
    <div className="mx-auto max-w-2xl animate-in fade-in slide-in-from-bottom-3 duration-500">
      <div className="mb-7 flex items-center justify-between">
        <button onClick={onClose} className="text-sm font-bold text-[#4b7855]">
          ← Back to path
        </button>
        <span className="text-sm font-bold text-[#4b8754]">
          {Math.min(step + 1, lastContentStep + 1)} / {lastContentStep + 1}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#dce8d8]">
        <div
          className="h-full bg-[#55a457] transition-all"
          style={{ width: `${((step + 1) / (lastContentStep + 1)) * 100}%` }}
        />
      </div>
      <section className="mt-8 rounded-[1.75rem] border border-[#e0e7dc] bg-white p-7 shadow-[0_20px_50px_-40px_rgba(20,70,40,.5)] sm:p-10">
        {step === 0 && (
          <>
            <p className="text-xs font-bold uppercase tracking-[.14em] text-[#4a9255]">
              {lesson.topic}
            </p>
            <h1 className="display-serif mt-3 text-4xl tracking-[-.05em]">
              {lesson.title}
            </h1>
            <p className="mt-6 text-lg leading-8 text-[#52665a]">
              {content.intro}
            </p>
          </>
        )}
        {step > 0 && !isQuiz && (
          <>
            <p className="text-xs font-bold uppercase tracking-[.14em] text-[#4a9255]">
              Key idea {step}
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-.05em]">
              {content.facts[step - 1].title}
            </h1>
            <p className="mt-6 text-lg leading-8 text-[#52665a]">
              {content.facts[step - 1].body}
            </p>
          </>
        )}
        {isQuiz && (
          <>
            <p className="text-xs font-bold uppercase tracking-[.14em] text-[#4a9255]">
              Knowledge check
            </p>
            <h1 className="mt-3 text-2xl font-semibold tracking-[-.04em]">
              {content.question}
            </h1>
            <div className="mt-6 space-y-3">
              {content.choices.map((choice, index) => (
                <button
                  key={choice}
                  disabled={checked}
                  onClick={() => setAnswer(index)}
                  className={`w-full rounded-xl border p-4 text-left text-sm font-semibold transition ${answer === index ? "border-[#4d9b58] bg-[#edf7e8]" : "border-[#dfe6dc] hover:border-[#9bc99b]"} ${checked && index === content.answer ? "border-[#4d9b58] bg-[#e5f4df]" : ""}`}
                >
                  {choice}
                </button>
              ))}
            </div>
            {checked && (
              <p
                className={`mt-5 rounded-xl p-4 text-sm leading-6 ${correct ? "bg-[#e6f4e0] text-[#347343]" : "bg-[#fff0ed] text-[#a94f43]"}`}
              >
                {correct
                  ? content.explanation
                  : "Not quite. " + content.explanation}
              </p>
            )}
          </>
        )}
      </section>
      <div className="mt-6 flex justify-end">
        {isQuiz ? (
          !checked ? (
            <button
              disabled={answer === null}
              onClick={() => setChecked(true)}
              className="rounded-xl bg-[#173d2a] px-6 py-3 text-sm font-bold text-white disabled:opacity-40"
            >
              Check answer
            </button>
          ) : correct ? (
            <button
              onClick={onComplete}
              className="rounded-xl bg-[#173d2a] px-6 py-3 text-sm font-bold text-white"
            >
              Complete lesson +{lesson.xp} XP
            </button>
          ) : (
            <button
              onClick={() => {
                setChecked(false);
                setAnswer(null);
              }}
              className="rounded-xl bg-[#173d2a] px-6 py-3 text-sm font-bold text-white"
            >
              Try again
            </button>
          )
        ) : (
          <button
            onClick={() => setStep(step + 1)}
            className="rounded-xl bg-[#173d2a] px-6 py-3 text-sm font-bold text-white"
          >
            Continue
          </button>
        )}
      </div>
    </div>
  );
}

export function Challenges() {
  const [claimed, setClaimed] = useState(
    () => localStorage.getItem("ecolearn-weekend-bonus-claimed") === "true",
  );
  const { addXP } = useProgress();
  const { toast } = useToast();
  const claimBonus = async () => {
    if (claimed) return;

    setClaimed(true);
    localStorage.setItem("ecolearn-weekend-bonus-claimed", "true");
    await addXP(40);
    toast({
      title: "+40 XP earned",
      description: "Weekend bonus marked complete.",
    });
  };
  return (
    <div className="animate-in fade-in duration-500">
      <p className="text-sm font-bold uppercase tracking-[.15em] text-[#438b52]">
        Make it a game
      </p>
      <h1 className="display-serif mt-2 text-4xl tracking-[-.05em] sm:text-5xl">
        Quests with <em className="text-[#4d9b58]">purpose.</em>
      </h1>
      <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <Quest
          title="The clean bin"
          description="Scan 3 items and sort them right."
          progress="1 / 3"
          xp="30 XP"
          action="Continue"
        />
        <Quest
          title="Lesson learner"
          description="Finish a materials lesson today."
          progress="0 / 1"
          xp="25 XP"
          action="Start lesson"
        />
        <Quest
          title="Seven-day glow"
          description="Take one eco action for 7 days."
          progress="4 / 7"
          xp="100 XP"
          action="Keep going"
        />
      </div>
      <section className="mt-7 flex flex-col gap-5 rounded-[1.5rem] border border-[#efe1b9] bg-[#fffaf0] p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold text-[#a27012]">WEEKEND BONUS</p>
          <h2 className="mt-1 text-xl font-semibold">Bring a reusable cup</h2>
          <p className="mt-1 text-sm text-[#847657]">
            Mark it complete and earn a limited Earth keeper badge.
          </p>
        </div>
        <button
          onClick={() => void claimBonus()}
          className="rounded-xl bg-[#9a6b11] px-5 py-3 text-sm font-bold text-white"
        >
          {claimed ? "Badge claimed!" : "Claim 40 XP"}
        </button>
      </section>
    </div>
  );
}

export function Leaderboard() {
  const { progress } = useProgress();
  const yourXp = progress?.xp ?? 0;
  const rankedLeaderboard = [
    { ...leaderboard[0], xp: Math.max(yourXp + 1640, yourXp + 400) },
    { ...leaderboard[1], xp: Math.max(yourXp + 1215, yourXp + 250) },
    { ...leaderboard[2], xp: yourXp },
    { ...leaderboard[3], xp: Math.max(yourXp - 135, 0) },
  ].sort((a, b) => b.xp - a.xp);
  return (
    <div className="animate-in fade-in duration-500">
      <p className="text-sm font-bold uppercase tracking-[.15em] text-[#438b52]">
        Community impact
      </p>
      <h1 className="display-serif mt-2 text-4xl tracking-[-.05em] sm:text-5xl">
        Better together.
      </h1>
      <div className="mt-8 max-w-2xl overflow-hidden rounded-[1.5rem] border border-[#e0e7dc] bg-white">
        <div className="flex items-center justify-between border-b border-[#e8ede6] p-5">
          <div>
            <h2 className="font-semibold">New York City</h2>
            <p className="mt-1 text-sm text-[#78857b]">
              This week’s eco champions
            </p>
          </div>
          <Users className="text-[#468d53]" />
        </div>
        {rankedLeaderboard.map((member, index) => (
          <div
            key={member.name}
            className={`flex items-center gap-4 px-5 py-4 ${member.name === "You" ? "bg-[#f1f8ed]" : ""}`}
          >
            <span
              className={`w-5 text-center font-bold ${index < 3 ? "text-[#af7a12]" : "text-[#9aa49d]"}`}
            >
              {index + 1}
            </span>
            <span
              className={`grid h-10 w-10 place-items-center rounded-full text-xs font-bold text-[#24412e] ${member.color}`}
            >
              {member.initials}
            </span>
            <span className="flex-1 font-semibold">{member.name}</span>
            {index === 0 && (
              <Crown size={17} className="text-[#c28b14]" fill="currentColor" />
            )}
            <span className="text-sm font-bold text-[#477e50]">
              {member.xp.toLocaleString()} XP
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Profile() {
  const { user, signOut } = useAuth();
  const { progress } = useProgress();
  const { achievements, userAchievements } = useAchievements();
  const { toast } = useToast();
  const [displayName, setDisplayName] = useState(
    user?.user_metadata?.full_name || user?.user_metadata?.name || "",
  );
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [trainingConsentMode, setTrainingConsentMode] = useState<
    "always_allow" | "ask_every_time"
  >("ask_every_time");
  const [secondOpinionEnabled, setSecondOpinionEnabled] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    if (!user) return;
    let live = true;
    void Promise.all([
      supabase
        .from("user_settings")
        .select(
          "display_name, notifications_enabled, training_consent_mode, ai_second_opinion_enabled",
        )
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase.rpc("is_app_admin"),
    ]).then(([settingsResult, adminResult]) => {
      if (!live) return;
      if (settingsResult.data) {
        setDisplayName(
          settingsResult.data.display_name ||
            user.user_metadata?.full_name ||
            "",
        );
        setNotificationsEnabled(
          settingsResult.data.notifications_enabled ?? true,
        );
        setTrainingConsentMode(
          settingsResult.data.training_consent_mode === "always_allow"
            ? "always_allow"
            : "ask_every_time",
        );
        setSecondOpinionEnabled(
          settingsResult.data.ai_second_opinion_enabled ?? false,
        );
      }
      setIsAdmin(adminResult.data === true);
    });
    return () => {
      live = false;
    };
  }, [user]);

  const saveSettings = async () => {
    if (!user) return;
    setSavingSettings(true);
    try {
      const cleanName = displayName.trim().slice(0, 80);
      const [{ error: settingsError }, { error: authError }] =
        await Promise.all([
          supabase.from("user_settings").upsert({
            user_id: user.id,
            display_name: cleanName || null,
            notifications_enabled: notificationsEnabled,
            training_consent_enabled: trainingConsentMode === "always_allow",
            training_consent_mode: trainingConsentMode,
            ai_second_opinion_enabled: secondOpinionEnabled,
            updated_at: new Date().toISOString(),
          }),
          supabase.auth.updateUser({ data: { full_name: cleanName } }),
        ]);
      if (settingsError || authError) throw settingsError || authError;
      toast({
        title: "Profile updated",
        description: "Your preferences are saved.",
      });
    } catch (error) {
      console.error("Unable to save profile settings", error);
      toast({
        title: "Couldn't save settings",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSavingSettings(false);
    }
  };
  const unlockedAchievements = userAchievements
    .map((entry) => entry.achievements ?? entry.achievement ?? entry)
    .filter(Boolean);
  const earnedCount = unlockedAchievements.length;
  const totalAchievements = achievements.length;
  return (
    <div className="animate-in fade-in duration-500">
      <section className="flex flex-col gap-5 rounded-[1.75rem] bg-[#e8f4e2] p-7 sm:flex-row sm:items-center">
        <span className="grid h-20 w-20 place-items-center rounded-full bg-[#cbe8bc] text-2xl font-bold text-[#255a34]">
          {user?.email?.slice(0, 2).toUpperCase() || "AG"}
        </span>
        <div className="flex-1">
          <p className="text-sm font-semibold text-[#4c8653]">
            Level {progress?.level ?? 1} Eco Explorer
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-[-.05em]">
            {user?.user_metadata?.full_name || user?.email || "Guest explorer"}
          </h1>
          <p className="mt-1 text-sm text-[#66806a]">
            Growing a more circular world, one choice at a time.
          </p>
        </div>
        <button
          onClick={() => void signOut()}
          className="rounded-xl border border-[#bad4b5] bg-white px-4 py-2.5 text-sm font-semibold text-[#3b7145]"
        >
          Sign out
        </button>
      </section>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Metric value={`${progress?.total_scans ?? 0}`} label="Items scanned" />
        <Metric value={`${progress?.xp ?? 0}`} label="Lifetime XP" />
        <Metric value={`${progress?.streak_days ?? 0}`} label="Best streak" />
      </div>
      <section className="mt-7 rounded-[1.5rem] border border-[#e0e7dc] bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Achievements</h2>
          <span className="text-sm text-[#718076]">
            {earnedCount} / {totalAchievements || 12} unlocked
          </span>
        </div>
        <div className="mt-5 flex flex-wrap gap-4">
          {unlockedAchievements
            .slice(0, 3)
            .map(
              (achievement: {
                id?: string;
                achievement_id?: string;
                title?: string;
              }) => (
                <Badge
                  key={
                    achievement.id ||
                    achievement.achievement_id ||
                    achievement.title
                  }
                  icon={<Trophy />}
                  label={achievement.title || "Unlocked"}
                />
              ),
            )}
          {unlockedAchievements.length === 0 ? (
            <>
              <Badge icon={<Recycle />} label="First scan" muted />
              <Badge icon={<Flame />} label="On a roll" muted />
              <Badge icon={<Lock />} label="Planet hero" muted />
            </>
          ) : null}
        </div>
      </section>
      <section className="mt-7 rounded-[1.5rem] border border-[#e0e7dc] bg-white p-6">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#edf7e8] text-[#347e45]">
            <Settings size={19} />
          </span>
          <div>
            <h2 className="font-semibold">Profile & settings</h2>
            <p className="text-sm text-[#718076]">
              Choose how EcoLearn recognizes you.
            </p>
          </div>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <label className="block text-sm font-semibold text-[#405346]">
            Display name
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              maxLength={80}
              placeholder="How should we call you?"
              className="mt-2 w-full rounded-xl border border-[#dce5d9] bg-[#fbfcfa] px-4 py-3 font-normal outline-none focus:border-[#4b9656]"
            />
          </label>
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#e0e7dc] px-4 py-3 text-sm text-[#526257]">
            <input
              type="checkbox"
              checked={notificationsEnabled}
              onChange={(event) =>
                setNotificationsEnabled(event.target.checked)
              }
              className="h-4 w-4 accent-[#347e45]"
            />
            Product updates
          </label>
        </div>
        <p className="mt-3 text-xs leading-5 text-[#7c897f]">
          Your sign-in stays private. Product updates are off until EcoLearn
          sends real account notifications.
        </p>
        <div className="mt-4 space-y-3 border-t border-[#edf1eb] pt-4">
          <div className="rounded-xl bg-[#f6faf3] p-3 text-sm text-[#526257]">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#dcefd5] text-[#347e45]">
                <ShieldCheck size={14} />
              </span>
              <span>
                <b className="block text-[#34523d]">
                  Help train EcoLearn's neural network
                </b>
                <span className="mt-1 block text-xs leading-5">
                  Only eligible hard-scan photos you choose to share are kept
                  privately for review and future classifier training.
                </span>
              </span>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setTrainingConsentMode("always_allow")}
                className={`rounded-xl border p-3 text-left text-xs font-semibold transition ${trainingConsentMode === "always_allow" ? "border-[#4d9958] bg-[#e7f4e1] text-[#286536]" : "border-[#d9e5d5] bg-white text-[#647368]"}`}
              >
                Always allow eligible photos
                <span className="mt-1 block font-normal leading-5">
                  No extra prompt when feedback includes a useful photo.
                </span>
              </button>
              <button
                type="button"
                onClick={() => setTrainingConsentMode("ask_every_time")}
                className={`rounded-xl border p-3 text-left text-xs font-semibold transition ${trainingConsentMode === "ask_every_time" ? "border-[#4d9958] bg-[#e7f4e1] text-[#286536]" : "border-[#d9e5d5] bg-white text-[#647368]"}`}
              >
                Ask me every time
                <span className="mt-1 block font-normal leading-5">
                  You choose for each eligible feedback photo.
                </span>
              </button>
            </div>
          </div>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-[#f6faf3] p-3 text-sm text-[#526257]">
            <input
              type="checkbox"
              checked={secondOpinionEnabled}
              onChange={(event) =>
                setSecondOpinionEnabled(event.target.checked)
              }
              className="mt-0.5 h-4 w-4 shrink-0 accent-[#347e45]"
            />
            <span>
              <b className="block text-[#34523d]">
                Use AI second opinions on uncertain scans
              </b>
              <span className="mt-1 block text-xs leading-5">
                When EcoLearn is unsure, it sends that scan photo to the
                approved AI provider for a second classification. It is not
                stored or used for training by this feature.
              </span>
            </span>
          </label>
        </div>
        <button
          onClick={() => void saveSettings()}
          disabled={savingSettings}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#173d2a] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          <Save size={16} /> {savingSettings ? "Saving…" : "Save settings"}
        </button>
      </section>
      {isAdmin && (
        <section className="mt-7">
          <div className="mb-4 flex items-center gap-2 text-[#2d7040]">
            <ShieldCheck size={19} />
            <h2 className="font-semibold">Admin review</h2>
          </div>
          <AdminReview />
        </section>
      )}
    </div>
  );
}

export function AuthDialog({ close }: { close: () => void }) {
  const { signIn, signUp, signInWithGoogle } = useAuth();
  const { toast } = useToast();
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } =
      mode === "signin"
        ? await signIn(email, password, remember)
        : await signUp(email, password, remember);
    if (!error) {
      toast({
        title: mode === "signin" ? "Welcome back" : "Check your inbox",
        description:
          mode === "signin"
            ? "You’re signed in."
            : "Confirm your email to finish setting up.",
      });
      if (mode === "signin") close();
    }
  };
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#102b1d]/45 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-[1.75rem] bg-white p-7 shadow-2xl">
        <button
          onClick={close}
          className="absolute right-5 top-5 text-[#7a877d]"
        >
          <X />
        </button>
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#e4f2dd] text-[#2b733e]">
          <Leaf fill="currentColor" />
        </span>
        <h2 className="mt-5 text-2xl font-semibold tracking-[-.04em]">
          {mode === "signup" ? "Start your eco journey" : "Welcome back"}
        </h2>
        <p className="mt-2 text-sm leading-6 text-[#718076]">
          Track actions, build habits, and make a measurable difference.
        </p>
        <button
          onClick={() => void signInWithGoogle(remember)}
          className="mt-6 flex w-full items-center justify-center gap-3 rounded-xl border border-[#dce3d9] py-3 text-sm font-semibold"
        >
          <GoogleMark /> Continue with Google
        </button>
        <div className="my-5 flex items-center gap-3 text-xs text-[#99a299]">
          <span className="h-px flex-1 bg-[#e8ece6]" />
          OR WITH EMAIL
          <span className="h-px flex-1 bg-[#e8ece6]" />
        </div>
        <form onSubmit={submit} className="space-y-3">
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            className="w-full rounded-xl border border-[#dce3d9] px-4 py-3 outline-none focus:border-[#4c9856]"
          />
          <label className="flex items-center gap-2 px-1 text-sm text-[#65756a]">
            <input
              type="checkbox"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
            />{" "}
            Remember me on this device
          </label>
          <input
            required
            minLength={6}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full rounded-xl border border-[#dce3d9] px-4 py-3 outline-none focus:border-[#4c9856]"
          />
          <button className="w-full rounded-xl bg-[#173d2a] py-3.5 text-sm font-bold text-white">
            {mode === "signup" ? "Create free account" : "Sign in"}
          </button>
        </form>
        <p className="mt-5 text-center text-sm text-[#748176]">
          {mode === "signup" ? "Already a member?" : "New to EcoLearn?"}{" "}
          <button
            onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
            className="font-bold text-[#287640]"
          >
            {mode === "signup" ? "Sign in" : "Create an account"}
          </button>
        </p>
      </div>
    </div>
  );
}

function LessonTile({
  lesson,
  locked,
  completed,
}: {
  lesson: (typeof lessons)[number];
  locked: boolean;
  completed?: boolean;
}) {
  const Icon = lesson.icon;
  return (
    <button
      className={`rounded-2xl border border-[#e0e7dc] bg-white p-4 text-left transition hover:-translate-y-0.5 hover:shadow-lg ${locked ? "opacity-60" : ""}`}
    >
      <div
        className={`grid h-11 w-11 place-items-center rounded-xl ${lesson.color} text-[#367b45]`}
      >
        {completed ? <CircleCheck size={18} /> : <Icon size={20} />}
      </div>
      <p className="mt-4 text-xs font-bold uppercase tracking-wide text-[#77857a]">
        {lesson.topic}
      </p>
      <p className="mt-1 font-semibold leading-5">{lesson.title}</p>
      <p className="mt-2 text-xs text-[#7b877e]">
        {lesson.duration} · {lesson.xp} XP
      </p>
    </button>
  );
}
function Quest({
  title,
  description,
  progress,
  xp,
  action,
}: {
  title: string;
  description: string;
  progress: string;
  xp: string;
  action: string;
}) {
  const storageKey = `ecolearn-quest-${title}`;
  const [done, setDone] = useState(
    () => localStorage.getItem(storageKey) === "true",
  );
  return (
    <section className="rounded-[1.5rem] border border-[#e0e7dc] bg-white p-6">
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#e6f3df] text-[#3a8a4b]">
        <Target />
      </span>
      <h2 className="mt-5 text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-[#748176]">{description}</p>
      <div className="mt-5 flex items-center justify-between text-xs font-bold">
        <span className="text-[#4a8e55]">{done ? "Complete" : progress}</span>
        <span className="rounded-full bg-[#fff3d7] px-2 py-1 text-[#996b08]">
          {xp}
        </span>
      </div>
      <button
        onClick={() => {
          setDone(true);
          localStorage.setItem(storageKey, "true");
        }}
        className="mt-5 w-full rounded-xl bg-[#173d2a] py-3 text-sm font-bold text-white"
      >
        {done ? "Completed!" : action}
      </button>
    </section>
  );
}
function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-[#e0e7dc] bg-white p-5">
      <p className="text-3xl font-semibold tracking-[-.06em] text-[#1d482c]">
        {value}
      </p>
      <p className="mt-1 text-sm text-[#748176]">{label}</p>
    </div>
  );
}
function Badge({
  icon,
  label,
  muted = false,
}: {
  icon: React.ReactNode;
  label: string;
  muted?: boolean;
}) {
  return (
    <div
      className={`grid h-24 w-24 place-items-center rounded-2xl text-center ${muted ? "bg-[#f2f4f0] text-[#a6aea5]" : "bg-[#edf7e8] text-[#3c8a4b]"}`}
    >
      <span>{icon}</span>
      <span className="text-xs font-bold">{label}</span>
    </div>
  );
}
function Pill({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <span className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-sm font-semibold text-white">
      {icon}
      {text}
    </span>
  );
}
function GoogleMark() {
  return (
    <span className="grid h-5 w-5 place-items-center rounded-full bg-[#4285f4] text-xs font-bold text-white">
      G
    </span>
  );
}
