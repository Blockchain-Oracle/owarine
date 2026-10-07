import type { Metadata } from "next";
import { Fixture, FixtureGrid } from "@/app/dev/states/_sections/Fixture";
import { SectionHeader } from "@/components/chrome";
import { DemoFilm } from "@/features/demo/DemoFilm";
import { NativeDownloads } from "@/features/install/NativeDownloads";
import { readPublicRelease } from "@/lib/release";

export const metadata: Metadata = { title: "Fixtures · Release config point" };

/** Sample values only: a TestFlight join link, an APK with its checksum and a film, run through the real parser. */
const READY = readPublicRelease({
  OWARINE_TESTFLIGHT_URL: "https://testflight.apple.com/join/SAMPLE01",
  OWARINE_ANDROID_APK_URL: "https://example.com/releases/owarine-canton-0.1.0.apk",
  OWARINE_ANDROID_APK_SHA256: "0".repeat(64),
  OWARINE_ANDROID_APK_VERSION: "0.1.0",
  OWARINE_DEMO_VIDEO_URL: "https://example.com/owarine-canton-demo.mp4",
});
const PENDING = readPublicRelease({});

/**
 * `/dev/release`: every state of the one config point (`web/src/lib/release.ts`) that `/download` and `/demo` read —
 * the native cards and the film frame with nothing set (what the public pages show today) and with sample values set.
 */
export default function ReleaseFixturesPage() {
  return (
    <div className="container flex flex-col gap-8 py-8">
      <SectionHeader index="00" eyebrow="Fixtures" title="Release config point" />
      <p className="type-caption text-ink-muted">Sample values, not real builds: nothing here is a published link.</p>
      <section className="flex flex-col gap-4">
        <SectionHeader index="01" title="Native cards" eyebrow="/download" />
        <Fixture label="Nothing set — each card names what it waits on">
          <div className="dl">
            <NativeDownloads release={PENDING} />
          </div>
        </Fixture>
        <Fixture label="TestFlight link and APK set — QR, button, SHA-256">
          <div className="dl">
            <NativeDownloads release={READY} />
          </div>
        </Fixture>
      </section>
      <section className="flex flex-col gap-4">
        <SectionHeader index="02" title="Demo film" eyebrow="/demo and the /download stage" />
        <FixtureGrid>
          <Fixture label="No film set — the honest frame">
            <DemoFilm film={PENDING.demoFilm} />
          </Fixture>
          <Fixture label="A direct file set (sample URL, it will not load)">
            <DemoFilm film={READY.demoFilm} />
          </Fixture>
        </FixtureGrid>
      </section>
    </div>
  );
}
