import { formatCadence } from "../copy";
import { phase, type MarketPhase } from "../lifecycle";
import { minStakeBase } from "../sizing";
import type { EventMarket } from "../types";
import { formatBaseUnits } from "../units";
import { X_REFUSAL_DETAILS } from "./refusal";
import type { XRefusalCode } from "./receipt";
import { signWindowShare, windowShareUrl, type WindowShare } from "./share-link";

/**
 * Blinks on Canton (S11, adapted in C13a per the plan's "Social, X and share"): the same card wire as the reference's
 * Actions, answered with a signed Window share link instead of a transaction.
 *
 * The reference's Blink was a link a Solana wallet unfurled into a signable transaction. Canton has no such wallet
 * protocol, and a seat trades only through its own lease, so the URLs stay (`/actions.json`, `/api/actions/w/<id>`,
 * `/api/actions/t/<symbol>/<cadence>`) and so does the card: a client `GET`s the metadata and renders Up and Down,
 * each with its amount field. Each is now an `external-link` action: the `POST` answers `{ type: "external-link",
 * externalLink }`, a link the venue signs (`share-link.ts`) that opens this Window's ticket with that side and stake,
 * on the web or in the app. No chain id travels in any header.
 *
 * Refusal copy is never invented here: a Blink that cannot trade says exactly what an X reply would say, out of
 * `X_REFUSAL_DETAILS`. One vocabulary, three surfaces.
 */

export type ActionType = "action" | "completed";

/** The spec's linked-action kinds; on Canton Owarine only returns `external-link` (C13a). */
export type LinkedActionType = "transaction" | "message" | "post" | "external-link" | "inline-link";

export type ActionParameterType =
  | "text" | "email" | "url" | "number" | "date"
  | "datetime-local" | "checkbox" | "radio" | "textarea" | "select";

export interface ActionError {
  message: string;
}

export interface ActionParameter {
  name: string;
  type?: ActionParameterType;
  label?: string;
  required?: boolean;
  min?: string | number;
  max?: string | number;
  pattern?: string;
  patternDescription?: string;
}

export interface LinkedAction {
  type: LinkedActionType;
  href: string;
  label: string;
  parameters?: readonly ActionParameter[];
}

export interface ActionGetResponse {
  type: ActionType;
  icon: string;
  title: string;
  description: string;
  label: string;
  disabled?: boolean;
  links?: { actions: readonly LinkedAction[] };
  error?: ActionError;
}

/** What a card client may send. A share link names no one, so `account`, if a client sends one, is ignored. */
export interface ActionPostRequest {
  account?: string;
}

/** The link the viewer follows: the signed Window share link (C13a). */
export interface ActionPostResponse {
  type: "external-link";
  externalLink: string;
  message?: string;
}

export interface ActionRuleObject {
  pathPattern: string;
  apiPath: string;
}

export interface ActionsJson {
  rules: readonly ActionRuleObject[];
}

/**
 * Every Action response carries these. `Access-Control-Allow-Origin: *` stays: a card is read by clients on domains we
 * do not control, which is the whole point of a Blink. There is no chain id or Actions version header: nothing here
 * is signed by a wallet (C13a).
 */
export function actionHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Content-Encoding, Accept-Encoding",
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  };
}

/** A phase that cannot take an order, mapped to the same public code an X reply would use. */
export function actionRefusalOf(p: MarketPhase): XRefusalCode | null {
  if (p === "trading") return null;
  if (p === "pendingOpeningPrint") return "opening-price-pending";
  if (p === "upcoming") return "window-not-started";
  if (p === "noEntryBuffer" || p === "locked") return "window-entry-closed";
  return "no-window";
}

const UTC = (sec: number) => `${new Date(sec * 1000).toISOString().slice(11, 16)} UTC`;

export function windowActionTitle(market: Pick<EventMarket, "asset" | "intervalSec">): string {
  return `${market.asset} · ${formatCadence(market.intervalSec)} Window`;
}

