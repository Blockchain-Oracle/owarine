/**
 * The house runner a creator picks with "Let Owarine run it". On Canton it is a party (C8f, K-087): the parties file's
 * `agent-runner`, which web reads on its server (web/src/app/strategies/page.tsx). No API carries it to the app yet,
 * so the app is configured with the same party at build time (`EXPO_PUBLIC_STRATEGY_RUNNER_PARTY`); an unset or
 * malformed value leaves only "Run your own bot", exactly as web does without one.
 */
const PARTY_ID = /^[A-Za-z0-9_\-:.]{1,255}::[0-9a-f]{8,}$/;
const configured = (process.env.EXPO_PUBLIC_STRATEGY_RUNNER_PARTY ?? process.env.EXPO_PUBLIC_STRATEGY_RUNNER_ADDRESS)?.trim() ?? "";

export const HOUSE_RUNNER: string | null = configured && PARTY_ID.test(configured) ? configured : null;
