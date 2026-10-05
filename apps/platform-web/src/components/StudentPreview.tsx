import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { StudentPreviewData } from "../../../../packages/learning/student-preview";
export function StudentPreview({
  classroomId,
  onClose,
}: {
  classroomId: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<StudentPreviewData | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    void supabase
      .rpc("ecolearn_preview_classroom", { p_classroom_id: classroomId })
      .then((r) => {
        if (!live) return;
        if (r.error) setError(r.error.message);
        else setData(r.data as StudentPreviewData);
      });
    return () => {
      live = false;
    };
  }, [classroomId]);
  return (
    <section aria-label="Student preview" className="space-y-5">
      <div className="rounded-xl border border-[#b8d9af] bg-[#edf7e8] p-5">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-semibold">Student preview</h2>
          <button className="min-h-11 underline" onClick={onClose}>
            Exit preview
          </button>
        </div>
        <p className="text-sm">
          See the class content a student can access. Actions are read-only; no
          student is impersonated and no XP or progress is recorded.
        </p>
      </div>
      {error && <p role="alert">{error}</p>}
      {!data && !error && <p role="status">Loading classroom preview…</p>}
      {data && (
        <>
          <header>
            <p className="text-sm">
              {data.school} · {data.grade}
            </p>
            <h2 className="mt-2 text-3xl font-semibold">{data.name}</h2>
          </header>
          <section className="rounded-2xl border bg-white p-5">
            <h3 className="text-lg font-semibold">Your assignments</h3>
            {data.assignments.length === 0 && (
              <p className="mt-3">No assignments yet.</p>
            )}
            {data.assignments.map((a) => (
              <article key={a.id} className="mt-3 rounded-xl border p-4">
                <h4 className="font-semibold">{a.title}</h4>
                <p className="text-sm">
                  {a.lesson_title}
                  {a.due_at
                    ? ` · Due ${new Date(a.due_at).toLocaleString()}`
                    : ""}
                </p>
                <span className="mt-3 inline-block text-sm text-[#58675d]">
                  Students can open this lesson and submit their own answer.
                </span>
              </article>
            ))}
          </section>
          <section className="rounded-2xl border bg-white p-5">
            <h3 className="text-lg font-semibold">Announcements</h3>
            {data.announcements.length === 0 && (
              <p className="mt-3">No announcements yet.</p>
            )}
            {data.announcements.map((a) => (
              <article key={a.id} className="mt-3 rounded-xl bg-[#f4f8f1] p-4">
                <h4 className="font-semibold">{a.title}</h4>
                <p className="mt-2 whitespace-pre-wrap">{a.body}</p>
              </article>
            ))}
          </section>
          <section className="rounded-2xl border bg-white p-5">
            <h3 className="text-lg font-semibold">Community events</h3>
            {data.events.length === 0 && (
              <p className="mt-3">No upcoming events.</p>
            )}
            {data.events.map((e) => (
              <article key={e.id} className="mt-3 rounded-xl border p-4">
                <h4 className="font-semibold">{e.title}</h4>
                <p>{e.description}</p>
                <p className="text-sm">
                  {new Date(e.starts_at).toLocaleString()} · {e.location}
                </p>
              </article>
            ))}
          </section>
        </>
      )}
    </section>
  );
}
