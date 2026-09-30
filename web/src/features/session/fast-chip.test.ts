import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FastChip } from "./FastChip";

describe("the ticket's one-tap chip", () => {
  const html = renderToStaticMarkup(createElement(FastChip));

  it("says one tap", () => {
    expect(html).toContain("one tap");
  });

  it("is a label: no control, no pressed styling, no hover-only explanation", () => {
    expect(html).not.toMatch(/<button|<a |role="button"|aria-pressed|tabindex/i);
    expect(html).not.toContain("tk-lev");
    expect(html).not.toContain("data-on");
    expect(html).not.toContain("title=");
  });

  it("wears the kit's static state pill", () => {
    expect(html).toContain("dkit-status");
    expect(html).toContain('data-tone="quiet"');
  });
});
