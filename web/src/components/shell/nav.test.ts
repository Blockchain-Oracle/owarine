import { describe, expect, it } from "vitest";
import { DOCS_URL } from "../../lib/docs-url";
import { DOCK, isActiveNavItem, MORE, MORE_ITEMS, NAVIGABLE_ROUTE_PATHS, NAV_ITEMS, PLACES, placeOf, type NavItem } from "./nav";

describe("navigation registry", () => {
  it("keeps six places, each on its own number key, and a compact phone dock", () => {
    expect(PLACES.map((item) => item.name)).toEqual(["Trade", "Markets", "Portfolio", "Games", "Automate", "Leaderboard"]);
    expect(PLACES.map((item) => item.digit)).toEqual(["1", "2", "3", "4", "5", "6"]);
    expect([...DOCK.left, ...DOCK.right].map((item) => item.name)).toEqual(["Trade", "Markets", "Portfolio"]);
  });

  it("gives every destination exactly one home", () => {
    const ids = [...PLACES, ...MORE_ITEMS].map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(Object.keys(NAV_ITEMS).length);
    expect(MORE.every((section) => section.items.length > 0)).toBe(true);
  });

  it("gives every accepted user-facing route an explicit navigation home", () => {
    const destinations = [...PLACES, ...MORE_ITEMS].map((item) => item.href.split("?")[0]);
    expect(NAVIGABLE_ROUTE_PATHS.filter((path) => !destinations.includes(path))).toEqual([]);
  });

  it("lights the place a nested page belongs to, and none on a More page", () => {
    expect(placeOf("/trade/ETH")?.id).toBe("trade");
    expect(placeOf("/markets/abc")?.id).toBe("markets");
    expect(placeOf("/games/range")?.id).toBe("games");
    expect(placeOf("/desk/new")?.id).toBe("automate");
    expect(placeOf("/u/0xabc")?.id).toBe("leaderboard");
    expect(placeOf("/trade-from-x")).toBeNull();
    expect(placeOf("/news")).toBeNull();
  });

  it("keeps Trader Edge in More without also activating Portfolio", () => {
    expect(isActiveNavItem("/portfolio/edge", NAV_ITEMS.edge)).toBe(true);
    expect(isActiveNavItem("/portfolio/edge", NAV_ITEMS.portfolio)).toBe(false);
  });

  it("keeps documentation external and every application destination internal", () => {
    const items: NavItem[] = Object.values(NAV_ITEMS);
    expect(items.filter((item) => item.external).map((item) => item.id)).toEqual(["docs"]);
    expect(NAV_ITEMS.docs.href).toBe(DOCS_URL);
    expect(items.filter((item) => !item.external).every((item) => item.href.startsWith("/"))).toBe(true);
    expect(isActiveNavItem("/docs", NAV_ITEMS.docs)).toBe(false);
  });
});
