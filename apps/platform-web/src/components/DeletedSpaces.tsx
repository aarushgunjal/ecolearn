import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Space = {
  id: string;
  scope: "community" | "classroom";
  name: string;
  delete_after: string;
};
export function DeletedSpaces({
  revision,
  onRestored,
}: {
  revision: unknown;
  onRestored: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const r = await supabase.rpc("ecolearn_get_deleted_spaces");
      if (r.error) throw r.error;
      setSpaces(r.data as Space[]);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not load deleted spaces.",
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (open) void load();
  }, [open, revision, load]);
  const restore = async (space: Space) => {
    setBusy(space.id);
    setError("");
    try {
      const r = await supabase.rpc("ecolearn_restore_space", {
        p_scope: space.scope,
        p_scope_id: space.id,
      });
      if (r.error) throw r.error;
      await onRestored();
      await load();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not restore this space.",
      );
    } finally {
      setBusy(null);
    }
  };
  return (
    <details
      onToggle={(e) => setOpen(e.currentTarget.open)}
      className="my-5 rounded-2xl border border-[#dde6da] bg-white p-5"
    >
      <summary className="cursor-pointer font-semibold">
        Recently deleted
      </summary>
      <p className="my-3 text-sm text-[#58675d]">
        Restore spaces within seven days. A restored community includes its
        classrooms, memberships, assignments, and content. Classrooms deleted
        separately keep their own recovery period.
      </p>
      {error && (
        <p role="alert" className="my-3 text-sm text-red-700">
          {error}{" "}
          <button onClick={() => void load()} className="underline">
            Retry
          </button>
        </p>
      )}
      {loading ? (
        <p role="status">Loading deleted spaces...</p>
      ) : spaces.length === 0 && !error ? (
        <p className="text-sm text-[#58675d]">No spaces awaiting deletion.</p>
      ) : (
        <ul className="space-y-3">
          {spaces.map((space) => (
            <li
              key={space.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#f4f8f1] p-4"
            >
              <div>
                <h3 className="font-semibold">{space.name}</h3>
                <p className="text-xs text-[#58675d]">
                  {space.scope} · Recover before{" "}
                  {new Date(space.delete_after).toLocaleString()}
                </p>
              </div>
              <button
                disabled={busy !== null}
                onClick={() => void restore(space)}
                className="rounded-xl border border-[#cfe0ca] bg-white px-4 py-3 text-sm font-semibold text-[#24633a] disabled:opacity-50"
              >
                {busy === space.id ? "Restoring..." : `Restore ${space.name}`}
              </button>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}
