import { defineConfig } from "vitest/config";

/** Unit tests of the bootstrap helpers only (C2y). The `drive/*-it.ts` scripts are run by hand against a sandbox. */
export default defineConfig({
  test: { include: ["bootstrap/**/*.test.ts"] },
});