/**
 * What the card says before anyone signs: the exact question, when it is answered, and where the answer comes from.
 * A Blink is read by people who have never seen the app, so it names the settlement source rather than assuming it.
 */
export function windowActionDescription(market: Pick<EventMarket, "asset" | "expirySec" | "decimals">): string {
  const floor = formatBaseUnits(minStakeBase(market.decimals), market.decimals);
  return `Up or Down on ${market.asset} at the ${UTC(market.expirySec)} close, settled from a signed price print. `
    + `Your stake is the most you can lose. Minimum ${floor} credits.`;
}

/** Two buttons, each with its own amount field: the side is in the path, the stake is the viewer's; each opens a link. */
export function windowActionLinks(market: Pick<EventMarket, "marketId" | "decimals">, basePath: string): readonly LinkedAction[] {
  const floor = formatBaseUnits(minStakeBase(market.decimals), market.decimals);
  const stake = (label: string): ActionParameter => ({ name: "stake", type: "number", label, required: true, min: floor });
  return [
    { type: "external-link", href: `${basePath}?side=up&stake={stake}`, label: "Up", parameters: [stake("credits on Up")] },
    { type: "external-link", href: `${basePath}?side=down&stake={stake}`, label: "Down", parameters: [stake("credits on Down")] },
  ];
}

export interface WindowActionInput {
  market: EventMarket;
  /** Absolute, so a client on another domain can load it: the spec requires an SVG, PNG or WebP URL. */
  icon: string;
  /** The Action's own path, e.g. `/api/actions/w/<marketId>`. */
  basePath: string;
  nowMs: number;
}

/**
 * One Window as a Blink. A Window that cannot be entered still renders — `disabled`, with the reason — because a
 * shared link outlives its Window, and a card that explains itself beats a card that 404s.
 */
export function windowAction({ market, icon, basePath, nowMs }: WindowActionInput): ActionGetResponse {
  const refusal = actionRefusalOf(phase(market, nowMs));
  const base = {
    type: "action" as const,
    icon,
    title: windowActionTitle(market),
    description: windowActionDescription(market),
  };
  if (refusal) return { ...base, label: "Closed", disabled: true, error: { message: X_REFUSAL_DETAILS[refusal] } };
  return { ...base, label: "Make a call", links: { actions: windowActionLinks(market, basePath) } };
}

export type WindowShareAction = { ok: true; response: ActionPostResponse; share: WindowShare } | { ok: false; code: XRefusalCode; message: string };

/**
 * The `POST` of one Window's card: the same checks the reference ran before building a transaction (the Window takes
 * calls now; the stake is at least the floor), then the signed link to that Window's ticket, good until the Window
 * closes. A refusal carries the X reply's words.
 */
export function windowShareAction(i: { market: EventMarket; side: "up" | "down"; stakeBase: bigint; origin: string; key: Uint8Array; nowMs: number }): WindowShareAction {
  const refusal = actionRefusalOf(phase(i.market, i.nowMs));
  if (refusal) return { ok: false, code: refusal, message: X_REFUSAL_DETAILS[refusal] };
  if (i.stakeBase < minStakeBase(i.market.decimals)) return { ok: false, code: "instruction-invalid", message: `The minimum is ${formatBaseUnits(minStakeBase(i.market.decimals), i.market.decimals)} credits.` };
  const share: WindowShare = { marketId: i.market.marketId, side: i.side, stakeBase: i.stakeBase, expiresSec: i.market.expirySec };
  const externalLink = windowShareUrl(i.origin, share, signWindowShare(i.key, share));
  const sideWord = i.side === "up" ? "Up" : "Down";
  const message = `Opens the ${windowActionTitle(i.market)} ticket on ${sideWord} with ${formatBaseUnits(i.stakeBase, i.market.decimals)} credits. Nothing is placed until you confirm it.`;
  return { ok: true, share, response: { type: "external-link", externalLink, message } };
}
