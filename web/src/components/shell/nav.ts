import {
  Activity, BadgeCheck, BarChart3, BookOpen, Bot, Boxes, Briefcase, CandlestickChart, ChartCandlestick, ChartLine,
  ChartNoAxesCombined, CircleHelp, CirclePlus, Dices, Download, GalleryVerticalEnd, Gamepad2, Goal, Handshake, Inbox,
  KeyRound, Layers3, MessageSquare, Mountain, Newspaper, Presentation, Rocket, Scale, ScanSearch, Sparkles, TrendingDown, Trophy,
  WalletCards, X as XLogo, type LucideIcon,
} from "lucide-react";
import { DOCS_URL } from "../../lib/docs-url";

/**
 * Owarine's one navigation source (Stage B1): the rail, the phone dock, ⌘K, More, the games hub and the phone app all
 * read it. Six places carry a number key (1–6, roy-chain's map); every other page lives in More, grouped, so nothing in
 * the product is unreachable and nothing is listed twice.
 */
export type NavItem = {
  id: string;
  name: string;
  /** A shorter name for the phone dock, when the full one does not fit under its icon. */
  short?: string;
  href: string;
  /** One short line: what you do there (tooltips, ⌘K, More). */
  description: string;
  icon: LucideIcon;
  /** The number key that jumps here; places only. */
  digit?: string;
  external?: boolean;
  beta?: boolean;
  /** Which paths count as "here"; by default the href and everything under it. */
  match?: { paths: readonly string[]; exact?: boolean };
};

export type NavSection = {
  id: string;
  name: string;
  items: readonly NavItem[];
};

