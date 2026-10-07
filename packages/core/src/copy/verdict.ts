export type VerdictOutcome = "win" | "loss" | "void";

export interface VerdictStrings {
  kanji: string;
  romaji: string;
  translation: string;
  /** The subline printed under the stamp. */
  line: string;
}

const VERDICTS: Record<VerdictOutcome, VerdictStrings> = {
  win: { kanji: "的中", romaji: "tekichū", translation: "called it", line: "tekichū — you called it." },
  loss: { kanji: "外れ", romaji: "hazure", translation: "missed", line: "hazure — it missed." },
  void: { kanji: "無効", romaji: "mukō", translation: "void", line: "no reliable print — both sides get their stake and fee back" },
};

export function verdictStrings(outcome: VerdictOutcome): VerdictStrings {
  return VERDICTS[outcome];
}

/** The one-time screen-reader announcement for a Verdict; `pnlText` is already signed and formatted. */
export function verdictAnnouncement(outcome: VerdictOutcome, pnlText: string): string {
  switch (outcome) {
    case "win":
      return `Tekichū — you called it. Won ${pnlText}.`;
    case "loss":
      return `Hazure — it missed. Lost ${pnlText}.`;
    case "void":
      return `Void — no reliable print, both sides get their stake and fee back. Returned ${pnlText}.`;
  }
}
