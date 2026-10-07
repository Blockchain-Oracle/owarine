/**
 * `/download` — the reference's `app/download/page.tsx`, its words truth-corrected for the Canton port. The reference's
 * Android APK and TestFlight beta are prior-work builds, so they are never offered here. The Canton builds drop in
 * through one config point (`web/src/lib/release.ts`: `OWARINE_TESTFLIGHT_URL`, `OWARINE_ANDROID_APK_URL` and
 * `OWARINE_ANDROID_APK_SHA256`); until a value is set, each card names what it waits on (C11; `capabilities.json` Y-17,
 * L-18). The web app installs from the browser either way.
 */

/** What each native card waits on, in `CapabilityPending`'s words ("Not connected yet · waiting on …"). */
export const NATIVE_PENDING = {
  android: "an Android build of the Canton app, published with its SHA-256 (stage C11)",
  ios: "the iPhone app's App Store Connect record and TestFlight review (stage C11)",
} as const;
export const INSTALL = {
  title: "Get Owarine",
  eyebrow: "Owarine on your phone",
  titleLead: "Call it in ",
  titleEm: "ten seconds.",
  line: "Will it close this Window higher or lower? Pick a side, pick a stake, and the venue pays a winning call the moment the Window settles. Demo credits on the Canton test network, real settlement, and only you and the venue can see your position.",
  cta: {
    prompt: "Install Owarine",
    installing: "Opening the install sheet…",
    installed: "Installed · open it from your home screen",
    ios: "Add to Home Screen",
    manual: "Install from your browser menu",
  },
  iosSteps: ["Open this page in Safari", "Tap Share — the square with the arrow", "Tap Add to Home Screen, then Add"],
  manualHint: "Chrome and Edge show an install icon at the right end of the address bar. Other browsers keep “Install” or “Add to Home Screen” under their menu.",
  /** The hero's three facts: the first two follow the config point, so they never claim a build that is not published. */
  meta: {
    android: { label: "Android", ready: "the APK, with its SHA-256 to check it", pending: "no Canton build published yet · the web app installs today" },
    ios: { label: "iPhone", ready: "join the public TestFlight beta · the web app installs too", pending: "ported to Canton · TestFlight waits on its App Store Connect record" },
    network: { label: "Canton test network", note: "demo credits, real mechanics" },
  },
  /** The stage when no film is configured: a real capture of the Canton build at phone width, dated and sourced. */
  shot: {
    src: "/download/owarine-phone.jpg",
    width: 390,
    height: 592,
    alt: "Owarine's Canton build at phone width: an ETH one-minute Window, its opening print, the time left and the Up and Down prices.",
    caption: "The Canton build on a local sandbox, 29 Sep 2026",
  },
  android: {
    eyebrow: "Android",
    title: "Get the APK",
    pendingTitle: "The Android app",
    pendingBody: "No Android build of the Canton app is published yet. Until one is, install the web app from your browser menu: the same venue, the same seat and the same demo credits.",
    scan: "Scan with your phone's camera",
    qrLabel: "QR code that downloads the Owarine APK",
    cta: "Download the APK",
    version: (v: string) => `Version ${v}`,
    steps: ["Download on your Android phone", "Open the file and allow installs from this source when Android asks", "Open Owarine and take a seat"],
    shaLabel: "SHA-256",
    copy: "Copy",
    copied: "Copied",
    verify: "Check it with sha256sum, or shasum -a 256 on a Mac",
  },
  ios: {
    eyebrow: "iPhone",
    title: "Join the iOS beta",
    pendingTitle: "The iPhone app",
    body: "The public TestFlight beta is open. Join from your iPhone to install Owarine, or add the web app to your Home Screen from Safari.",
    pendingBody: "The native iPhone app is ported to Canton and builds, but there is no TestFlight beta to join until its App Store Connect record exists and review passes. Add the web app to your Home Screen from Safari meanwhile.",
    scan: "Scan with your iPhone's camera",
    qrLabel: "QR code that opens the Owarine TestFlight invitation",
    cta: "Join the TestFlight beta",
  },
  pending: (dependency: string) => `Not connected yet · waiting on ${dependency}`,
  points: [
    { title: "Take a seat and go", body: "Take a seat and the venue gives it a Canton party and demo credits. No wallet app, no network fee. There is nothing else to install." },
    { title: "Open after the bell", body: "Stock Windows every few minutes while US markets trade, a weekend Window from Friday's close to Monday's open, and 24/7 Windows on tokenised stock. When the exchange is shut, rest a call at your price for the open." },
    { title: "Paid on the close", body: "Three oracle parties sign the price for the closing second and the resolver decides the Window. Win and the venue pays your seat in its settlement batch: you sign nothing, and nobody else can take it." },
  ],
  foot: "Owarine runs on the Canton test network while it is in beta, so you are playing with demo credits. Everything else is real: real quotes, real signed prices, real settlement, real code.",
} as const;
