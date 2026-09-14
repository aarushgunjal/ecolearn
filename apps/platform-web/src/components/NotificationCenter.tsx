import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

type Notice = { id: string; title: string; body: string; created_at: string; read_at: string | null; target_path: string };
type Preferences = { email_enabled: boolean; push_enabled: boolean; streak_reminders: boolean; learning_updates: boolean; community_updates: boolean; timezone: string; reminder_hour: number };
const defaults: Preferences = { email_enabled: false, push_enabled: false, streak_reminders: true, learning_updates: true, community_updates: true, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, reminder_hour: 18 };
const input = "rounded-xl border border-[#dce5d9] bg-white p-3";
export function NotificationCenter() {
  const { user } = useAuth();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [preferences, setPreferences] = useState(defaults);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    if (!user) { setNotices([]); setLoading(false); return; }
    const [inbox, settings] = await Promise.all([
      supabase.from("notifications").select("id,title,body,created_at,read_at,target_path").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100),
      supabase.from("ecolearn_notification_preferences").select("*").eq("user_id", user.id).maybeSingle(),
    ]);
    setError(inbox.error?.message || settings.error?.message || "");
    setReady(!settings.error);
    if (!inbox.error) setNotices((inbox.data ?? []) as Notice[]);
    if (!settings.error) setPreferences(settings.data ? settings.data as Preferences : defaults);
    setLoading(false);
  }, [user]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!user) return;
    const poll = window.setInterval(() => { if (document.visibilityState === "visible") void refreshInbox(); }, 60000);
    async function refreshInbox() {
      const { data, error: problem } = await supabase.from("notifications").select("id,title,body,created_at,read_at,target_path").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(100);
      if (!problem) setNotices((data ?? []) as Notice[]);
    }
    return () => window.clearInterval(poll);
  }, [user]);
  const mark = async (id: string | null) => {
    setBusy(true);
    const { error: problem } = await supabase.rpc("ecolearn_mark_notifications_read", { p_id: id });
    setError(problem?.message ?? "");
    if (!problem) setNotices((items) => items.map((item) => !id || item.id === id ? { ...item, read_at: new Date().toISOString() } : item));
    setBusy(false);
  };
  const save = async () => {
    setBusy(true); setMessage("");
    const p = preferences;
    const { error: problem } = await supabase.rpc("ecolearn_set_notification_preferences", { p_email: p.email_enabled, p_push: p.push_enabled, p_streak: p.streak_reminders, p_learning: p.learning_updates, p_community: p.community_updates, p_timezone: p.timezone, p_hour: p.reminder_hour });
    setError(problem?.message ?? "");
    if (!problem) setMessage("Notification preferences saved.");
    setBusy(false);
  };
  return <div><h1 className="display-serif text-4xl">Notifications</h1>
    {!user ? <section className="mt-6 rounded-2xl border bg-white p-6"><p>Sign in to see your classroom and community updates.</p><button className={`${input} mt-4`} onClick={() => window.dispatchEvent(new Event("ecolearn-open-auth"))}>Sign in or create an account</button></section> : <>
      {error && <p role="alert" className="my-4 rounded-xl bg-red-50 p-4">{error} <button onClick={() => void load()}>Retry</button></p>}
      {message && <p role="status" className="my-4">{message}</p>}
      <section className="mt-6 rounded-2xl border bg-white p-5">
        <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-semibold">Your inbox</h2><button disabled={busy || !notices.some((n) => !n.read_at)} className={input} onClick={() => void mark(null)}>Mark all read</button></div>
        {loading ? <p className="mt-4">Loading notifications…</p> : notices.length === 0 ? <p className="mt-4">You’re all caught up. New assignments, announcements, events, and reminders will appear here.</p> : notices.map((n) => <article key={n.id} className={`mt-4 rounded-xl border p-4 ${n.read_at ? "" : "bg-[#f0f8ec]"}`}>
          <h3 className="font-semibold">{n.title}</h3><p className="mt-1">{n.body}</p><p className="my-2 text-xs text-[#718076]">{new Date(n.created_at).toLocaleString()}</p>
          <a className="mr-4 underline" href={["/learn", "/schools", "/community", "/notifications"].includes(n.target_path) ? n.target_path : "/notifications"}>Open update</a>
          {!n.read_at && <button disabled={busy} className="underline" onClick={() => void mark(n.id)}>Mark read</button>}
        </article>)}
      </section>
      <section className="mt-6 rounded-2xl border bg-white p-5"><h2 className="text-xl font-semibold">Notification preferences</h2>
        <p className="my-3 text-sm">Email and mobile push are optional. Enable push on your phone in the EcoLearn app. Your inbox is available on both web and app.</p>
        {([["email_enabled", "Email notifications"], ["push_enabled", "Mobile push notifications"], ["streak_reminders", "Streak reminders"], ["learning_updates", "Assignments and due dates"], ["community_updates", "Community announcements and events"]] as const).map(([key, label]) => <label className="my-3 flex gap-3" key={key}><input type="checkbox" checked={preferences[key]} onChange={(e) => setPreferences({ ...preferences, [key]: e.target.checked })} />{label}</label>)}
        <div className="my-4 flex flex-wrap gap-4"><label>Timezone <input aria-label="Reminder timezone" className={input} value={preferences.timezone} onChange={(e) => setPreferences({ ...preferences, timezone: e.target.value })} /></label><label>Reminder hour <select aria-label="Reminder hour" className={input} value={preferences.reminder_hour} onChange={(e) => setPreferences({ ...preferences, reminder_hour: Number(e.target.value) })}>{Array.from({ length: 24 }, (_, hour) => <option key={hour} value={hour}>{String(hour).padStart(2, "0")}:00</option>)}</select></label></div>
        <button disabled={busy || loading || !ready} className="rounded-xl bg-[#173d2a] p-3 text-white disabled:opacity-50" onClick={() => void save()}>{busy ? "Saving…" : "Save preferences"}</button>
      </section>
    </>}
  </div>;
}
