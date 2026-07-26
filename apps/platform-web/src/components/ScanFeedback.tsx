import { useState } from "react";
import { Check, ShieldCheck, ThumbsDown, ThumbsUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type Props = { result: { item: string; recyclable: boolean }; imageFile: File | null };
type Issue = "wrong_item" | "wrong_disposal" | "unclear_guidance";
type Disposal = "recycle" | "trash" | "special_dropoff" | "not_sure";

export function ScanFeedback({ result, imageFile }: Props) {
  const { user } = useAuth();
  const [verdict, setVerdict] = useState<"correct" | "incorrect" | null>(null);
  const [issue, setIssue] = useState<Issue | null>(null);
  const [disposal, setDisposal] = useState<Disposal | null>(null);
  const [shareImage, setShareImage] = useState(false);
  const [sent, setSent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!user || !verdict || (verdict === "incorrect" && (!issue || !disposal))) return;
    setSaving(true); setError("");
    let imagePath: string | null = null;
    if (shareImage && imageFile) {
      imagePath = `${user.id}/${crypto.randomUUID()}-${imageFile.name.replace(/[^a-z0-9._-]/gi, "-")}`;
      const { error: uploadError } = await supabase.storage.from("training-feedback").upload(imagePath, imageFile, { contentType: imageFile.type, upsert: false });
      if (uploadError) { setError("We could not save the opted-in photo. Please try again."); setSaving(false); return; }
    }
    const { data, error: insertError } = await supabase.from("scan_feedback").insert({
      user_id: user.id, predicted_label: result.item, predicted_recyclable: result.recyclable,
      verdict, issue, corrected_disposal: disposal, training_consent: Boolean(imagePath),
      ai_review_consent: Boolean(imagePath), image_path: imagePath,
      retention_expires_at: imagePath ? new Date(Date.now() + 730 * 24 * 60 * 60 * 1000).toISOString() : null,
    }).select("id").single();
    if (insertError) { setError("We could not save your feedback. Please try again."); setSaving(false); return; }
    if (imagePath && data?.id) void supabase.functions.invoke("review-feedback", { body: { feedbackId: data.id } });
    setSaving(false); setSent(true);
  };

  if (!user) return null;
  if (sent) return <div className="mt-5 flex items-center gap-2 rounded-xl bg-[#e7f4e1] p-4 text-sm font-semibold text-[#327642]"><Check size={17} /> Thanks — your feedback was saved.</div>;
  return <section className="mt-5 rounded-2xl border border-[#dfe7db] bg-white p-5"><p className="font-semibold">Was this result accurate?</p><p className="mt-1 text-sm text-[#718076]">A quick answer helps us measure the scanner.</p><div className="mt-4 flex gap-2">{([['correct','Yes',ThumbsUp],['incorrect','No',ThumbsDown]] as const).map(([value,label,Icon]) => <button key={value} onClick={() => setVerdict(value)} className={`flex flex-1 items-center justify-center gap-2 rounded-xl border py-3 text-sm font-bold ${verdict === value ? "border-[#55a457] bg-[#e9f6e4] text-[#337943]" : "border-[#dfe5dc]"}`}><Icon size={16} /> {label}</button>)}</div>{verdict === "incorrect" && <div className="mt-4 space-y-3"><Option label="What was off?" options={[['wrong_item','Wrong item'],['wrong_disposal','Wrong bin'],['unclear_guidance','Unclear guidance']]} value={issue} setValue={setIssue} /><Option label="What should it be?" options={[['recycle','Recycle'],['trash','Trash'],['special_dropoff','Special drop-off'],['not_sure','Not sure']]} value={disposal} setValue={setDisposal} /></div>}{verdict && <><label className="mt-4 flex cursor-pointer items-start gap-2 rounded-xl bg-[#f6f9f4] p-3 text-xs leading-5 text-[#637468]"><input type="checkbox" checked={shareImage} disabled={!imageFile} onChange={(event) => setShareImage(event.target.checked)} className="mt-1" /><span><ShieldCheck className="mr-1 inline" size={14} />Share this photo for private training and AI-assisted review by EcoLearn and an approved AI provider. It is retained for up to 24 months and can be deleted on request.</span></label>{error && <p className="mt-3 text-sm text-red-600">{error}</p>}<button onClick={() => void submit()} disabled={saving || (verdict === "incorrect" && (!issue || !disposal))} className="mt-4 rounded-xl bg-[#173d2a] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40">{saving ? "Saving…" : "Send feedback"}</button></>}</section>;
}

function Option<T extends string>({ label, options, value, setValue }: { label: string; options: readonly (readonly [T, string])[]; value: T | null; setValue: (value: T) => void }) { return <div><p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#78867b]">{label}</p><div className="flex flex-wrap gap-2">{options.map(([option, text]) => <button key={option} onClick={() => setValue(option)} className={`rounded-lg border px-3 py-2 text-xs font-semibold ${value === option ? "border-[#55a457] bg-[#e9f6e4] text-[#337943]" : "border-[#dfe5dc]"}`}>{text}</button>)}</div></div>; }
