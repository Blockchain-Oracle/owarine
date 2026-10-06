"use client";

import { useState } from "react";
import { SeatQr } from "@/features/canton-ux/seat/SeatQr";
import type { AndroidRelease, PublicRelease } from "@/lib/release";
import { INSTALL, NATIVE_PENDING } from "./copy";
import { InstallCta } from "./InstallCta";
import "./install-canton.css";

const A = INSTALL.android;
const I = INSTALL.ios;

function Arrow({ down = false }: { down?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="dl-cta-arrow">
      <path d={down ? "M12 4v12m0 0l-5-5m5 5l5-5M5 20h14" : "M5 12h14m0 0-5-5m5 5-5 5"} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** The checksum on one line, with a copy button — what someone verifying the file actually needs (the reference's row). */
function ShaRow({ sha256 }: { sha256: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard?.writeText(sha256).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <div className="dl-sha">
      <span className="dl-sha-label">{A.shaLabel}</span>
      <code className="dl-sha-value">{sha256}</code>
      <button type="button" className="dl-sha-copy" onClick={copy} aria-live="polite">
        {copied ? A.copied : A.copy}
      </button>
    </div>
  );
}

/** A scannable code for a desktop reader; hidden at phone width, where the phone is the device (download.css). */
function Qr({ text, label, caption }: { text: string; label: string; caption: string }) {
  return (
    <figure className="dl-qr dl-qr-canton">
      <SeatQr text={text} label={label} className="dl-qr-code" />
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

function AndroidCard({ apk }: { apk: AndroidRelease | null }) {
  if (apk === null) {
    return (
      <article className="dl-card dl-card-android" data-state="pending">
        <div className="dl-card-head">
          <span className="section-eyebrow">{A.eyebrow}</span>
          <h2>{A.pendingTitle}</h2>
        </div>
        <p className="dl-card-line">{A.pendingBody}</p>
        <p className="dl-card-foot">{INSTALL.pending(NATIVE_PENDING.android)}</p>
      </article>
    );
  }
  return (
    <article className="dl-card dl-card-android" data-state="ready">
      <div className="dl-card-head">
        <span className="section-eyebrow">{A.eyebrow}</span>
        <h2>{A.title}</h2>
        {apk.version && <p className="dl-card-meta">{A.version(apk.version)}</p>}
      </div>
      <div className="dl-card-body">
        <Qr text={apk.url} label={A.qrLabel} caption={A.scan} />
        <div className="dl-card-main">
          <a className="dl-cta" href={apk.url} download data-cursor="hover">
            {A.cta}
            <Arrow down />
          </a>
          <ol className="dl-steps">
            {A.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
      </div>
      <ShaRow sha256={apk.sha256} />
      <p className="dl-card-foot">{A.verify}</p>
    </article>
  );
}

function IosCard({ testflightUrl }: { testflightUrl: string | null }) {
  return (
    <article className="dl-card dl-card-ios" data-state={testflightUrl ? "ready" : "pending"}>
      <div className="dl-card-head">
        <span className="section-eyebrow">{I.eyebrow}</span>
        <h2>{testflightUrl ? I.title : I.pendingTitle}</h2>
      </div>
      <p className="dl-card-line">{testflightUrl ? I.body : I.pendingBody}</p>
      {testflightUrl && (
        <div className="dl-card-body">
          <Qr text={testflightUrl} label={I.qrLabel} caption={I.scan} />
          <div className="dl-card-main">
            <a className="dl-cta" href={testflightUrl} data-cursor="hover">
              {I.cta}
              <Arrow />
            </a>
          </div>
        </div>
      )}
      <InstallCta />
      {!testflightUrl && <p className="dl-card-foot">{INSTALL.pending(NATIVE_PENDING.ios)}</p>}
    </article>
  );
}

/**
 * The two native ways in, laid out as the reference's cards (S26, 09-25): Android, then iPhone. Each card follows the
 * config point (`web/src/lib/release.ts`): with its value set it is the reference's card — QR, button, and for the APK
 * the SHA-256 row — and without it the card names what it waits on in `CapabilityPending`'s words. The installable web
 * app is the way in that works either way.
 */
export function NativeDownloads({ release }: { release: Pick<PublicRelease, "android" | "testflightUrl"> }) {
  return (
    <section className="dl-native" aria-label="Get Agari on your phone">
      <AndroidCard apk={release.android} />
      <IosCard testflightUrl={release.testflightUrl} />
    </section>
  );
}
