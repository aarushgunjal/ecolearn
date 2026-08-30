import { MapPin, Navigation, ShieldCheck } from "lucide-react";
import { ScanUtilities } from "@/components/ScanUtilities";

export function MapHub() {
  return <div className="animate-in fade-in duration-500">
    <header className="grid gap-6 rounded-[2rem] bg-[#173d2a] p-5 text-white sm:p-7 lg:grid-cols-[1fr_auto] lg:items-center lg:p-9">
      <div><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-[#a8d69c]"><MapPin size={18} />DELAWARE DISPOSAL MAP</p><h1 className="display-serif mt-3 text-3xl tracking-[-.05em] sm:text-5xl">Find the right place. Fast.</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-[#d5e4d1] sm:mt-4 sm:text-base sm:leading-7">Use your location only when you choose to search. EcoLearn combines official DSWA and DNREC facilities with clearly labeled community map data, then links you back to the source before you travel.</p></div>
      <div className="hidden grid-cols-2 gap-3 text-center sm:grid"><div className="rounded-2xl bg-white/10 p-4"><ShieldCheck className="mx-auto text-[#a8d69c]" /><strong className="mt-2 block">Source-linked</strong><span className="text-xs text-[#cbdcc7]">Verify details</span></div><div className="rounded-2xl bg-white/10 p-4"><Navigation className="mx-auto text-[#a8d69c]" /><strong className="mt-2 block">Directions</strong><span className="text-xs text-[#cbdcc7]">One tap away</span></div></div>
    </header>
    <ScanUtilities allowGenericLocations mode="map" />
  </div>;
}
