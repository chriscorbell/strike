import type { ExerciseVideo, Muscle } from "@strike/core";
import { ExternalLink, Play } from "lucide-react";
import { motion } from "motion/react";
import { useState, type ReactNode } from "react";
import { Sheet } from "../../components/ui/Sheet.tsx";
import { ErrorState, Skeleton, SkeletonList } from "../../components/ui/States.tsx";
import { fmtCountdown } from "../../lib/format.ts";
import { MUSCLE_LABEL } from "../../lib/labels.ts";
import { easeOut } from "../../lib/motion.ts";
import { useExercise } from "../../lib/queries.ts";

/** What the sheet needs before the guide loads: enough for the title. */
export interface GuideTarget {
  exerciseId: string;
  name: string;
}

interface ExerciseGuideSheetProps {
  target: GuideTarget | null;
  open: boolean;
  onClose: () => void;
}

/** How to do an exercise: technique video, setup, the rep, and common mistakes. */
export function ExerciseGuideSheet({ target, open, onClose }: ExerciseGuideSheetProps) {
  const query = useExercise(open ? (target?.exerciseId ?? null) : null);
  const detail = query.data?.id === target?.exerciseId ? query.data : undefined;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      size="lg"
      title={target?.name ?? ""}
      description={detail ? musclesLine(detail.primary, detail.secondary) : undefined}
    >
      {detail ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={easeOut}>
          <VideoPlayer key={detail.guide.video.youtubeId} video={detail.guide.video} exerciseName={detail.name} />
          <div className="mt-7 flex flex-col gap-7">
            <GuideSection title="Setup">
              <ul className="flex flex-col gap-2.5">
                {detail.guide.setup.map((line, i) => (
                  <li key={i} className="flex gap-3 text-[15px] leading-relaxed text-ink-2">
                    <span aria-hidden className="mt-[0.6rem] size-1.5 shrink-0 rounded-full bg-ink-3" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </GuideSection>
            <GuideSection title="The rep">
              <ol className="flex flex-col gap-3">
                {detail.guide.steps.map((line, i) => (
                  <li key={i} className="flex gap-3 text-[15px] leading-relaxed text-ink-2">
                    <span
                      aria-hidden
                      className="tnum mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-raised text-[13px] font-semibold text-ink"
                    >
                      {i + 1}
                    </span>
                    <span>{line}</span>
                  </li>
                ))}
              </ol>
            </GuideSection>
            <GuideSection title="Common mistakes">
              <ul className="flex flex-col gap-2.5">
                {detail.guide.mistakes.map((line, i) => (
                  <li key={i} className="flex gap-3 text-[15px] leading-relaxed text-ink-2">
                    <span aria-hidden className="mt-[0.6rem] size-1.5 shrink-0 rounded-full bg-warn" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </GuideSection>
          </div>
        </motion.div>
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <div aria-busy>
          <Skeleton className="aspect-video w-full rounded-xl" />
          <SkeletonList rows={4} className="mt-7" rowClassName="h-5" />
        </div>
      )}
    </Sheet>
  );
}

function GuideSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-3 text-[15px] font-semibold tracking-tight text-ink">{title}</h3>
      {children}
    </section>
  );
}

function musclesLine(primary: Muscle, secondary: Muscle[]) {
  const also = secondary.map((m) => MUSCLE_LABEL[m].toLowerCase()).join(", ");
  return also ? `${MUSCLE_LABEL[primary]} · also ${also}` : MUSCLE_LABEL[primary];
}

/**
 * The thumbnail stands in for the player until it's tapped, so opening the sheet doesn't load
 * YouTube. Closing the sheet unmounts the player, which stops playback.
 */
function VideoPlayer({ video, exerciseName }: { video: ExerciseVideo; exerciseName: string }) {
  const [playing, setPlaying] = useState(false);
  const watchUrl = `https://www.youtube.com/watch?v=${video.youtubeId}${video.start ? `&t=${video.start}s` : ""}`;
  const embedUrl = `https://www.youtube-nocookie.com/embed/${video.youtubeId}?autoplay=1&playsinline=1&rel=0&start=${video.start}`;

  return (
    <figure>
      <div className="relative aspect-video overflow-hidden rounded-xl bg-raised">
        {playing ? (
          <iframe
            src={embedUrl}
            title={video.title}
            className="absolute inset-0 size-full"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            aria-label={`Play video: how to do ${exerciseName}`}
            className="group absolute inset-0"
          >
            <img
              src={`https://i.ytimg.com/vi/${video.youtubeId}/hqdefault.jpg`}
              alt=""
              className="size-full object-cover opacity-80 transition-[opacity,transform] duration-300 ease-out group-hover:scale-[1.015] group-hover:opacity-95"
            />
            <span className="absolute left-1/2 top-1/2 flex size-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-accent text-accent-ink shadow-[0_8px_24px_rgb(0_0_0/0.4)] transition-transform duration-200 group-hover:scale-105 group-active:scale-95">
              <Play size={22} fill="currentColor" strokeWidth={0} className="translate-x-px" aria-hidden />
            </span>
            <span className="tnum absolute bottom-2.5 right-2.5 rounded-md bg-black/75 px-1.5 py-0.5 text-xs font-medium text-white">
              {video.start > 0 ? `From ${fmtCountdown(video.start)}` : fmtCountdown(video.seconds)}
            </span>
          </button>
        )}
      </div>
      <figcaption className="mt-2.5 flex items-start justify-between gap-3">
        <p className="min-w-0 text-[13px] leading-snug text-ink-3">
          <span className="text-ink-2">{video.channel}</span>
          <span aria-hidden> · </span>
          {video.title}
        </p>
        <a
          href={watchUrl}
          target="_blank"
          rel="noreferrer"
          className="-my-1 inline-flex shrink-0 items-center gap-1 rounded-lg py-1 text-[13px] font-medium text-ink-3 transition-colors hover:text-ink"
        >
          YouTube
          <ExternalLink size={13} aria-hidden />
        </a>
      </figcaption>
    </figure>
  );
}
