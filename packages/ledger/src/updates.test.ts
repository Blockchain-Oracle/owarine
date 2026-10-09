import { describe, expect, it } from "vitest";
import { noAuth, type TokenSource } from "./auth";
import { streamUpdates, type WebSocketLike } from "./updates";

class FakeWs implements WebSocketLike {
  static all: FakeWs[] = [];
  readyState = 0;
  sent: unknown[] = [];
  onopen: WebSocketLike["onopen"] = null;
  onmessage: WebSocketLike["onmessage"] = null;
  onerror: WebSocketLike["onerror"] = null;
  onclose: WebSocketLike["onclose"] = null;
  constructor(
    readonly url: string,
    readonly protocols: string[],
  ) {
    FakeWs.all.push(this);
  }
  send(d: string) {
    this.sent.push(JSON.parse(d));
  }
  close() {
    this.readyState = 3;
  }
  open() {
    this.readyState = 1;
    this.onopen?.({});
  }
  push(m: unknown) {
    this.onmessage?.({ data: JSON.stringify(m) });
  }
}

const tx = (offset: number) => ({ update: { Transaction: { value: { updateId: `u${offset}`, offset, events: [] } } } });
const cp = (offset: number) => ({ update: { OffsetCheckpoint: { value: { offset } } } });
const tick = () => new Promise((r) => setTimeout(r, 5));
const until = async (f: () => boolean) => {
  for (let i = 0; i < 200 && !f(); i++) await tick();
};

function tokenSource(token: string): TokenSource & { regrant(t: string): void } {
  let cur = token;
  const ls = new Set<(t: string) => void>();
  return {
    mode: "password",
    token: async () => cur,
    invalidate: () => {},
    refreshAt: () => undefined,
    onRegrant: (l) => (ls.add(l), () => ls.delete(l)),
    regrant(t: string) {
      cur = t;
      for (const l of ls) l(t);
    },
  };
}

describe("streamUpdates", () => {
  it("reconnects from the same cursor when the WebSocket handshake hangs", async () => {
    FakeWs.all = [];
    const errors: string[] = [];
    const s = streamUpdates({
      baseUrl: "https://node", auth: noAuth(), parties: ["v"], beginExclusive: 7,
      onTransaction: () => {}, WebSocket: FakeWs, connectTimeoutMs: 10,
      backoffBaseMs: 1, backoffMaxMs: 2, onError: (error) => errors.push(error.kind),
    });
    await until(() => FakeWs.all.length >= 2);
    expect(FakeWs.all[0]!.readyState).toBe(3);
    const resumed = FakeWs.all[1]!;
    resumed.open();
    expect(resumed.sent[0]).toMatchObject({ beginExclusive: 7 });
    resumed.push(tx(8));
    await until(() => s.cursor === 8);
    expect(errors).toContain("timeout");
    await s.close();
  });

  it("sends daml.ws.auth even without a token, and the resume request on open", async () => {
    FakeWs.all = [];
    const s = streamUpdates({ baseUrl: "http://l:7575", auth: noAuth(), parties: ["v"], beginExclusive: 7, onTransaction: () => {}, WebSocket: FakeWs });
    await until(() => FakeWs.all.length === 1);
    const ws = FakeWs.all[0]!;
    expect(ws.url).toBe("ws://l:7575/v2/updates");
    expect(ws.protocols).toEqual(["daml.ws.auth"]);
    ws.open();
    expect(ws.sent[0]).toMatchObject({
      beginExclusive: 7,
      updateFormat: { includeTransactions: { transactionShape: "TRANSACTION_SHAPE_LEDGER_EFFECTS", eventFormat: { filtersByParty: { v: {} } } } },
    });
    await s.close();
  });

  it("handles in order, advances the cursor after each handler, and replays from it after a failure", async () => {
    FakeWs.all = [];
    const handled: number[] = [];
    let failOnce = true;
    const s = streamUpdates({
      baseUrl: "https://node",
      auth: tokenSource("T"),
      parties: ["v"],
      beginExclusive: 0,
      backoffBaseMs: 1,
      backoffMaxMs: 2,
      WebSocket: FakeWs,
      onTransaction: async (t) => {
        await tick();
        if (t.offset === 3 && failOnce) {
          failOnce = false;
          throw new Error("db down");
        }
        handled.push(t.offset);
      },
    });
    await until(() => FakeWs.all.length === 1);
    const a = FakeWs.all[0]!;
    expect(a.protocols).toEqual(["jwt.token.T", "daml.ws.auth"]);
    a.open();
    a.push(tx(1));
    a.push(tx(2));
    a.push(tx(3));
    a.push(tx(4)); // dropped: the failure at 3 detaches this connection
    await until(() => FakeWs.all.length === 2);
    const b = FakeWs.all[1]!;
    b.open();
    expect(b.sent[0]).toMatchObject({ beginExclusive: 2 });
    b.push(tx(3));
    b.push(cp(9));
    b.push(tx(4)); // below the checkpoint: already covered, ignored
    b.push(tx(10));
    await until(() => s.cursor === 10);
    expect(handled).toEqual([1, 2, 3, 10]);
    await s.close();
  });

  it("reconnects from the cursor on token re-grant, and stops on a fatal error", async () => {
    FakeWs.all = [];
    const auth = tokenSource("T1");
    const errors: [string, boolean][] = [];
    const s = streamUpdates({
      baseUrl: "https://node",
      auth,
      parties: ["v"],
      beginExclusive: 5,
      WebSocket: FakeWs,
      onTransaction: () => {},
      onError: (e, fatal) => errors.push([e.code ?? e.kind, fatal]),
    });
    await until(() => FakeWs.all.length === 1);
    FakeWs.all[0]!.open();
    FakeWs.all[0]!.push(tx(6));
    await until(() => s.cursor === 6);
    auth.regrant("T2");
    await until(() => FakeWs.all.length === 2);
    const b = FakeWs.all[1]!;
    expect(b.protocols[0]).toBe("jwt.token.T2");
    b.open();
    expect(b.sent[0]).toMatchObject({ beginExclusive: 6 });
    b.push({ code: "PARTICIPANT_PRUNED_DATA_ACCESSED", cause: "pruned", errorCategory: 9, context: {} });
    await s.done;
    expect(errors).toEqual([["PARTICIPANT_PRUNED_DATA_ACCESSED", true]]);
  });
});
