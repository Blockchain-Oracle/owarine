/**
 * `/download` — the reference's `app/download/page.tsx`, its words truth-corrected for the Canton port. The reference's
 * Android APK and TestFlight beta are Solana builds (prior work), so they are not offered here: neither native app has
 * been built against Canton yet (C11; `docs/plan/capabilities.json` Y-17, L-18). The web app installs from the browser.
 */

/** What each native card waits on, in `CapabilityPending`'s words ("Not connected yet · waiting on …"). */
export const NATIVE_PENDING = {
  android: "the Android build against Canton (stage C11)",
  ios: "the iPhone build against Canton and its App Store Connect record (stage C11)",
} as const;
export const INSTALL = {
  title: "Get Agari",
  eyebrow: "Agari on your phone",
  titleLead: "Call it in ",
  titleEm: "ten seconds.",
  line: "Will the stock close this Window higher or lower? Pick a side, pick a stake, and the payout is yours to collect the moment it settles. Demo credits on the Canton test network, real settlement, and only your seat can cash out.",
  cta: {
    prompt: "Install Agari",
    installing: "Opening the install sheet…",
    installed: "Installed · open it from your home screen",
    ios: "Add to Home Screen",
    manual: "Install from your browser menu",
  },
  iosSteps: ["Open this page in Safari", "Tap Share — the square with the arrow", "Tap Add to Home Screen, then Add"],
  manualHint: "Chrome and Edge show an install icon at the right end of the address bar. Other browsers keep “Install” or “Add to Home Screen” under their menu.",
  meta: [
    { label: "Android", note: "not built on Canton yet · the web app installs today" },
    { label: "iPhone", note: "not built on Canton yet · add the web app to your Home Screen" },
    { label: "Canton test network", note: "demo credits, real mechanics" },
  ],
  film: { label: "The launch film", poster: "/media/agari-launch-poster.jpg", src: "/media/agari-launch.mp4" },
  android: {
    eyebrow: "Android",
    title: "The Android app",
    body: "The native Android app has not been built against Canton yet. Until it is, install the web app from your browser menu: the same venue, the same seat and the same demo credits.",
  },
  ios: {
    eyebrow: "iPhone",
    title: "The iPhone app",
    body: "The native iPhone app has not been built against Canton yet, so there is no TestFlight beta to join. Add the web app to your Home Screen from Safari meanwhile.",
  },
  pending: (dependency: string) => `Not connected yet · waiting on ${dependency}`,
  points: [
    { title: "Take a seat and go", body: "Take a seat and the venue gives it a Canton party and demo credits. No wallet app, no network fee. There is nothing else to install." },
    { title: "Open after the bell", body: "Stock Windows every few minutes while US markets trade, a weekend Window from Friday's close to Monday's open, and 24/7 Windows on tokenised stock. When the exchange is shut, rest a call at your price for the open." },
    { title: "Paid on the close", body: "Settlement reads the signed price for the closing second, the same feed you watched. Win and it is yours to claim — nobody else can." },
  ],
  foot: "Agari runs on the Canton test network while it is in beta, so you are playing with demo credits. Everything else is real: real quotes, real signed prices, real settlement, real code.",
  shotAlt: "Agari on a phone after the close: the stock's last price, the next session on the clock, and a call that can be scheduled for the open.",
} as const;
