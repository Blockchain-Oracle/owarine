import { AGENT_TEMPLATE_IDS } from "@agari/daml";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ readActive: vi.fn(), submit: vi.fn() }));
vi.mock("@agari/markets/ops/canton", async (original) => ({ ...(await original<object>()), readActive: mocks.readActive, submit: mocks.submit }));

import { handleEnrol } from "./enrol";

const VENUE = "venue::1220aaaaaaaa";
const SEAT = "seat-1::1220bbbbbbbb";
const venue = { role: "venue", party: VENUE, client: {} as never, dryRun: false };
const contract = (templateId: string, args: Record<string, unknown>) => ({ createdEvent: { templateId: `pkg${templateId.slice(templateId.indexOf(":"))}`, contractId: "00", createArgument: args }, synchronizerId: "s" });

beforeEach(() => {
  vi.resetAllMocks();
  mocks.submit.mockResolvedValue({ kind: "done" });
});

describe("POST /internal/agents/enrol (C8f)", () => {
  it("creates every missing standing offer once, under deterministic command ids", async () => {
    mocks.readActive.mockResolvedValue([]);
    const a = await handleEnrol(venue, new Set(), { party: SEAT, leaseId: "lease-1" }, () => undefined);
    expect(a.body).toEqual({ kind: "enrolled", created: ["grant-desk", "desk-offer", "subscriber-invite", "creator-license"] });
    const ids = mocks.submit.mock.calls.map((c) => (c[1] as { commandId: string }).commandId);
    expect(new Set(ids).size).toBe(4);
    mocks.submit.mockClear();
    await handleEnrol(venue, new Set(), { party: SEAT, leaseId: "lease-2" }, () => undefined);
    expect(mocks.submit.mock.calls.map((c) => (c[1] as { commandId: string }).commandId)).toEqual(ids);
  });

  it("creates nothing a seat already holds; a book stands in for its invitation", async () => {
    const A = AGENT_TEMPLATE_IDS;
    mocks.readActive.mockResolvedValue([
      contract(A.GrantDesk, { venue: VENUE, owner: SEAT }),
      contract(A.DeskOffer, { venue: VENUE, owner: SEAT }),
      contract(A.SubscriberBook, { venue: VENUE, subscriber: SEAT, following: [] }),
      contract(A.CreatorLicense, { venue: VENUE, creator: SEAT, nextIndex: "2" }),
    ]);
    const a = await handleEnrol(venue, new Set(), { party: SEAT, leaseId: "lease-1" }, () => undefined);
    expect(a.body).toEqual({ kind: "enrolled", created: [] });
    expect(mocks.submit).not.toHaveBeenCalled();
  });

  it("never enrols an infrastructure party, and refuses a malformed party", async () => {
    mocks.readActive.mockResolvedValue([]);
    const infra = await handleEnrol(venue, new Set([SEAT]), { party: SEAT, leaseId: "l" }, () => undefined);
    expect((infra.body as { kind: string }).kind).toBe("refused");
    expect((await handleEnrol(venue, new Set(), { party: "nobody", leaseId: "l" }, () => undefined)).status).toBe(400);
    expect(mocks.submit).not.toHaveBeenCalled();
  });
});
