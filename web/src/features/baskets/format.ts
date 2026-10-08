/** "2 h" from 90 min up, "35 min" below: the window a basket's movement was measured over, in the reader's units. */
export function windowText(sec: number): string {
  const minutes = Math.round(sec / 60);
  return minutes >= 90 ? `${Math.round(minutes / 60)} h` : `${minutes} min`;
}

/** Basis points as a tenth-of-a-percent text, unsigned ("2.3%"). */
export const bpsPct = (bps: number): string => `${(Math.abs(bps) / 100).toFixed(1)}%`;
