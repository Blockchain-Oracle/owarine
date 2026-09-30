import { describe, expect, it } from "vitest";
import { toMarketId, type EventMarket } from "../types";
import { actionHeaders, windowAction, windowShareAction } from "./actions";
import { readWindowShare, shareKeyFrom, signWindowShare, windowShareUrl, type WindowShare } from "./share-link";

/** C13a: Blinks on Canton answer with a signed Window share link; no transaction and no chain id anywhere. */
const at = (minute: number, second = 0) => Date.UTC(2026, 8, 10, 8, minute, second);
const ID = toMarketId("9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin");
const market = (over: Partial<EventMarket> = {}) => ({ marketId: ID, asset: "TSLA", lane: "regular", intervalSec: 300, decimals: 6,
  tradingStartSec: at(20) / 1000, lockAtSec: at(25) / 1000, expirySec: at(25) / 1000, openingPriceRaw: 1n,
  status: "Trading", voided: false, finalized: false, ...over }) as EventMarket;
const KEY = shareKeyFrom("s".repeat(32));
const ORIGIN = "https://useagari.xyz";

function linkOf(share: WindowShare, key = KEY): URL {
  return new URL(windowShareUrl(ORIGIN, share, signWindowShare(key, share)));
}
const read = (url: URL, nowSec: number, key = KEY) => readWindowShare(key, ID, (n) => url.searchParams.get(n), nowSec);

describe("signed Window share link", () => {
  const share: WindowShare = { marketId: ID, side: "up", stakeBase: 5_000_000n, expiresSec: at(25) / 1000 };

  it("opens the Window's own page with the side, and its stake verifies until the Window closes", () => {
    const url = linkOf(share);
    expect(url.pathname).toBe(`/markets/${ID}`);
    expect(url.searchParams.get("dir")).toBe("up");
    expect(read(url, at(21) / 1000)).toEqual(share);
    expect(read(url, at(25) / 1000)).toBeNull();
  });

  it("loses its stake when anything is edited by hand, or when signed under another key", () => {
    for (const [name, value] of [["dir", "down"], ["stake", "50000000"], ["exp", String(at(59) / 1000)]] as const) {
      const url = linkOf(share);
      url.searchParams.set(name, value);
      expect(read(url, at(21) / 1000)).toBeNull();
    }
    expect(readWindowShare(KEY, toMarketId("US517G5965aydkZ46HS38QLi7UQiSojurfbQfKCELFx"), (n) => linkOf(share).searchParams.get(n), at(21) / 1000)).toBeNull();
    expect(read(linkOf(share, shareKeyFrom("t".repeat(32))), at(21) / 1000)).toBeNull();
    const plain = new URL(`${ORIGIN}/markets/${ID}?dir=up`);
    expect(read(plain, at(21) / 1000)).toBeNull();
  });

  it("the key is derived, never the secret itself", () => {
    expect(Buffer.from(KEY).toString("utf8")).not.toContain("s".repeat(32));
    expect(KEY).toHaveLength(32);
  });
});

describe("the card and its POST", () => {
  it("keeps the reference's card with Up and Down amount fields, now as links", () => {
    const card = windowAction({ market: market(), icon: `${ORIGIN}/icons/icon-512.png`, basePath: `${ORIGIN}/api/actions/w/${ID}`, nowMs: at(21) });
    expect(card.links?.actions.map((a) => [a.type, a.label, a.parameters?.[0]?.name])).toEqual([["external-link", "Up", "stake"], ["external-link", "Down", "stake"]]);
  });

  it("answers a live Window with a signed link to its ticket", () => {
    const built = windowShareAction({ market: market(), side: "down", stakeBase: 2_000_000n, origin: ORIGIN, key: KEY, nowMs: at(21) });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.response.type).toBe("external-link");
    const url = new URL(built.response.externalLink);
    expect(read(url, at(21) / 1000)).toEqual({ marketId: ID, side: "down", stakeBase: 2_000_000n, expiresSec: at(25) / 1000 });
    expect(built.response.message).toContain("Nothing is placed until you confirm it.");
  });

  it("refuses a closed Window and a stake under the floor with the X reply's words", () => {
    expect(windowShareAction({ market: market(), side: "up", stakeBase: 2_000_000n, origin: ORIGIN, key: KEY, nowMs: at(24, 45) })).toMatchObject({ ok: false, code: "window-entry-closed" });
    expect(windowShareAction({ market: market(), side: "up", stakeBase: 1n, origin: ORIGIN, key: KEY, nowMs: at(21) })).toMatchObject({ ok: false, code: "instruction-invalid" });
  });

  it("sends no chain id and no Actions version header", () => {
    const headers = actionHeaders();
    expect(Object.keys(headers).join(" ")).not.toMatch(/blockchain|action-version/i);
    expect(JSON.stringify(headers)).not.toMatch(/solana/i);
    expect(headers["Access-Control-Allow-Origin"]).toBe("*");
  });
});
