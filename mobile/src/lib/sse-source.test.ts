import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeStreamFactory, type AppStateLike, type SseLike } from "./sse-source";

class FakeSse implements SseLike {
  static made: FakeSse[] = [];
  listeners = new Map<string, ((e: { data?: string | null }) => void)[]>();
  closed = false;
  constructor(readonly url: string) {
    FakeSse.made.push(this);
  }
  addEventListener(type: string, listener: (e: { data?: string | null }) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }
  removeAllEventListeners() {
    this.listeners.clear();
  }
  close() {
    this.closed = true;
  }
  emit(type: string, data?: string) {
    for (const l of this.listeners.get(type) ?? []) l({ data });
  }
}

function fakeAppState(initial: string) {
  const subs = new Set<(s: string) => void>();
  const app = {
    currentState: initial,
    addEventListener: (_: "change", l: (s: string) => void) => (subs.add(l), { remove: () => void subs.delete(l) }),
    set(state: string) {
      app.currentState = state;
      subs.forEach((l) => l(state));
    },
    subs,
  };
  return app as AppStateLike & { set(s: string): void; subs: Set<unknown> };
}

describe("the phone's SSE adapter (iOS step 8)", () => {
  beforeEach(() => {
    FakeSse.made = [];
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it("delivers named events, and on an error closes the socket and hands the retry to the runtime", () => {
    const app = fakeAppState("active");
    const source = makeStreamFactory((url) => new FakeSse(url), app)("https://ops.example/prices/stream");
    const got: string[] = [];
    const errors: boolean[] = [];
    source.listen("spot", (d) => got.push(d));
    source.onError((closed) => errors.push(closed));
    const sse = FakeSse.made[0]!;
    sse.emit("spot", "{\"a\":1}");
    expect(got).toEqual(["{\"a\":1}"]);
    sse.emit("error");
    expect(errors).toEqual([]);
    vi.runAllTimers();
    expect(errors).toEqual([true]);
    expect(sse.closed).toBe(true);
    expect(app.subs.size).toBe(0);
    app.set("background");
    app.set("active");
    expect(FakeSse.made).toHaveLength(1);
  });

  it("closes the socket in the background and reconnects in the foreground with the same listeners", () => {
    const app = fakeAppState("active");
    const source = makeStreamFactory((url) => new FakeSse(url), app)("u");
    const got: string[] = [];
    const errors: boolean[] = [];
    source.listen("ladder", (d) => got.push(d));
    source.onError((closed) => errors.push(closed));
    app.set("background");
    expect(FakeSse.made[0]!.closed).toBe(true);
    expect(errors).toEqual([false]);
    app.set("active");
    expect(FakeSse.made).toHaveLength(2);
    FakeSse.made[1]!.emit("ladder", "x");
    expect(got).toEqual(["x"]);
  });

  it("waits for the foreground when made in the background, and close() ends it for good", () => {
    const app = fakeAppState("background");
    const source = makeStreamFactory((url) => new FakeSse(url), app)("u");
    expect(FakeSse.made).toHaveLength(0);
    app.set("active");
    expect(FakeSse.made).toHaveLength(1);
    source.close();
    expect(FakeSse.made[0]!.closed).toBe(true);
    app.set("background");
    app.set("active");
    expect(FakeSse.made).toHaveLength(1);
    expect(app.subs.size).toBe(0);
  });
});
