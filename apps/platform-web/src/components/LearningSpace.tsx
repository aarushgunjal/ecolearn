import { useEffect, useState, useSyncExternalStore } from "react";
import {
  createActivityScopeStore,
  type ActivityScope,
} from "../../../../packages/learning/activity-scope";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// eslint-disable-next-line react-refresh/only-export-components -- shared context for mounted learning screens.
export const learningSpace = createActivityScopeStore();
export function LearningSpace() {
  const { user } = useAuth();
  const selected = useSyncExternalStore(
    learningSpace.subscribe,
    learningSpace.get,
  );
  const [spaces, setSpaces] = useState<NonNullable<ActivityScope>[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    if (!user) return;
    void supabase.rpc("ecolearn_get_hub").then(({ data, error }) => {
      if (!live) return;
      if (error) {
        setError(
          "Learning spaces could not load. Retry before earning community XP.",
        );
        return;
      }
      const hub = data as {
        communities?: { id: string; name: string; role: string }[];
        classrooms?: {
          id: string;
          name: string;
          school_name: string;
          role: string;
        }[];
      };
      const next: NonNullable<ActivityScope>[] = [
        ...(hub?.communities ?? [])
          .filter((c) => c.role !== "admin")
          .map((c) => ({
            scope: "community" as const,
            id: c.id,
            name: c.name,
          })),
        ...(hub?.classrooms ?? [])
          .filter((c) => c.role === "student")
          .map((c) => ({
            scope: "classroom" as const,
            id: c.id,
            name: `${c.school_name} / ${c.name}`,
          })),
      ];
      setSpaces(next);
      if (
        learningSpace.get() &&
        !next.some((s) => s.id === learningSpace.get()?.id)
      )
        learningSpace.set(null);
      const assignedClassroom = new URLSearchParams(window.location.search).get(
        "classroom",
      );
      if (assignedClassroom) {
        const classroom = next.find(
          (s) => s.scope === "classroom" && s.id === assignedClassroom,
        );
        learningSpace.set(classroom ?? null);
        if (!classroom)
          setError(
            "This classroom is unavailable. Activity will count toward personal learning.",
          );
      }
    });
    return () => {
      live = false;
    };
  }, [user]);
  if (!user) return null;
  return (
    <section
      className="mb-5 rounded-xl border border-[#dce5d9] bg-white p-4"
      aria-label="Learning space"
    >
      <label className="flex flex-wrap items-center gap-3 text-sm font-semibold">
        Learning for
        <select
          aria-label="Learning space"
          className="min-h-11 max-w-full rounded-lg border bg-white px-3"
          value={selected?.id ?? ""}
          onChange={(e) =>
            learningSpace.set(
              spaces.find((s) => s.id === e.target.value) ?? null,
            )
          }
        >
          <option value="">Personal learning</option>
          {spaces.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <p className="mt-2 text-xs text-[#58675d]">
        {selected
          ? "New XP counts here and in your personal total. Classroom XP also counts toward its school."
          : "Personal XP stays with you. Choose a space to contribute new activity to it."}
      </p>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {error}{" "}
          <button
            onClick={() => window.location.reload()}
            className="underline"
          >
            Retry
          </button>
        </p>
      )}
    </section>
  );
}
