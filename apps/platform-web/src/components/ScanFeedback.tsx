import { useState } from "react";
import { Check, ShieldCheck, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type SecondOpinion = {
  status: "loading" | "ready" | "unavailable";
  label?: string;
  confidence?: number;
  rationale?: string;
  model?: string;
};
type Props = {
  result: {
    item: string;
    recyclable: boolean;
    confidence: number;
    secondOpinion?: SecondOpinion;
  };
  imageFile: File | null;
  trainingConsentMode: "always_allow" | "ask_every_time";
};
type Issue = "wrong_item" | "wrong_disposal" | "unclear_guidance";
type Disposal = "recycle" | "trash" | "special_dropoff" | "not_sure";
type ActiveLearningReason =
  | "user_correction"
  | "low_confidence"
  | "model_llm_disagreement"
  | "representative_sample";

const confidenceRatio = (value: number) =>
  value <= 1 ? Math.max(0, value) : Math.max(0, Math.min(1, value / 100));

export function ScanFeedback({
  result,
  imageFile,
  trainingConsentMode,
}: Props) {
  const { user } = useAuth();
  const [verdict, setVerdict] = useState<"correct" | "incorrect" | null>(null);
  const [issue, setIssue] = useState<Issue | null>(null);
  const [disposal, setDisposal] = useState<Disposal | null>(null);
  const [representativeSample] = useState(() => Math.random() < 0.05);
  const [sent, setSent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showConsent, setShowConsent] = useState(false);

  const confidence = confidenceRatio(result.confidence);
  const disagreement =
    result.secondOpinion?.status === "ready" &&
    result.secondOpinion.label?.toLowerCase() !== result.item.toLowerCase();
  const activeLearningReason: ActiveLearningReason | null =
    verdict === "incorrect"
      ? "user_correction"
      : disagreement
        ? "model_llm_disagreement"
        : confidence < 0.85
          ? "low_confidence"
          : representativeSample
            ? "representative_sample"
            : null;
  const eligiblePhoto = Boolean(imageFile && activeLearningReason);
  const alwaysAllow = trainingConsentMode === "always_allow";

  const persistConsentPreference = async (alwaysAllowPhotos: boolean) => {
    if (!user) return;
    const { error: preferenceError } = await supabase
      .from("user_settings")
      .upsert({
        user_id: user.id,
        training_consent_enabled: alwaysAllowPhotos,
        training_consent_mode: alwaysAllowPhotos
          ? "always_allow"
          : "ask_every_time",
        updated_at: new Date().toISOString(),
      });
    if (preferenceError) throw preferenceError;
  };

  const submit = async (includeEligiblePhoto: boolean) => {
    if (!user || !verdict || (verdict === "incorrect" && (!issue || !disposal)))
      return;
    setSaving(true);
    setError("");
    let imagePath: string | null = null;
    if (includeEligiblePhoto && imageFile) {
      imagePath = `${user.id}/${crypto.randomUUID()}-${imageFile.name.replace(/[^a-z0-9._-]/gi, "-")}`;
      const { error: uploadError } = await supabase.storage
        .from("training-feedback")
        .upload(imagePath, imageFile, {
          contentType: imageFile.type,
          upsert: false,
        });
      if (uploadError) {
        setError(
          "We couldn't save the eligible training photo. Please try again.",
        );
        setSaving(false);
        return;
      }
    }
    const { data, error: insertError } = await supabase
      .from("scan_feedback")
      .insert({
        user_id: user.id,
        predicted_label: result.item,
        predicted_recyclable: result.recyclable,
        predicted_confidence: confidence,
        verdict,
        issue,
        corrected_disposal: disposal,
        training_consent: Boolean(imagePath),
        ai_review_consent: Boolean(imagePath),
        image_path: imagePath,
        active_learning_reason: imagePath ? activeLearningReason : null,
        second_opinion_label:
          result.secondOpinion?.status === "ready"
            ? (result.secondOpinion.label ?? null)
            : null,
        second_opinion_confidence:
          result.secondOpinion?.status === "ready"
            ? (result.secondOpinion.confidence ?? null)
            : null,
        second_opinion_model:
          result.secondOpinion?.status === "ready"
            ? (result.secondOpinion.model ?? null)
            : null,
        second_opinion_at:
          result.secondOpinion?.status === "ready"
            ? new Date().toISOString()
            : null,
        retention_expires_at: imagePath
          ? new Date(Date.now() + 730 * 24 * 60 * 60 * 1000).toISOString()
          : null,
      })
      .select("id")
      .single();
    if (insertError) {
      setError("We couldn't save your feedback. Please try again.");
      setSaving(false);
      return;
    }
    if (imagePath && data?.id)
      void supabase.functions.invoke("review-feedback", {
        body: { feedbackId: data.id },
      });
    setSaving(false);
    setSent(true);
  };

  const beginSubmit = () => {
    if (eligiblePhoto && !alwaysAllow) {
      setShowConsent(true);
      return;
    }
    void submit(Boolean(eligiblePhoto && alwaysAllow));
  };

  const chooseConsent = async (choice: "always" | "once" | "skip") => {
    setShowConsent(false);
    try {
      if (choice === "always") await persistConsentPreference(true);
      if (choice === "once") await persistConsentPreference(false);
      await submit(choice !== "skip");
    } catch (consentError) {
      console.error("Unable to save training preference", consentError);
      setError("We couldn't save your preference. Please try again.");
    }
  };

  if (!user) return null;
  if (sent)
    return (
      <div className="mt-5 flex items-center gap-2 rounded-xl bg-[#e7f4e1] p-4 text-sm font-semibold text-[#327642]">
        <Check size={17} /> Thanks - your feedback was saved.
      </div>
    );
  return (
    <section className="mt-5 rounded-2xl border border-[#dfe7db] bg-white p-4 sm:p-5">
      <p className="font-semibold">Was this result accurate?</p>
      <p className="mt-1 text-sm text-[#718076]">
        One tap helps us measure the scanner and prioritize hard examples.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {(
          [
            ["correct", "Yes", ThumbsUp],
            ["incorrect", "No", ThumbsDown],
          ] as const
        ).map(([value, label, Icon]) => (
          <button
            key={value}
            onClick={() => setVerdict(value)}
            className={`flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-bold ${verdict === value ? "border-[#55a457] bg-[#e9f6e4] text-[#337943]" : "border-[#dfe5dc]"}`}
          >
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>
      {verdict === "incorrect" && (
        <div className="mt-4 space-y-3">
          <Option
            label="What was off?"
            options={[
              ["wrong_item", "Wrong item"],
              ["wrong_disposal", "Wrong bin"],
              ["unclear_guidance", "Unclear guidance"],
            ]}
            value={issue}
            setValue={setIssue}
          />
          <Option
            label="What should it be?"
            options={[
              ["recycle", "Recycle"],
              ["trash", "Trash"],
              ["special_dropoff", "Special drop-off"],
              ["not_sure", "Not sure"],
            ]}
            value={disposal}
            setValue={setDisposal}
          />
        </div>
      )}
      {verdict && (
        <>
          {eligiblePhoto && alwaysAllow ? (
            <p className="mt-4 rounded-xl bg-[#f1f8ed] p-3 text-xs leading-5 text-[#46644d]">
              <ShieldCheck className="mr-1 inline text-[#347b44]" size={14} />
              You allow eligible feedback photos to help train EcoLearn's neural
              network. This hard example will be kept privately for up to 24
              months and reviewed before training.
            </p>
          ) : eligiblePhoto ? (
            <p className="mt-4 rounded-xl bg-[#fff7df] p-3 text-xs leading-5 text-[#755e24]">
              <ShieldCheck className="mr-1 inline" size={14} />
              This is a useful hard example. When you send feedback, we will ask
              whether its photo can help train EcoLearn's neural network.
            </p>
          ) : (
            <p className="mt-4 rounded-xl bg-[#f7f9f5] p-3 text-xs leading-5 text-[#637468]">
              Feedback is saved without your photo. This confident, correct
              result is not needed for training.
            </p>
          )}
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          <button
            onClick={beginSubmit}
            disabled={
              saving || (verdict === "incorrect" && (!issue || !disposal))
            }
            className="mt-4 w-full rounded-xl bg-[#173d2a] px-4 py-3 text-sm font-bold text-white disabled:opacity-40"
          >
            {saving ? "Saving..." : "Send feedback"}
          </button>
        </>
      )}
      {showConsent && (
        <div
          className="fixed inset-0 z-[70] grid place-items-end bg-[#102b1d]/45 p-3 backdrop-blur-sm sm:place-items-center sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="training-consent-title"
        >
          <div className="w-full max-w-md rounded-[1.5rem] bg-white p-5 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#e4f2dd] text-[#2b733e]">
                <ShieldCheck size={22} />
              </span>
              <button
                onClick={() => setShowConsent(false)}
                aria-label="Close training consent choice"
                className="rounded-lg p-1 text-[#6f7e73]"
              >
                <X size={20} />
              </button>
            </div>
            <h2
              id="training-consent-title"
              className="mt-4 text-xl font-bold tracking-[-.03em] text-[#173d2a]"
            >
              Help train EcoLearn's neural network?
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#637468]">
              This eligible hard-scan photo can be securely retained for up to
              24 months, reviewed for quality, and used in future classifier
              training. Your feedback is still saved if you decline.
            </p>
            <div className="mt-5 space-y-3">
              <button
                onClick={() => void chooseConsent("always")}
                className="w-full rounded-xl bg-[#173d2a] px-4 py-3 text-left text-sm font-bold text-white"
              >
                Always allow eligible photos
                <span className="mt-1 block text-xs font-normal text-white/75">
                  You can change this anytime in Profile settings.
                </span>
              </button>
              <button
                onClick={() => void chooseConsent("once")}
                className="w-full rounded-xl border border-[#b9d6b9] bg-[#f2f9ef] px-4 py-3 text-left text-sm font-bold text-[#2d6d3d]"
              >
                Allow this photo, ask me every time
              </button>
              <button
                onClick={() => void chooseConsent("skip")}
                className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-[#66766b]"
              >
                Send feedback without my photo
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function Option<T extends string>({
  label,
  options,
  value,
  setValue,
}: {
  label: string;
  options: readonly (readonly [T, string])[];
  value: T | null;
  setValue: (value: T) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#78867b]">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">
        {options.map(([option, text]) => (
          <button
            key={option}
            onClick={() => setValue(option)}
            className={`rounded-lg border px-3 py-2 text-xs font-semibold ${value === option ? "border-[#55a457] bg-[#e9f6e4] text-[#337943]" : "border-[#dfe5dc]"}`}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}
