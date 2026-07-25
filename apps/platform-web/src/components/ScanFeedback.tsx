import { useState } from "react";
import { Check, ThumbsDown, ThumbsUp } from "lucide-react";
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
  const submit = async () => {
    if (!user || !verdict || (verdict === "incorrect" && (!issue || !disposal))) return;
    setSaving(true);
    let imagePath: string | null = null;
    if (shareImage && imageFile) {
      imagePath = `${user.id}/${crypto.randomUUID()}-${imageFile.name.replace(/[^a-z0-9._-]/gi, "-")}`;
      const { error } = await supabase.storage.from("training-feedback").upload(imagePath, imageFile, { contentType: imageFile.type, upsert: false });
      if (error) { setSaving(false); return; }
    }
    const { error } = await supabase.from("scan_feedback").insert({ user_id: user.id, predicted_label: result.item, predicted_recyclable: result.recyclable, verdict, issue, corrected_disposal: disposal, training_consent: Boolean(imagePath), image_path: imagePath });
    setSaving(false);
    if (!error) setSent(true);
  };
  if (sent) return <div className="mt-5 flex items-center gap-2 rounded-xl bg-[#e7f4e1] p-4 text-sm font-semibold text-[#327642]"><Check size={17} /> Thanks — your feedback helps make EcoLearn more accurate.</div>;
  return <section className="mt-5 rounded-2xl border border-[#dfe7db] bg-white p-5"><p className="font-semibold">Was this result accurate?</p><p className="mt-1 text-sm text-[#718076]">One quick answer helps us measure and improve the scanner.</p><div className="mt-4 flex gap-2"><button onClick={() => setVerdict("correct")} className={`flex flex-1 items-center justify-center gap-2 rounded-xl border py-3 text-sm font-bold ${verdict === "correct" ? "border-[#55a457] bg-[#e9f6e4] text-[#337943]" : "border-[#dfe5dc]"}`}><ThumbsUp size={16} /> Yes</button><button onClick={() => setVerdict("incorrect")} className={`flex flex-1 items-center justify-center gap-2 rounded-xl border py-3 text-sm font-bold ${verdict === "incorrect" ? "border-[#cf7768] bg-[#fff0ed] text-[#a65347]" : "border-[#dfe5dc]"}`}><ThumbsDown size={16} /> No</button></div>{verdict === "incorrect" && <div className="mt-4 space-y-3"><div><p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#78867b]">What was off?</p><div className="flex flex-wrap gap-2">{([['wrong_item','Wrong item'],['wrong_disposal','Wrong bin'],['unclear_guidance','Unclear guidance']] as const).map(([value,label]) => <button key={value} onClick={() => setIssue(value)} className={`rounded-lg border px-3 py-2 text-xs font-semibold ${issue === value ? "border-[#55a457] bg-[#e9f6e4] text-[#337943]" : "border-[#dfe5dc]"}`}>{label}</button>)}</div></div><div><p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#78867b]">What should it be?</p><div className="flex flex-wrap gap-2">{([['recycle','Recycle'],['trash','Trash'],['special_dropoff','Special drop-off'],['not_sure','Not sure']] as const).map(([value,label]) => <button key={value} onClick={() => setDisposal(value)} className={`rounded-lg border px-3 py-2 text-xs font-semibold ${disposal === value ? "border-[#55a457] bg-[#e9f6e4] text-[#337943]" : "border-[#dfe5dc]"}`}>{label}</button>)}</div></div></div>}{verdict && <><label className="mt-4 flex cursor-pointer items-start gap-2 text-xs leading-5 text-[#637468]"><input type="checkbox" checked={shareImage} disabled={!imageFile} onChange={(event) => setShareImage(event.target.checked)} className="mt-1" /> Share this photo for reviewed model training. It is stored privately, never published, and can be used only by EcoLearn’s review team.</label><button onClick={() => void submit()} disabled={saving || (verdict === "incorrect" && (!issue || !disposal))} className="mt-4 rounded-xl bg-[#173d2a] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40">{saving ? "Saving…" : "Send feedback"}</button></>}</section>;
}
