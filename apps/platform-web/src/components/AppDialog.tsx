import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { queue } from "@/lib/app-dialog";

export function AppDialogHost() {
  const active = useSyncExternalStore(queue.subscribe, queue.get);
  const ref = useRef<HTMLDialogElement>(null);
  const [value, setValue] = useState("");
  useEffect(() => {
    if (!active) return;
    const previous = document.activeElement as HTMLElement | null;
    setValue(active.value.input?.choices?.[0] ?? "");
    const dialog = ref.current;
    dialog?.showModal();
    // Cancellation is the default keyboard action for destructive changes.
    dialog?.querySelector<HTMLButtonElement>('[data-cancel]')?.focus();
    return () => { dialog?.close(); previous?.focus(); };
  }, [active]);
  if (!active) return null;
  const request = active.value;
  const settle = (answer: string | null) => queue.take(active.id)?.resolve(answer);
  return <dialog ref={ref} aria-labelledby="app-dialog-title" aria-describedby={request.message ? "app-dialog-description" : undefined}
    onCancel={event => { event.preventDefault(); settle(null); }}
    className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-md overflow-y-auto rounded-3xl border border-[#dce5d8] bg-white p-6 text-[#173d2a] shadow-2xl backdrop:bg-[#0c1f17]/55 sm:p-8">
    <form onSubmit={event => { event.preventDefault(); settle(value); }}>
      <h2 id="app-dialog-title" className="text-2xl font-semibold leading-tight">{request.title}</h2>
      {request.message && <p id="app-dialog-description" className="mt-3 whitespace-pre-line text-base leading-7 text-[#52665a]">{request.message}</p>}
      {request.input && <label className="mt-5 block text-sm font-semibold">{request.input.choices ? "Choose a reason" : "Details (optional)"}
        {request.input.choices ? <select value={value} onChange={event => setValue(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border bg-white px-3 text-base">{request.input.choices.map(choice => <option key={choice}>{choice}</option>)}</select>
          : <textarea value={value} maxLength={request.input.maxLength} onChange={event => setValue(event.target.value)} rows={4} className="mt-2 w-full rounded-xl border p-3 text-base" />}
      </label>}
      <div className="mt-7 flex flex-col gap-3">
        <button type="button" data-cancel className="min-h-12 rounded-xl bg-[#eef2ec] px-4 py-3 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" onClick={() => settle(null)}>Cancel</button>
        <button type="submit" className={`min-h-12 rounded-xl px-4 py-3 font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${request.destructive ? "bg-[#a13325]" : "bg-[#286c3d]"}`}>{request.confirm}</button>
      </div>
    </form>
  </dialog>;
}
