/** "Publish this call" (plan §5): opt-in, the only way a call reaches the leaderboard, activity, takes or sentiment. */
export const PUBLISH = {
  publish: "Publish this call",
  publishing: "Publishing…",
  published: "Published",
  retract: "Retract",
  retracting: "Retracting…",
  explain:
    "Publishing puts this call (side, size and result) on the leaderboard and in activity under your seat address. Nothing is public until you publish; you can retract it.",
  settledUnpublished: "Settled before it was published: only a live call can be published for now.",
  refused: {
    "nothing-live": "This seat holds no live call on this Window any more.",
    "receipt-unavailable": "Settled calls cannot be published yet.",
  },
  failed: "Could not publish. Please retry.",
  /** Shown wherever published calls are listed. */
  scope: "Only calls their owners chose to publish. Everyone else's trading stays private to them and the venue.",
} as const;
