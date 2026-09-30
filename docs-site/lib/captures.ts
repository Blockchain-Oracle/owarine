type Annotation = { label: string; x: number; y: number; toX: number; toY: number };
type Capture = { title: string; file: string; alt: string; state: string; date: string; annotations?: Annotation[] };

/**
 * Screens of the Canton build, cropped from the local-sandbox evidence in `docs/evidence/ux/` (the source and crop of
 * each file are in `public/captures/provenance-canton-2026-09-30.json`). The top banner of each screen is cropped off.
 * Every one ran on a local Canton sandbox with the real venue operations; none is from a hosted deployment.
 */
function canton(title: string, file: string, alt: string, state: string, date: string): Capture {
  return { title, file: `${file}-canton.jpg`, alt, state, date };
}
const SEP29 = '29 September 2026';
const SEP30 = '30 September 2026';

export const captures = {
  markets: canton('A live Window before you take a seat', 'markets-seatless', 'Agari Markets at desktop width: the ETH 1-minute Window "ETH holds above $2,670.39?" with its opening print, a 4:24 countdown and an Up/Down ticket that asks the visitor to take a seat.', 'No seat; local Canton sandbox with the real venue operations; ETH 1-minute Window trading.', SEP29),
  phone: canton('The same Window on a phone', 'markets-phone-seatless', 'Agari Markets at a 390-pixel viewport: the ETH 1-minute Window, its opening print, the countdown and the Up 50¢ / Down 56¢ buttons, with Take a seat in the header.', 'No seat; 390-pixel viewport; local Canton sandbox.', SEP29),
  seatMenu: canton('The seat menu', 'seat-menu', 'The open seat menu over a live Window: Guest seat marked Yours, the leased party id, 14:45 of lease left, 1,000.00 demo cash, Portfolio and Reset seat.', 'A guest seat just leased and funded; local Canton sandbox; no call placed yet.', SEP29),
  demoCredits: canton('The demo-credits card', 'demo-credits', 'The Demo credits card: a seat trades with demo credits on a Canton test network, they have no cash value, the seat and its party, 995.41 demo credits, cash value None, and a note that credits are granted once per lease.', 'A leased seat after one call; local Canton sandbox; card opened from the header balance.', SEP29),
  portfolioBalance: canton('Your balance in credits', 'portfolio-balance', 'Portfolio balance card: 996.05 credits in all, 947.25 ready to bet, demo credits 947.25, one open position valued at the venue mid 48.80, nothing to collect, and the X replies and Trading Balance rows.', 'A leased seat holding one open BTC 5-minute position; local Canton sandbox.', SEP29),
  portfolioHistory: canton('History from receipts', 'portfolio-history-receipts', 'Portfolio History with six settled rounds: a Parlay, a Moonshot and a Range ticket marked Collected with receipt links, and three boosted positions: one cashed out for 7.50, one lost, one won 47.32.', 'A leased seat after its tickets settled; each row comes from a settlement receipt; local Canton sandbox.', SEP29),
  proofTimeline: canton('How a Window was decided', 'proof-timeline', 'A proof page timeline for a BTC 5-minute Window: the open print, the three oracle parties’ quotes with their ledger update ids, a median 0.01% apart against a 1.00% limit, and Resolved DOWN with its update id.', 'Public proof page, no seat; a Window resolved on the local Canton sandbox.', SEP29),
  shortOpen: canton('Open a short', 'short-open', 'The Short page: a picker of crypto, pre-IPO and basket names with prices, the 4h Window chosen with its Down price, the 2x or 3x multiple, one open ETH short with no bid to mark against, and a closed BTC short that won 47.32 credits back.', 'A leased seat with one open and one closed short; local Canton sandbox.', SEP29),
  earnMaker: canton('The maker vault', 'earn-maker-vault', 'Earn maker vault tab: 1.0004 per share, up 0.04% from launch, vault value 10,504.90 credits, utilization 0.1%, and the Windows table with 11 Down unpaired on one BTC 5-minute Window and two settled Windows at +0.54 and +4.61 credits.', 'No seat in the browser; supply and withdraw ran as seats through the venue’s routes; local Canton sandbox on abu-pm-main 0.5.0.', SEP30),
  earnRange: canton('The Range & Moonshot reserve', 'earn-range-supplied', 'Earn Range & Moonshot tab: 1.0009 per share, reserve value 10,059.92 credits, your position 49.99 credits as 49.95 shares, Withdraw all, and the reserve’s risk bounds.', 'A leased seat that supplied 50 credits; local Canton sandbox.', SEP29),
  strategyPublished: canton('A strategy published on Canton', 'strategy-published', 'A strategy just published: Published on Canton, Canton Drift, a link to the publication transaction, the three next steps and View your strategies.', 'A leased seat published a strategy; local Canton sandbox; no copy yet.', SEP30),
  strategyCopy: canton('Copying, and waiting on settlement', 'strategy-copying', 'A strategy drawer: You are copying this strategy, Copying enabled, the runner’s Operation · Awaiting settlement with a one-position limit reached, the copy or fade choice, and the seat’s 992.50 credits.', 'A second seat copying with a funded grant after the runner’s first fill; local Canton sandbox.', SEP30),
  deskPractice: canton('A practice desk', 'desk-practice', 'An AI Labs practice desk: Practice, no money moves, a total value of $1,000.00 in paper money, the next check at the top of the hour, and 1 of 6 practice checks done before Go live.', 'Practice desk of a leased seat; paper money; local Canton sandbox.', SEP30),
  deskPaused: canton('A live desk, paused by its owner', 'desk-live-paused', 'An AI Labs live desk marked Paused by you, with Add money, Withdraw, Resume and Check now; the value line reads $50.00 after the 50-credit deposit and still carries the practice record.', 'A live DeskMandate funded with 50 demo credits and paused by the owner; it has not traded; local Canton sandbox.', SEP30),
} as const satisfies Record<string, Capture>;

export type CaptureName = keyof typeof captures;
