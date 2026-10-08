import type { Address } from "@owarine/core/types";
import type { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { invalidateAfterWrite } from "./invalidate";
import { keys } from "./keys";

const wallet = "audit-seat" as Address;

describe("confirmed write refresh", () => {
  it("refreshes product views without letting a stalled ticket read delay the trade", async () => {
    const invalidateQueries = vi.fn(({ queryKey }) =>
      queryKey[2] === "parlays" ? new Promise<void>(() => undefined) : Promise.resolve(),
    );
    await invalidateAfterWrite({ invalidateQueries } as unknown as QueryClient, { wallet });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: keys.parlays(wallet) });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: keys.balanceSheet(wallet) });
  });

  it("waits for spendable balances before releasing the next write", async () => {
    let finish!: () => void;
    const balance = new Promise<void>((resolve) => { finish = resolve; });
    const invalidateQueries = vi.fn(({ queryKey }) => queryKey[2] === "balanceSheet" ? balance : Promise.resolve());
    let ready = false;
    const pending = invalidateAfterWrite({ invalidateQueries } as unknown as QueryClient, { wallet }).then(() => { ready = true; });
    await Promise.resolve();
    expect(ready).toBe(false);
    finish();
    await pending;
    expect(ready).toBe(true);
  });
});
