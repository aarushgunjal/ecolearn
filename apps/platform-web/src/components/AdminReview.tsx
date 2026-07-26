import { useCallback, useEffect, useState } from "react";
import {
  Check,
  Download,
  Eye,
  RefreshCw,
  ShieldAlert,
  Trash2,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type Feedback = {
  id: string;
  predicted_label: string;
  predicted_recyclable: boolean;
  verdict: string;
  issue: string | null;
  corrected_disposal: string | null;
  image_path: string | null;
  review_status: "pending" | "approved" | "rejected";
  reviewer_kind: "llm" | "human" | null;
  normalized_label: string | null;
  review_confidence: number | null;
  review_rationale: string | null;
  review_model: string | null;
  reviewed_at: string | null;
  created_at: string;
  imageUrl?: string | null;
};
const labels = [
  "battery",
  "biological",
  "cardboard",
  "clothes",
  "glass",
  "metal",
  "paper",
  "plastic",
  "shoes",
  "trash",
];

export function AdminReview() {
  const { user } = useAuth();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [items, setItems] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<
    "pending" | "approved" | "rejected" | "all"
  >("pending");
  const [message, setMessage] = useState("");
  const [batchSize, setBatchSize] = useState(20);
  const [automationEnabled, setAutomationEnabled] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    const { data: isAdmin, error: adminError } =
      await supabase.rpc("is_app_admin");
    if (adminError || !isAdmin) {
      setAllowed(false);
      setLoading(false);
      return;
    }
    setAllowed(true);
    const { data: automation } = await supabase
      .from("training_automation_settings")
      .select("batch_size, enabled")
      .eq("singleton", true)
      .maybeSingle();
    if (automation) {
      setBatchSize(automation.batch_size ?? 20);
      setAutomationEnabled(automation.enabled ?? true);
    }
    let query = supabase
      .from("scan_feedback")
      .select(
        "id,predicted_label,predicted_recyclable,verdict,issue,corrected_disposal,image_path,review_status,reviewer_kind,normalized_label,review_confidence,review_rationale,review_model,reviewed_at,created_at",
      )
      .order("created_at", { ascending: false })
      .limit(100);
    if (filter !== "all") query = query.eq("review_status", filter);
    const { data, error } = await query;
    if (error) {
      setMessage("Could not load the review queue.");
      setLoading(false);
      return;
    }
    const withUrls = await Promise.all(
      (data ?? []).map(async (item: Feedback) => {
        if (!item.image_path) return item;
        const { data: signed } = await supabase.storage
          .from("training-feedback")
          .createSignedUrl(item.image_path, 60 * 10);
        return { ...item, imageUrl: signed?.signedUrl ?? null };
      }),
    );
    setItems(withUrls);
    setLoading(false);
  }, [filter]);
  useEffect(() => {
    if (user) void load();
    else {
      setAllowed(false);
      setLoading(false);
    }
  }, [user, load]);
  const update = async (id: string, review_status: "approved" | "rejected") => {
    const { error } = await supabase
      .from("scan_feedback")
      .update({
        review_status,
        reviewer_kind: "human",
        reviewed_at: new Date().toISOString(),
        reviewed_by: user?.id,
      })
      .eq("id", id);
    if (error) setMessage("Could not save the review.");
    else void load();
  };
  const runAi = async (id: string) => {
    setMessage("Running AI review…");
    const { data, error } = await supabase.functions.invoke("review-feedback", {
      body: { feedbackId: id },
    });
    setMessage(
      error || data?.error
        ? `AI review failed: ${data?.error ?? error?.message}`
        : `AI review completed: ${data?.status}.`,
    );
    void load();
  };
  const setLabel = async (id: string, normalized_label: string) => {
    const { error } = await supabase
      .from("scan_feedback")
      .update({
        normalized_label,
        reviewer_kind: "human",
        review_status: "approved",
        reviewed_at: new Date().toISOString(),
        reviewed_by: user?.id,
        review_rationale: "Human reviewer assigned the final training label.",
      })
      .eq("id", id);
    if (error) setMessage("Could not save the correct label.");
    else {
      setMessage("Correct label saved and approved.");
      void load();
    }
  };
  const exportTraining = async () => {
    setMessage("Preparing the private Kaggle manifest…");
    const { data, error } = await supabase.functions.invoke(
      "export-training-manifest",
      { body: {} },
    );
    if (error || !data?.examples) {
      setMessage(
        `Export failed: ${data?.error ?? error?.message ?? "Unknown error"}`,
      );
      return;
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ecolearn-training-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setMessage(
      `Downloaded ${data.examples.length} approved examples. Run the Kaggle preparation script within one hour.`,
    );
  };
  const saveAutomation = async (
    nextBatchSize = batchSize,
    nextEnabled = automationEnabled,
  ) => {
    setBatchSize(nextBatchSize);
    setAutomationEnabled(nextEnabled);
    const { error } = await supabase
      .from("training_automation_settings")
      .upsert({
        singleton: true,
        batch_size: nextBatchSize,
        enabled: nextEnabled,
        auto_promote: true,
        updated_at: new Date().toISOString(),
        updated_by: user?.id,
      });
    setMessage(
      error
        ? "Could not save the batch automation setting. Run the training automation migration first."
        : nextEnabled
          ? `Automatic training will queue each ${nextBatchSize} approved examples.`
          : "Automatic training is paused; already queued batches are unaffected.",
    );
  };
  const remove = async (item: Feedback) => {
    if (!window.confirm("Delete this feedback and its opted-in image?")) return;
    if (item.image_path)
      await supabase.storage
        .from("training-feedback")
        .remove([item.image_path]);
    const { error } = await supabase
      .from("scan_feedback")
      .delete()
      .eq("id", item.id);
    if (error) setMessage("Could not delete this contribution.");
    else void load();
  };
  if (loading)
    return (
      <section className="rounded-3xl bg-white p-8">
        Loading review queue…
      </section>
    );
  if (!allowed)
    return (
      <section className="rounded-3xl border border-amber-200 bg-amber-50 p-8">
        <ShieldAlert className="mb-3 text-amber-700" />
        <h1 className="text-xl font-bold">Admin access required</h1>
        <p className="mt-2 text-sm">
          Sign in with the account configured as an EcoLearn administrator.
        </p>
      </section>
    );
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase tracking-[.14em] text-[#438b52]">
            Trust & quality
          </p>
          <h1 className="display-serif mt-2 text-4xl tracking-[-.05em]">
            Feedback review
          </h1>
          <p className="mt-2 text-sm text-[#65756a]">
            Only consented photos may be sent to AI or included in training.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => void exportTraining()}
            className="rounded-xl bg-[#173d2a] px-4 py-2 text-sm font-bold text-white"
          >
            <Download className="mr-2 inline" size={15} />
            Export for Kaggle
          </button>
          <button
            onClick={() => void load()}
            className="rounded-xl border px-4 py-2 text-sm font-bold"
          >
            <RefreshCw className="mr-2 inline" size={15} />
            Refresh
          </button>
        </div>
      </div>
      <section className="rounded-2xl border border-[#d9e8d4] bg-[#f6fbf3] p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-[#24412e]">
              Automated model training
            </p>
            <p className="mt-1 text-sm text-[#65756a]">
              A Kaggle job starts when this many consented, approved examples
              are ready.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold text-[#365342]">
            <input
              type="checkbox"
              checked={automationEnabled}
              onChange={(event) =>
                void saveAutomation(batchSize, event.target.checked)
              }
              className="h-4 w-4 accent-[#347e45]"
            />{" "}
            Enabled
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {[20, 50, 100, 500].map((size) => (
            <button
              key={size}
              onClick={() => void saveAutomation(size)}
              className={`rounded-full px-3 py-2 text-xs font-bold ${batchSize === size ? "bg-[#173d2a] text-white" : "bg-white ring-1 ring-[#cfe0c9]"}`}
            >
              Every {size} images
            </button>
          ))}
        </div>
      </section>
      <div className="flex gap-2">
        {(["pending", "approved", "rejected", "all"] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`rounded-full px-3 py-2 text-xs font-bold ${filter === status ? "bg-[#173d2a] text-white" : "bg-white ring-1 ring-[#dfe6dc]"}`}
          >
            {status}
          </button>
        ))}
      </div>
      {message && (
        <p className="rounded-xl bg-[#eef6eb] p-3 text-sm">{message}</p>
      )}
      <div className="grid gap-4">
        {items.length === 0 ? (
          <p className="rounded-2xl bg-white p-6 text-sm">
            No {filter === "all" ? "" : filter} feedback.
          </p>
        ) : (
          items.map((item) => (
            <article
              key={item.id}
              className="grid gap-5 rounded-3xl border border-[#dfe6dc] bg-white p-5 md:grid-cols-[150px_1fr_auto]"
            >
              <div className="grid aspect-square place-items-center overflow-hidden rounded-2xl bg-[#f2f5ef]">
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt="Private feedback submission"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Eye className="text-[#7b887d]" />
                )}
              </div>
              <div>
                <div className="flex flex-wrap gap-2">
                  <b>{item.predicted_label}</b>
                  <span className="rounded-full bg-[#eef5ea] px-2 py-0.5 text-xs">
                    User: {item.verdict}
                  </span>
                  <span className="rounded-full bg-[#f3f3f1] px-2 py-0.5 text-xs">
                    {item.review_status}
                  </span>
                </div>
                <p className="mt-2 text-sm">
                  AI:{" "}
                  {item.reviewer_kind === "llm"
                    ? `${item.normalized_label ?? "no label"} · ${Math.round((item.review_confidence ?? 0) * 100)}%`
                    : "Not checked yet"}
                </p>
                <p className="mt-1 text-sm text-[#66746a]">
                  {item.review_rationale ?? "No AI rationale yet."}
                </p>
                <p className="mt-2 text-xs text-[#7b887d]">
                  {item.review_model ?? "No AI model"} ·{" "}
                  {new Date(item.created_at).toLocaleString()}
                </p>
                <label className="mt-4 block text-xs font-bold">
                  Final human label
                  <select
                    value={item.normalized_label ?? ""}
                    onChange={(event) => {
                      if (event.target.value)
                        void setLabel(item.id, event.target.value);
                    }}
                    className="mt-1 block rounded-lg border p-2 text-sm font-normal"
                  >
                    <option value="">Choose correct label</option>
                    {labels.map((label) => (
                      <option key={label} value={label}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="flex flex-row gap-2 md:flex-col">
                <button
                  onClick={() => void runAi(item.id)}
                  disabled={!item.image_path}
                  className="rounded-xl border px-3 py-2 text-xs font-bold disabled:opacity-40"
                >
                  Run AI
                </button>
                <button
                  onClick={() => void update(item.id, "approved")}
                  className="rounded-xl bg-[#e7f4e1] px-3 py-2 text-xs font-bold text-[#287540]"
                >
                  <Check className="mr-1 inline" size={14} />
                  Approve
                </button>
                <button
                  onClick={() => void update(item.id, "rejected")}
                  className="rounded-xl bg-[#fff0ed] px-3 py-2 text-xs font-bold text-[#a65347]"
                >
                  <X className="mr-1 inline" size={14} />
                  Reject
                </button>
                <button
                  onClick={() => void remove(item)}
                  className="rounded-xl border px-3 py-2 text-xs font-bold text-red-700"
                >
                  <Trash2 className="mr-1 inline" size={14} />
                  Delete
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
