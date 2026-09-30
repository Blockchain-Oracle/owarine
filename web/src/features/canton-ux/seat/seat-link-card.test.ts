import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SeatLinkCard } from "./SeatLinkCard";

const render = (state: "confirm" | "declined" | "linked") =>
  renderToStaticMarkup(
    createElement(SeatLinkCard, {
      state,
      code: "K7M4Q9XB",
      url: "https://example.test/seat/link?code=K7M4Q9XB",
      expiresAtSec: null,
      seatNumber: 3,
      waitingKey: "b3f0c2d41a9e5577",
      onDecide: vi.fn(),
      onFresh: vi.fn(),
      verify: vi.fn(),
    }),
  );

describe("the seat link's answer plates", () => {
  it("asks 'Allow this device?' on the neutral plate, never the success one", () => {
    const html = render("confirm");
    expect(html).toContain('role="alertdialog"');
    expect(html).toContain('data-tone="ask"');
    expect(html).toContain("Allow this device?");
  });

  it("keeps the success wash for a link that was made and the warning treatment for a refusal", () => {
    expect(render("linked")).not.toContain('data-tone="ask"');
    expect(render("linked")).toContain('class="cx-link-done"');
    expect(render("declined")).toContain('data-tone="declined"');
  });
});
