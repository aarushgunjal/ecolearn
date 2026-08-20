import { ExternalLink, PlayCircle } from "lucide-react";
import { DSWA_VIDEO_PAGE, type DswaVideo } from "@/data/dswaVideos";

export function DSWAVideoCard({ video, compact = false }: { video: DswaVideo; compact?: boolean }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-[#dfe7db] bg-white">
      <div className="aspect-video bg-[#173d2a]">
        <iframe
          className="h-full w-full"
          src={`https://www.youtube-nocookie.com/embed/${video.id}?rel=0`}
          title={video.title}
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
      <div className={compact ? "p-4" : "p-5"}>
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.12em] text-[#438b52]">
          <PlayCircle size={15} /> Official DSWA Education video
        </p>
        <h3 className="mt-2 font-semibold tracking-[-.02em] text-[#173d2a]">{video.title}</h3>
        {!compact && <p className="mt-2 text-sm leading-6 text-[#67756b]">{video.description}</p>}
        <a
          href={DSWA_VIDEO_PAGE}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[#2d7741] underline underline-offset-2"
        >
          DSWA Education video library <ExternalLink size={12} />
        </a>
      </div>
    </article>
  );
}
