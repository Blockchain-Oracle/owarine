import { usePortfolioTokens } from "~/components/portfolio/web";

export interface PlateInk {
  paper: string;
  raised: string;
  ink: string;
  mute: string;
  line: string;
  figure: string;
  wallet: string;
  /** C7a: open positions at the mid (`.lp-bar-positions`). */
  positions: string;
  account: string;
}

/**
 * web `ledger-plate.css` --lp-*: the plate owns four tokens — paper, ink, muted ink, line — the theme's surface-1 and
 * inks in dark, the reference's cream (#FAF9F5, #171515, #656359) in light. Everything on the plate (pool rows, the
 * X card, the Trading Balance panel) reads these, so one card never shows two backgrounds.
 */
export function usePlateInk(): PlateInk {
  const t = usePortfolioTokens();
  return { paper: t.lpPaper, raised: t.lpPaperRaised, ink: t.lpInk, mute: t.lpMute, line: t.lpLine, figure: t.signal, wallet: t.signal, positions: t.barPositions, account: t.barAccount };
}
