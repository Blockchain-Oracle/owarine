import { defineConfig } from "vitest/config";

/** Unit tests of the bootstrap helpers (C2y) and of `first-call.ts` (C2z). The `drive/*-it.ts` scripts are run by hand against a sandbox. */
export default defineConfig({
  test: { include: ["bootstrap/**/*.test.ts", "drive/first-call/**/*.test.ts"] },
});
