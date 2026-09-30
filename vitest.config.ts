import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: ["packages/brain", "packages/core", "packages/db", "packages/ledger", "packages/markets", "services/ops", "web", "mobile", "scripts"],
    passWithNoTests: true,
  },
});
