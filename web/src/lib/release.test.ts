import { describe, expect, it } from "vitest";
import { parseAndroidRelease, parseDemoFilm, parseTestflightUrl, readPublicRelease } from "./release";

const SHA = "7a3d4f2711f0a4dbe4aa6f68fecfe5a8f2de5798a548f8acccaea5434d28901f";

describe("the public release config point", () => {
  it("reads nothing when nothing is set: both pages keep their waiting state", () => {
    expect(readPublicRelease({})).toEqual({ testflightUrl: null, android: null, demoFilm: null });
  });

  it("takes only Apple's own TestFlight join links", () => {
    expect(parseTestflightUrl(" https://testflight.apple.com/join/AbC123 ")).toBe("https://testflight.apple.com/join/AbC123");
    expect(parseTestflightUrl("http://testflight.apple.com/join/AbC123")).toBeNull();
    expect(parseTestflightUrl("https://example.com/join/AbC123")).toBeNull();
    expect(parseTestflightUrl("https://testflight.apple.com/v1/app")).toBeNull();
  });

  it("offers the APK only with its checksum", () => {
    const url = "https://github.com/o/r/releases/download/android-v0.1.0/owarine-0.1.0.apk";
    expect(parseAndroidRelease({ OWARINE_ANDROID_APK_URL: url })).toBeNull();
    expect(parseAndroidRelease({ OWARINE_ANDROID_APK_URL: url, OWARINE_ANDROID_APK_SHA256: "abc" })).toBeNull();
    expect(parseAndroidRelease({ OWARINE_ANDROID_APK_URL: "https://x.test/file.zip", OWARINE_ANDROID_APK_SHA256: SHA })).toBeNull();
    expect(parseAndroidRelease({ OWARINE_ANDROID_APK_URL: url, OWARINE_ANDROID_APK_SHA256: SHA.toUpperCase(), OWARINE_ANDROID_APK_VERSION: "0.1.0" })).toEqual({ url, sha256: SHA, version: "0.1.0" });
  });

  it("plays a YouTube link through its id, or a direct video file", () => {
    for (const link of ["https://youtu.be/iPtmue-eyIc", "https://www.youtube.com/watch?v=iPtmue-eyIc&t=3", "https://www.youtube.com/embed/iPtmue-eyIc"]) {
      expect(parseDemoFilm(link)).toEqual({ kind: "youtube", id: "iPtmue-eyIc", watchUrl: "https://youtu.be/iPtmue-eyIc" });
    }
    expect(parseDemoFilm("https://cdn.example.com/owarine-canton.mp4")).toEqual({ kind: "file", src: "https://cdn.example.com/owarine-canton.mp4" });
    expect(parseDemoFilm("https://youtu.be/short")).toBeNull();
    expect(parseDemoFilm("https://example.com/page")).toBeNull();
    expect(parseDemoFilm("javascript:alert(1)")).toBeNull();
  });
});
