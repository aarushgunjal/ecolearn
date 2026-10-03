import { useEffect, useRef, useState } from "react";
import { Square, Volume2 } from "lucide-react";

export function ReadingMode({ easy, onChange }: { easy: boolean; onChange: (value: boolean) => void }) {
  return <div className="my-5 flex flex-wrap items-center gap-3 rounded-2xl border border-[#d3e3d1] bg-white p-4">
    <button type="button" role="switch" aria-checked={easy} onClick={() => onChange(!easy)}
      className="min-h-12 rounded-xl border-2 border-[#286c3d] px-4 py-3 text-base font-bold text-[#173d2a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">
      Easy reading: {easy ? "On" : "Off"}
    </button>
    <p className="max-w-sm text-base leading-6 text-[#52665a]">For K–3 or anyone who wants shorter words and picture clues. This setting is for this device.</p>
  </div>;
}

export function ListenButton({ text }: { text: string }) {
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState("");
  const generation = useRef(0);
  const supported = typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
  useEffect(() => {
    const stop = () => {
      generation.current++;
      if (supported) window.speechSynthesis.cancel();
      setSpeaking(false);
    };
    stop();
    setError("");
    const onHidden = () => { if (document.hidden) stop(); };
    document.addEventListener("visibilitychange", onHidden);
    return () => { stop(); document.removeEventListener("visibilitychange", onHidden); };
  }, [text, supported]);
  const listen = () => {
    const current = ++generation.current;
    window.speechSynthesis.cancel();
    if (speaking) { setSpeaking(false); return; }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.85;
    utterance.onend = () => { if (generation.current === current) setSpeaking(false); };
    utterance.onerror = () => {
      if (generation.current !== current) return;
      setSpeaking(false);
      setError("Listen could not start. Try again, or ask a grown-up to read with you.");
    };
    setError("");
    setSpeaking(true);
    try { window.speechSynthesis.speak(utterance); }
    catch {
      setSpeaking(false);
      setError("Listen could not start. Try again, or ask a grown-up to read with you.");
    }
  };
  return <div className="my-4">
    {supported ? <button type="button" onClick={listen} aria-pressed={speaking}
      className="inline-flex min-h-12 items-center gap-3 rounded-xl border-2 border-[#286c3d] bg-[#edf7e8] px-5 py-3 text-lg font-bold text-[#173d2a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">
      {speaking ? <Square aria-hidden="true" size={22} /> : <Volume2 aria-hidden="true" size={24} />}
      {speaking ? "Stop reading" : "Listen"}
    </button> : <p className="text-base text-[#52665a]">Listen is not available in this browser. Ask a grown-up to read with you.</p>}
    <p role="status" className="mt-2 text-base text-[#874022]">{error}</p>
  </div>;
}
