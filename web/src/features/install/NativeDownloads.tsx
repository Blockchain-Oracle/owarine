import { INSTALL, NATIVE_PENDING } from "./copy";
import { InstallCta } from "./InstallCta";

/**
 * The two native ways in, laid out as the reference's cards (S26, 09-25): Android, then iPhone. On Canton neither
 * native build exists yet (C11), so each card says so in `CapabilityPending`'s words instead of offering the
 * reference's Solana APK or TestFlight beta; the installable web app is the way in that works today.
 */
export function NativeDownloads() {
  return (
    <section className="dl-native" aria-label="Get Agari on your phone">
      <article className="dl-card dl-card-android">
        <div className="dl-card-head">
          <span className="section-eyebrow">{INSTALL.android.eyebrow}</span>
          <h2>{INSTALL.android.title}</h2>
        </div>
        <p className="dl-card-line">{INSTALL.android.body}</p>
        <p className="dl-card-foot">{INSTALL.pending(NATIVE_PENDING.android)}</p>
      </article>

      <article className="dl-card dl-card-ios">
        <div className="dl-card-head">
          <span className="section-eyebrow">{INSTALL.ios.eyebrow}</span>
          <h2>{INSTALL.ios.title}</h2>
        </div>
        <p className="dl-card-line">{INSTALL.ios.body}</p>
        <InstallCta />
        <p className="dl-card-foot">{INSTALL.pending(NATIVE_PENDING.ios)}</p>
      </article>
    </section>
  );
}
