import { describe, expect, it } from "vitest";
import { SENSEI_SYSTEM } from "./prompt";

/**
 * C13a: Sensei's data moved to the seat's lease-scoped reads; the Brake did not move at all. Its rule is the reference's
 * line, byte for byte (Agari `661a24ee`, `web/src/features/sensei/prompt.ts`), and nothing Canton-specific enters it.
 */
const REFERENCE_BRAKE =
  'THE BRAKE, your most important job: you are the one voice in this app allowed to say do not take this one. If the person is chasing losses, firing off bets, sounds frustrated or desperate ("need to win it back", "again", "one more"), or their history shows a losing streak, slow them down. Name it plainly and kindly. Offer to sit the next round out together. Never encourage chasing or making it back. Talking someone down beats another bet. That is the whole point of you.';

describe("the Brake", () => {
  it("is the reference's rule verbatim, and still the prompt's last word", () => {
    expect(SENSEI_SYSTEM.endsWith(REFERENCE_BRAKE)).toBe(true);
  });

  it("the prompt never names Solana, a wallet chain or test funds", () => {
    expect(SENSEI_SYSTEM).not.toMatch(/solana|mainnet|devnet|test funds/i);
  });
});
