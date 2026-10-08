/** "Share on public board" (plan §5): opt-in, the only way a call reaches the leaderboard, activity, takes or sentiment. */
export const PUBLISH = {
  publish: "Share on public board",
  publishing: "Publishing…",
  published: "Published",
  retract: "Retract",
  retracting: "Retracting…",
  explain:
    "Share this call’s side, size and result under your seat address on the public board and public activity. Your personal Activity already records it. You can retract this public share.",
  settledUnpublished: "Publishing settled calls is unavailable on this server.",
  refused: {
    "nothing-live": "This seat holds no live call on this Window any more.",
    "receipt-unavailable": "No settlement receipt is available for this call yet.",
  },
  failed: "Could not publish. Please retry.",
  /** Shown wherever published calls are listed. */
  scope: "Only calls their owners chose to publish. Everyone else's trading stays private to them and the venue.",
} as const;
