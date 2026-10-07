import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { partyLead } from "@owarine/core/units";
import { ID_LABEL } from "@/features/canton-ux/id-label";
import { TapHash } from "./TapHash";

const PARTY = "alice::1220a1b2c3d4e5f60718293a4b5c6d7e8f9091a2b3c4d5e6f708192a3b4c5d6e7f809";

const render = (props: Partial<Parameters<typeof TapHash>[0]> = {}) =>
  renderToStaticMarkup(createElement(TapHash, { value: PARTY, lead: partyLead(PARTY), tail: 4, label: ID_LABEL.party, ...props }));

describe("TapHash: an id a touch screen can read", () => {
  it("starts short, as Hash does, and is a control rather than a hover-only title", () => {
    const html = render();
    expect(html).toContain("alice::1220…");
    expect(html).not.toContain(`>${PARTY}<`);
    expect(html).toMatch(/<button[^>]*aria-expanded="false"/);
    expect(html).toContain("Party id alice::1220");
    expect(html).toContain("Show the whole id");
    // A mouse still gets the whole value on hover.
    expect(html).toContain(`title="${PARTY}"`);
  });

  it("open, shows the whole id and offers Copy", () => {
    const html = render({ defaultOpen: true });
    expect(html).toContain(`>${PARTY}</button>`);
    expect(html).toMatch(/aria-expanded="true"/);
    expect(html).toContain("Hide the whole id");
    expect(html).toContain("Copy party id");
  });

  it("an id that was never cut has nothing to reveal and stays text", () => {
    const html = render({ value: "bob::1220", lead: undefined, tail: undefined });
    expect(html).not.toContain("<button");
    expect(html).toContain("bob::1220");
  });

  it("names update ids the same way", () => {
    expect(render({ value: "1220ab".repeat(12), lead: 8, tail: 4, label: ID_LABEL.update })).toContain("Update id 1220ab12…");
  });
});
