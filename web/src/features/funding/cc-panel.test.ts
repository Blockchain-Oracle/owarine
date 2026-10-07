import type { CcRailReply } from "@owarine/markets";
import { describe, expect, it } from "vitest";
import { ccPanel, depositAmount, withdrawUnits } from "./cc-panel";

const listing = { listingId: "cc-1", instrumentAdmin: "dso::1", instrumentId: "Amulet", unitsPerCoin: "100000", minDepositUnits: "100000", maxDepositUnits: "1000000000", depositsOpen: true };
const view = (o: Partial<CcRailReply> = {}): CcRailReply => ({
  capability: "live", reason: null, listing, allowanceUnits: "0", cashUnits: "0", holdings: [], deposits: [], withdrawals: [], proposals: [], reserve: null, ...o,
});

describe("the Canton Coin panel (C7b)", () => {
  it("while not-live says so, offers nothing and invents no figure, whatever the server read", () => {
    const p = ccPanel({ capability: "not-live", view: view({ allowanceUnits: "999999999", cashUnits: "999999999" }) });
    expect(p).toMatchObject({ tone: "not-live", badge: "Not live", canDeposit: false, canWithdraw: false, maxWithdrawUnits: 0n, step: null });
    const text = [p.headline, ...p.lines].join(" ");
    expect(text).toMatch(/not live/i);
    expect(text).toMatch(/Waiting on a DevNet run/);
    expect(text).not.toMatch(/999|Fixed rate/);
    expect(ccPanel({ capability: "not-live", view: null }).tone).toBe("not-live");
  });

  it("when live, states the listing's fixed rate and the exact step, and only what the seat can take back", () => {
    const p = ccPanel({ capability: "live", view: view({ allowanceUnits: "500000", cashUnits: "300000", holdings: [{ instrumentAdmin: "dso::1", instrumentId: "Amulet", unlockedAtomic: "125000000000", lockedAtomic: "0" }] }) });
    expect(p).toMatchObject({ tone: "ready", canDeposit: true, canWithdraw: true, maxWithdrawUnits: 300_000n, step: "0.00001" });
    const text = p.lines.join("\n");
    expect(text).toContain("Fixed rate: 1 Canton Coin = 0.10 credits");
    expect(text).toContain("steps of 0.00001 Canton Coin");
    expect(text).toContain("between 1 and 10000 Canton Coin");
    expect(text).toContain("up to 0.50 credits");
    expect(text).toContain("holds 12.5 Canton Coin");
  });

  it("caps a withdrawal at the smaller of the allowance and the cash, and at nothing while an ask waits", () => {
    expect(ccPanel({ capability: "live", view: view({ allowanceUnits: "100", cashUnits: "900" }) }).maxWithdrawUnits).toBe(100n);
    expect(ccPanel({ capability: "live", view: view({ allowanceUnits: "900", cashUnits: "100" }) }).maxWithdrawUnits).toBe(100n);
    const waiting = ccPanel({ capability: "live", view: view({ allowanceUnits: "900", cashUnits: "900", proposals: [{ units: "5", ref: "r" }] }) });
    expect(waiting).toMatchObject({ canWithdraw: false, maxWithdrawUnits: 0n });
    expect(waiting.lines.join(" ")).toContain("with the venue");
  });

  it("says covered or not covered from the venue's own statement, never decides it", () => {
    const covered = ccPanel({ capability: "live", view: view({ reserve: { covered: true, asOfSec: 1, heldUnits: "600000", liabilityUnits: "500000" } }) });
    expect(covered.lines.join(" ")).toContain("holds 0.60 credits of coin against 0.50 owed. Covered.");
    const short = ccPanel({ capability: "live", view: view({ reserve: { covered: false, asOfSec: 1, heldUnits: "100000", liabilityUnits: "500000" } }) });
    expect(short.lines.join(" ")).toContain("Not covered");
    expect(ccPanel({ capability: "live", view: view() }).lines.join(" ")).toContain("has not published a reserve statement");
  });

  it("is honest about an unlisted or closed venue", () => {
    expect(ccPanel({ capability: "live", view: view({ listing: null }) })).toMatchObject({ tone: "unlisted", canDeposit: false, headline: "The venue has not listed Canton Coin yet." });
    const closed = ccPanel({ capability: "live", view: view({ listing: { ...listing, depositsOpen: false }, allowanceUnits: "10", cashUnits: "10" }) });
    expect(closed).toMatchObject({ tone: "closed", canDeposit: false, canWithdraw: true });
  });
});

describe("what a typed amount sends", () => {
  it("rounds a deposit DOWN to the step and says it did, and refuses what is not an amount", () => {
    expect(depositAmount("12.5", "100000")).toEqual({ amount: "12.5", changed: false });
    expect(depositAmount("1.000019", "100000")).toEqual({ amount: "1.00001", changed: true });
    expect(depositAmount("0.000001", "100000")).toBeNull();
    expect(depositAmount("", "100000")).toBeNull();
    expect(depositAmount("1e3", "100000")).toBeNull();
    expect(depositAmount("-1", "100000")).toBeNull();
    expect(depositAmount("1.00000000001", "100000")).toBeNull();
  });

  it("converts credits to take back into cash units and the coin they are worth, within the cap", () => {
    const cap = { maxWithdrawUnits: 500_000n };
    expect(withdrawUnits("0.4", cap, "100000")).toEqual({ units: 400_000n, coin: "4" });
    expect(withdrawUnits("0.5", cap, "100000")).toEqual({ units: 500_000n, coin: "5" });
    expect(withdrawUnits("0.500001", cap, "100000")).toBeNull();
    expect(withdrawUnits("0", cap, "100000")).toBeNull();
    expect(withdrawUnits("abc", cap, "100000")).toBeNull();
    expect(withdrawUnits("0.0000001", cap, "100000")).toBeNull();
  });
});
