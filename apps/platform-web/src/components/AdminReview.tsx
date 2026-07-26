import { useCallback, useEffect, useState } from "react";
import { Check, Eye, RefreshCw, ShieldAlert, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type Feedback = { id: string; predicted_label: string; predicted_recyclable: boolean; verdict: string; issue: string | null; corrected_disposal: string | null; image_path: string | null; review_status: "pending" | "approved" | "rejected"; reviewer_kind: "llm" | "human" | null; normalized_label: string | null; review_confidence: number | null; review_rationale: string | null; review_model: string | null; reviewed_at: string | null; created_at: string; imageUrl?: string | null };

export function AdminReview() {
  const { user } = useAuth();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [items, setItems] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setMessage("");
    const { data: isAdmin, error: adminError } = await supabase.rpc("is_app_admin");
    if (adminError || !isAdmin) { setAllowed(false); setLoading(false); return; }
    setAllowed(true);
    let query = supabase.from("scan_feedback").select("id,predicted_label,predicted_recyclable,verdict,issue,corrected_disposal,image_path,review_status,reviewer_kind,normalized_label,review_confidence,review_rationale,review_model,reviewed_at,created_at").order("created_at", { ascending: false }).limit(100);
    if (filter !== "all") query = query.eq("review_status", filter);
    const { data, error } = await query;
    if (error) { setMessage("Could not load the review queue."); setLoading(false); return; }
    const withUrls = await Promise.all((data ?? []).map(async (item: Feedback) => {
      if (!item.image_path) return item;
      const { data: signed } = await supabase.storage.from("training-feedback").createSignedUrl(item.image_path, 60 * 10);
      return { ...item, imageUrl: signed?.signedUrl ?? null };
    }));
    setItems(withUrls); setLoading(false);
  }, [filter]);
  useEffect(() => { if (user) void load(); else { setAllowed(false); setLoading(false); } }, [user, load]);
  const update = async (id: string, review_status: "approved" | "rejected") => { const { error } = await supabase.from("scan_feedback").update({ review_status, reviewer_kind: "human", reviewed_at: new Date().toISOString(), reviewed_by: user?.id }).eq("id", id); if (error) setMessage("Could not save the review."); else void load(); };
  const runAi = async (id: string) => { setMessage("Running AI review…"); const { error } = await supabase.functions.invoke("review-feedback", { body: { feedbackId: id } }); setMessage(error ? "AI review could not run; it remains pending." : "AI review completed."); void load(); };
  const remove = async (item: Feedback) => { if (!window.confirm("Delete this feedback and its opted-in image?")) return; if (item.image_path) await supabase.storage.from("training-feedback").remove([item.image_path]); const { error } = await supabase.from("scan_feedback").delete().eq("id", item.id); if (error) setMessage("Could not delete this contribution."); else void load(); };
  if (loading) return <section className="rounded-3xl bg-white p-8">Loading review queue…</section>;
  if (!allowed) return <section className="rounded-3xl border border-amber-200 bg-amber-50 p-8"><ShieldAlert className="mb-3 text-amber-700" /><h1 className="text-xl font-bold">Admin access required</h1><p className="mt-2 text-sm">Sign in with the account configured as an EcoLearn administrator.</p></section>;
  return <section className="space-y-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-bold uppercase tracking-[.14em] text-[#438b52]">Trust & quality</p><h1 className="display-serif mt-2 text-4xl tracking-[-.05em]">Feedback review</h1><p className="mt-2 text-sm text-[#65756a]">Only consented photos may be sent to AI or included in training.</p></div><button onClick={() => void load()} className="rounded-xl border px-4 py-2 text-sm font-bold"><RefreshCw className="mr-2 inline" size={15} />Refresh</button></div><div className="flex gap-2">{(["pending","approved","rejected","all"] as const).map(status => <button key={status} onClick={() => setFilter(status)} className={`rounded-full px-3 py-2 text-xs font-bold ${filter === status ? "bg-[#173d2a] text-white" : "bg-white ring-1 ring-[#dfe6dc]"}`}>{status}</button>)}</div>{message && <p className="rounded-xl bg-[#eef6eb] p-3 text-sm">{message}</p>}<div className="grid gap-4">{items.length === 0 ? <p className="rounded-2xl bg-white p-6 text-sm">No {filter === "all" ? "" : filter} feedback.</p> : items.map(item => <article key={item.id} className="grid gap-5 rounded-3xl border border-[#dfe6dc] bg-white p-5 md:grid-cols-[150px_1fr_auto]"><div className="grid aspect-square place-items-center overflow-hidden rounded-2xl bg-[#f2f5ef]">{item.imageUrl ? <img src={item.imageUrl} alt="Private feedback submission" className="h-full w-full object-cover" /> : <Eye className="text-[#7b887d]" />}</div><div><div className="flex flex-wrap gap-2"><b>{item.predicted_label}</b><span className="rounded-full bg-[#eef5ea] px-2 py-0.5 text-xs">User: {item.verdict}</span><span className="rounded-full bg-[#f3f3f1] px-2 py-0.5 text-xs">{item.review_status}</span></div><p className="mt-2 text-sm">AI: {item.reviewer_kind === "llm" ? `${item.normalized_label ?? "no label"} · ${Math.round((item.review_confidence ?? 0) * 100)}%` : "Not checked yet"}</p><p className="mt-1 text-sm text-[#66746a]">{item.review_rationale ?? "No AI rationale yet."}</p><p className="mt-2 text-xs text-[#7b887d]">{item.review_model ?? "No AI model"} · {new Date(item.created_at).toLocaleString()}</p></div><div className="flex flex-row gap-2 md:flex-col"><button onClick={() => void runAi(item.id)} disabled={!item.image_path} className="rounded-xl border px-3 py-2 text-xs font-bold disabled:opacity-40">Run AI</button><button onClick={() => void update(item.id, "approved")} className="rounded-xl bg-[#e7f4e1] px-3 py-2 text-xs font-bold text-[#287540]"><Check className="mr-1 inline" size={14} />Approve</button><button onClick={() => void update(item.id, "rejected")} className="rounded-xl bg-[#fff0ed] px-3 py-2 text-xs font-bold text-[#a65347]"><X className="mr-1 inline" size={14} />Reject</button><button onClick={() => void remove(item)} className="rounded-xl border px-3 py-2 text-xs font-bold text-red-700"><Trash2 className="mr-1 inline" size={14} />Delete</button></div></article>)}</div></section>;
}
