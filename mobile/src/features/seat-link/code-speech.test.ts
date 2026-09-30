import { describe, expect, it } from "vitest";
import { SEAT } from "~/wallet/seat-copy";
import { spokenCode } from "./code-speech";

const words = SEAT.link.code;

describe("the code field's spoken value", () => {
  it("says nothing has been entered", () => {
    expect(spokenCode("", 8, words)).toBe("none of 8 characters entered");
  });

  it("spells each character on its own and counts what is left", () => {
    expect(spokenCode("K7M", 8, words)).toBe("K 7 M, 5 more to enter");
  });

  it("is only the characters once the code is whole", () => {
    expect(spokenCode("K7M4Q9XB", 8, words)).toBe("K 7 M 4 Q 9 X B");
  });
});
