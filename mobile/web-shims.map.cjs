// The web and markets files the app swaps for its own stand-ins in src/web-shims, by exact path (repo-relative).
// Metro (metro.config.js) resolves whoever imports the left path to the right one. Kept free of dependencies so the
// `mobile-shim-paths` invariant can read the very list Metro uses: a web split that moves or renames a left-hand
// file would otherwise bundle the browser version silently (it crashes at runtime while tsc stays green), so the
// map changes in the same commit as the split.
module.exports = [
  ["web/src/lib/env.ts", "mobile/src/web-shims/env.ts"],
  ["web/src/lib/visibility.ts", "mobile/src/web-shims/visibility.ts"],
  ["web/src/lib/toast.ts", "mobile/src/web-shims/toast.ts"],
  ["web/src/features/funding/credited.ts", "mobile/src/web-shims/credited.ts"],
  ["web/src/lib/url-state.ts", "mobile/src/web-shims/url-state.ts"],
  ["web/src/providers/wallet/mainnet-signer.ts", "mobile/src/web-shims/mainnet-signer.ts"],
  ["web/src/features/session/SessionKeyProvider.tsx", "mobile/src/web-shims/session-key-provider.tsx"],
  ["web/src/features/games/duel/useGameKey.ts", "mobile/src/web-shims/game-key.ts"],
  ["packages/markets/src/runtime/page.ts", "mobile/src/web-shims/page.ts"],
];