export const NAV_ITEMS = {
  trade: {
    id: "trade",
    name: "Trade",
    href: "/trade/BTC",
    description: "One tap Up or Down on a live chart.",
    icon: CandlestickChart,
    digit: "1",
    match: { paths: ["/trade"] },
  },
  markets: {
    id: "markets",
    name: "Markets",
    href: "/markets",
    description: "Every live Window, stock and event.",
    icon: ChartLine,
    digit: "2",
    match: { paths: ["/markets", "/tickers"] },
  },
  portfolio: {
    id: "portfolio",
    name: "Portfolio",
    href: "/portfolio",
    description: "Your money, positions and record.",
    icon: WalletCards,
    digit: "3",
    match: { paths: ["/portfolio"], exact: true },
  },
  games: {
    id: "games",
    name: "Games",
    href: "/games",
    description: "Play every market-powered game.",
    icon: Gamepad2,
    digit: "4",
  },
  automate: {
    id: "automate",
    name: "Automate",
    href: "/strategies",
    description: "Strategies, agents and desks that trade for you.",
    icon: Sparkles,
    digit: "5",
    match: { paths: ["/strategies", "/agents", "/desk"] },
  },
  leaderboard: {
    id: "leaderboard",
    name: "Leaderboard",
    short: "Ranks",
    href: "/leaderboard",
    description: "The strongest verified records.",
    icon: Trophy,
    digit: "6",
    match: { paths: ["/leaderboard", "/u"] },
  },

  practice: {
    id: "practice",
    name: "Practice",
    href: "/games/practice",
    description: "Learn the swipe loop without stakes.",
    icon: Goal,
    match: { paths: ["/games/practice"], exact: true },
  },
  duel: {
    id: "duel",
    name: "Duel",
    href: "/games/duel",
    description: "Face another player over a live deck.",
    icon: Handshake,
    match: { paths: ["/games/duel"], exact: true },
  },
  lucky: {
    id: "lucky",
    name: "Lucky",
    href: "/games/lucky",
    description: "Let the reel find a live market call.",
    icon: Dices,
    match: { paths: ["/games/lucky"], exact: true },
  },
  range: {
    id: "range",
    name: "Range",
    href: "/games/range",
    description: "Pick the band where price should finish.",
    icon: Layers3,
    match: { paths: ["/games/range"], exact: true },
  },
  moonshot: {
    id: "moonshot",
    name: "Moonshot",
    href: "/games/moonshot",
    description: "Aim for a distant price target.",
    icon: Rocket,
    match: { paths: ["/games/moonshot"], exact: true },
  },
  lineRider: {
    id: "line-rider",
    name: "Line Rider",
    href: "/games/line-rider",
    description: "Ride the line and build a combo.",
    icon: ChartNoAxesCombined,
    match: { paths: ["/games/line-rider"], exact: true },
  },
  candleHop: {
    id: "candle-hop",
    name: "Candle Hop",
    href: "/games/candle-hop",
    description: "Hop through a candlestick run.",
    icon: Mountain,
    match: { paths: ["/games/candle-hop"], exact: true },
  },

  baskets: {
    id: "baskets",
    name: "Baskets",
    href: "/baskets",
    description: "Bet on a small group of pre-IPO companies together.",
    icon: Boxes,
  },
  short: {
    id: "short",
    name: "Short",
    href: "/short",
    description: "Sell a stock's fall, and manage the position.",
    icon: TrendingDown,
  },
  parlay: {
    id: "parlay",
    name: "Parlay",
    href: "/parlay",
    description: "Combine several market outcomes.",
    icon: ChartNoAxesCombined,
  },
  sensei: {
    id: "sensei",
    name: "Sensei",
    href: "/markets?sensei=1",
    description: "Ask the market assistant.",
    icon: MessageSquare,
    match: { paths: [] },
  },
  xTrade: {
    id: "x-trade",
    name: "X-trade",
    href: "/trade-from-x",
    description: "Turn a post into a bounded trade.",
    icon: XLogo,
  },

  agents: { id: "agents", name: "Agents", href: "/agents", description: "Manage automated market agents.", icon: Bot },
  desk: {
    id: "desk",
    name: "Desk",
    href: "/desk",
    description: "Hold a basket of pre-IPO names under your rules.",
    icon: Briefcase,
    match: { paths: ["/desk"] },
  },
  newDesk: {
    id: "new-desk",
    name: "Create a desk",
    href: "/desk/new",
    description: "Pick a basket, set its limits, start in practice.",
    icon: CirclePlus,
    match: { paths: ["/desk/new"], exact: true },
  },

  activity: { id: "activity", name: "Activity", href: "/activity", description: "Your fills, verdicts and payouts.", icon: Inbox },
  proof: {
    id: "proof",
    name: "Print proof",
    href: "/proof",
    description: "Every settled Window and the signed prints that decided it.",
    icon: BadgeCheck,
  },
  edge: {
    id: "edge",
    name: "Trader Edge",
    href: "/portfolio/edge",
    description: "Review your trading edge report.",
    icon: ChartCandlestick,
  },
  stats: { id: "stats", name: "Stats", href: "/stats", description: "Protocol and market activity.", icon: BarChart3 },
  surface: {
    id: "surface",
    name: "Market Surface",
    href: "/surface",
    description: "Read the market structure at a glance.",
    icon: ScanSearch,
  },

  news: { id: "news", name: "News", href: "/news", description: "The stories moving markets.", icon: Newspaper },
  reels: { id: "reels", name: "Reels", href: "/reels", description: "Scan market stories quickly.", icon: GalleryVerticalEnd },
  howItWorks: {
    id: "how-it-works",
    name: "How it works",
    href: "/how-it-works",
    description: "The product from end to end.",
    icon: CircleHelp,
  },
  docs: { id: "docs", name: "Docs", href: DOCS_URL, external: true, description: "Step-by-step guides.", icon: BookOpen },
  download: { id: "download", name: "Download", href: "/download", description: "Install Owarine on your phone.", icon: Download },
  status: { id: "status", name: "Status", href: "/status", description: "Every service Owarine runs on, live.", icon: Activity },
  pitch: { id: "pitch", name: "Pitch", href: "/pitch", description: "The Owarine thesis in a few slides.", icon: Presentation },
  legal: { id: "legal", name: "Legal", href: "/legal", description: "Terms, risks and disclosures.", icon: Scale },
  xRecovery: {
    id: "x-recovery",
    name: "X recovery",
    href: "/claim",
    description: "Recover a trade created from X.",
    icon: KeyRound,
  },
} as const satisfies Record<string, NavItem>;

