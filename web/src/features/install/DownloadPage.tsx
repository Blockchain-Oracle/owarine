import { AgariMark } from "@/components/shell";
import { DemoFilm } from "@/features/demo/DemoFilm";
import type { PublicRelease } from "@/lib/release";
import { INSTALL } from "./copy";
import { NativeDownloads } from "./NativeDownloads";

/** The stage without a film: the reference's phone frame (part-18 `.dl-phone`) around a dated capture of the Canton build. */
function CantonShot() {
  const { shot } = INSTALL;
  return (
    <figure className="dl-shot">
      <div className="dl-phone">
        <span className="dl-phone-btn dl-btn-mute" aria-hidden />
        <span className="dl-phone-btn dl-btn-volup" aria-hidden />
        <span className="dl-phone-btn dl-btn-voldn" aria-hidden />
        <span className="dl-phone-btn dl-btn-power" aria-hidden />
        <div className="dl-phone-screen">
          {/* eslint-disable-next-line @next/next/no-img-element -- a static, dated capture; no optimisation pipeline needed */}
          <img src={shot.src} alt={shot.alt} width={shot.width} height={shot.height} />
        </div>
      </div>
      <figcaption>{shot.caption}</figcaption>
    </figure>
  );
}

/**
 * `/download` — the page the app strip lands on, from the reference's `app/download/page.tsx` (`.dl-*` in
 * part-18.css), rebuilt for the native launch (09-25): the film beside the headline, then the Android APK (QR,
 * button, SHA-256) and the iPhone path, then the three points. On Canton every native piece follows the one config
 * point (`web/src/lib/release.ts`); with no film configured, the stage shows a dated capture of the Canton build, never
 * footage recorded before the port.
 */
export function DownloadPage({ release }: { release: PublicRelease }) {
  const { meta } = INSTALL;
  const facts = [
    { label: meta.android.label, note: release.android ? meta.android.ready : meta.android.pending },
    { label: meta.ios.label, note: release.testflightUrl ? meta.ios.ready : meta.ios.pending },
    { label: meta.network.label, note: meta.network.note },
  ];
  return (
    <div className="dl">
      <section className="dl-hero">
        <div className="dl-copy">
          <div className="section-eyebrow dl-eyebrow">{INSTALL.eyebrow}</div>
          <h1 className="dl-title">
            {INSTALL.titleLead}
            <em>{INSTALL.titleEm}</em>
          </h1>
          <p className="dl-line">{INSTALL.line}</p>

          <ul className="dl-meta">
            {facts.map((item) => (
              <li key={item.label}>
                <b>{item.label}</b>
                <span>{item.note}</span>
              </li>
            ))}
          </ul>
        </div>

        {release.demoFilm ? (
          <div className="dl-stage dl-film">
            <DemoFilm film={release.demoFilm} />
          </div>
        ) : (
          <div className="dl-stage">
            <CantonShot />
          </div>
        )}
      </section>

      <NativeDownloads release={release} />

      <section className="dl-points">
        {INSTALL.points.map((point) => (
          <article key={point.title}>
            <span className="dl-pt-mark">
              <AgariMark figure="currentColor" />
            </span>
            <h3>{point.title}</h3>
            <p>{point.body}</p>
          </article>
        ))}
      </section>

      <p className="dl-foot">{INSTALL.foot}</p>
    </div>
  );
}
