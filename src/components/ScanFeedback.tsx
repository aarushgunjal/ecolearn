import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export function ScanFeedback({ result, imageFile }: { result: { item: string; recyclable: boolean }; imageFile: File | null }) {
  const { user } = useAuth(); const [verdict, setVerdict] = useState<"correct" | "incorrect" | null>(null); const [issue, setIssue] = useState<string | null>(null); const [disposal, setDisposal] = useState<string | null>(null); const [share, setShare] = useState(false); const [sent, setSent] = useState(false);
  const submit = async () => {
    if (!user || !verdict || (verdict === "incorrect" && (!issue || !disposal))) return;
    let imagePath: string | null = null;
    if (share && imageFile) { imagePath = `${user.id}/${crypto.randomUUID()}-${imageFile.name.replace(/[^a-z0-9._-]/gi, "-")}`; const { error } = await supabase.storage.from("training-feedback").upload(imagePath, imageFile, { contentType: imageFile.type }); if (error) return; }
    const db = supabase as any;
    const { error } = await db.from("scan_feedback").insert({ user_id: user.id, predicted_label: result.item, predicted_recyclable: result.recyclable, verdict, issue, corrected_disposal: disposal, training_consent: Boolean(imagePath), image_path: imagePath });
    if (!error) setSent(true);
  };
  if (!user) return null;
  return <Card className="mt-5"><CardContent className="p-5"><p className="font-semibold">Was this result accurate?</p><p className="mt-1 text-sm text-muted-foreground">A quick answer helps improve EcoLearn.</p>{sent ? <p className="mt-4 rounded-lg bg-green-50 p-3 text-sm font-medium text-green-700">Thank you — feedback saved.</p> : <><div className="mt-4 flex gap-2"><Button variant={verdict === "correct" ? "default" : "outline"} onClick={() => setVerdict("correct")} className="flex-1">Yes</Button><Button variant={verdict === "incorrect" ? "destructive" : "outline"} onClick={() => setVerdict("incorrect")} className="flex-1">No</Button></div>{verdict === "incorrect" && <><p className="mt-4 text-xs font-semibold">WHAT WAS OFF?</p><div className="mt-2 flex flex-wrap gap-2">{[["wrong_item","Wrong item"],["wrong_disposal","Wrong bin"],["unclear_guidance","Unclear guidance"]].map(([value,label]) => <Button key={value} size="sm" variant={issue === value ? "default" : "outline"} onClick={() => setIssue(value)}>{label}</Button>)}</div><p className="mt-4 text-xs font-semibold">WHAT SHOULD IT BE?</p><div className="mt-2 flex flex-wrap gap-2">{[["recycle","Recycle"],["trash","Trash"],["special_dropoff","Special drop-off"],["not_sure","Not sure"]].map(([value,label]) => <Button key={value} size="sm" variant={disposal === value ? "default" : "outline"} onClick={() => setDisposal(value)}>{label}</Button>)}</div></>}<label className="mt-4 flex items-start gap-2 text-xs leading-5 text-muted-foreground"><input type="checkbox" checked={share} disabled={!imageFile} onChange={(event) => setShare(event.target.checked)} /> Share this photo for reviewed model training. It stays private and is never published.</label><Button className="mt-4" disabled={!verdict || (verdict === "incorrect" && (!issue || !disposal))} onClick={() => void submit()}>Send feedback</Button></>}</CardContent></Card>;
}
