import type { DemoFilm as Film } from "@/lib/release";
import { DEMO } from "./copy";
import "./demo-film.css";

/**
 * The demo film, from the one config point (`OWARINE_DEMO_VIDEO_URL`, `web/src/lib/release.ts`). A YouTube link embeds
 * through `youtube-nocookie`, which sets no tracking cookie until the viewer presses play, with a caption link for
 * anyone whose browser blocks frames; a direct file plays in a `<video>`. With nothing configured the same 16:9 frame
 * says what it waits on (the D-015 honest state): the film is re-shot on the Canton build, and no footage recorded
 * before the port is shown here.
 */
export function DemoFilm({ film, className }: { film: Film | null; className?: string }) {
  const f = DEMO.film;
  if (film === null) {
    return (
      <figure className={className ? `demo-video-figure ${className}` : "demo-video-figure"}>
        <div className="demo-video demo-film-pending" role="note" aria-label={f.pendingLabel}>
          <p className="demo-film-eyebrow">{f.pendingEyebrow}</p>
          <p className="demo-film-line">{f.pendingLine}</p>
          <p className="demo-film-meta">{f.pendingMeta}</p>
        </div>
      </figure>
    );
  }
  return (
    <figure className={className ? `demo-video-figure ${className}` : "demo-video-figure"}>
      {film.kind === "youtube" ? (
        <iframe
          className="demo-video"
          src={`https://www.youtube-nocookie.com/embed/${film.id}?rel=0&modestbranding=1`}
          title={DEMO.video.title}
          width={1280}
          height={720}
          loading="lazy"
          allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
          aria-describedby="demo-video-caption"
        />
      ) : (
        <video className="demo-video" src={film.src} controls playsInline preload="metadata" aria-describedby="demo-video-caption" />
      )}
      <figcaption id="demo-video-caption" className="demo-video-caption">
        <span>{DEMO.video.caption}</span>
        {film.kind === "youtube" && (
          <a href={film.watchUrl} target="_blank" rel="noopener noreferrer">
            {DEMO.video.watch}
          </a>
        )}
      </figcaption>
    </figure>
  );
}