/** The six places, in rail order; each one's `digit` jumps to it. */
export const PLACES: readonly NavItem[] = [
  NAV_ITEMS.trade,
  NAV_ITEMS.markets,
  NAV_ITEMS.portfolio,
  NAV_ITEMS.games,
  NAV_ITEMS.automate,
  NAV_ITEMS.leaderboard,
];

/** The phone dock: two places either side of the seal, then More. */
export const DOCK: { left: readonly NavItem[]; right: readonly NavItem[] } = {
  left: [NAV_ITEMS.trade, NAV_ITEMS.markets],
  right: [NAV_ITEMS.portfolio],
};

/** Everything that is not a place, grouped. The first section is what most people open More for. */
export const MORE: readonly NavSection[] = [
  { id: "trade", name: "More ways to trade", items: [NAV_ITEMS.baskets, NAV_ITEMS.short, NAV_ITEMS.parlay, NAV_ITEMS.sensei, NAV_ITEMS.xTrade] },
  { id: "learn", name: "Learn", items: [NAV_ITEMS.news, NAV_ITEMS.howItWorks, NAV_ITEMS.download, NAV_ITEMS.reels, NAV_ITEMS.docs, NAV_ITEMS.pitch] },
  { id: "games", name: "Games", items: [NAV_ITEMS.practice, NAV_ITEMS.duel, NAV_ITEMS.lucky, NAV_ITEMS.range, NAV_ITEMS.moonshot, NAV_ITEMS.lineRider, NAV_ITEMS.candleHop] },
  { id: "automate", name: "Automate", items: [NAV_ITEMS.agents, NAV_ITEMS.desk, NAV_ITEMS.newDesk] },
  { id: "records", name: "Records and proof", items: [NAV_ITEMS.proof, NAV_ITEMS.activity, NAV_ITEMS.edge, NAV_ITEMS.stats, NAV_ITEMS.surface] },
  { id: "about", name: "About", items: [NAV_ITEMS.status, NAV_ITEMS.legal, NAV_ITEMS.xRecovery] },
];

export const MORE_ITEMS: readonly NavItem[] = MORE.flatMap((section) => section.items);

/** Every real, user-facing page; each must have a home in PLACES or MORE (the nav test holds this). */
export const NAVIGABLE_ROUTE_PATHS = [
  "/activity", "/agents", "/baskets", "/claim", "/desk", "/desk/new",
  "/download", "/games", "/games/candle-hop", "/games/duel", "/games/line-rider",
  "/games/lucky", "/games/moonshot", "/games/practice", "/games/range", "/how-it-works", "/leaderboard", "/legal",
  "/markets", "/news", "/parlay", "/pitch", "/portfolio", "/portfolio/edge", "/proof", "/reels", "/short", "/stats",
  "/status", "/strategies", "/surface", "/trade/BTC", "/trade-from-x",
] as const;

export function isActiveNavItem(pathname: string | null, item: NavItem): boolean {
  if (!pathname || item.external) return false;
  const fallbackPath = item.href.split("?")[0] ?? item.href;
  const match = item.match ?? { paths: [fallbackPath] };
  return match.paths.some((path) => pathname === path || (!match.exact && pathname.startsWith(`${path}/`)));
}

/** The trading screen fills the stage edge to edge and never scrolls the page (Tradash's one screen). */
export function isTradeRoute(pathname: string | null): boolean {
  return pathname === "/trade" || !!pathname?.startsWith("/trade/");
}

/** The place the page belongs to, for the rail's active pill; null on a More page. */
export function placeOf(pathname: string | null): NavItem | null {
  return PLACES.find((item) => isActiveNavItem(pathname, item)) ?? null;
}
