// The Expo config (plan, iOS section "Distribution"; K-126). Every identifier that names this app to Apple, Google,
// Expo or the phone's storage comes from app.identity.json, so a new name or id changes that one file:
//   - displayName, slug, scheme, bundleId / androidPackage: what the stores, EAS and deep links see;
//   - appGroup and widgetExtensionId: the App Group and the widget + Live Activity extension (expo-widgets hosts both
//     in one target), registered by hand in the Apple Developer portal (builds run with EXPO_NO_CAPABILITY_SYNC=1);
//   - storagePrefix and mmkvId: the SecureStore and MMKV namespaces (read by src/lib/keys.ts and src/lib/storage.ts);
//   - easProjectId: null until the new EAS project exists. While it is null the config carries no EAS project and no
//     update URL at all, so nothing built or published from this repo can reach the Solana app's TestFlight users.
// There is deliberately no `owner`: `eas init` creates the project under the signed-in account.
// The `mobile-identity` invariant fails if the reference app's EAS project, update URL or App Store Connect id, or its
// bundle id, scheme or App Group, come back anywhere in the repo.
const id = require("./app.identity.json");

const eas = id.easProjectId ? { projectId: id.easProjectId } : undefined;

module.exports = () => ({
  name: id.displayName,
  slug: id.slug,
  version: "0.1.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: id.scheme,
  userInterfaceStyle: "automatic",
  ios: {
    bundleIdentifier: id.bundleId,
    icon: "./assets/images/icon.png",
    supportsTablet: false,
    // ITSAppUsesNonExemptEncryption = false (review hygiene): the app uses only the OS's own TLS and signing.
    config: { usesNonExemptEncryption: false },
    infoPlist: { NSSupportsLiveActivities: true },
  },
  android: {
    package: id.androidPackage,
    versionCode: 1,
    adaptiveIcon: {
      backgroundColor: "#171714",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    "expo-router",
    ["expo-splash-screen", { backgroundColor: "#171714", image: "./assets/images/splash-icon.png", imageWidth: 72 }],
    "expo-secure-store",
    ["expo-build-properties", { android: { buildArchs: ["arm64-v8a"], useLegacyPackaging: true } }],
    "react-native-quick-crypto",
    "expo-web-browser",
    ["expo-notifications", { color: "#E04D26", defaultChannel: "activity" }],
    [
      "expo-widgets",
      {
        bundleIdentifier: id.widgetExtensionId,
        groupIdentifier: id.appGroup,
        widgets: [
          {
            name: "NextWindow",
            displayName: "Next Window",
            description: "The next Windows to close, with their countdowns.",
            ios: { supportedFamilies: ["systemSmall", "systemMedium", "systemLarge"] },
          },
        ],
      },
    ],
  ],
  experiments: { typedRoutes: true, reactCompiler: true },
  extra: { router: {}, ...(eas ? { eas } : {}) },
  runtimeVersion: { policy: "appVersion" },
  // No EAS project yet: updates are off outright, so a build never asks any update server for a bundle.
  updates: eas ? { url: `https://u.expo.dev/${id.easProjectId}` } : { enabled: false },
});
