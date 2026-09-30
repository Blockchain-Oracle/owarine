import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * The app's few Node-runnable tests (plan iOS step 1: the phone's seat key signs what the server verifies). The same
 * path aliases as the app (`~/` → src, `@/` → web/src), and web's `server-only` stand-in, so a test can import the
 * very server verifier the phone's signatures meet.
 */
export default defineConfig({
  resolve: {
    alias: {
      "~": fileURLToPath(new URL("./src", import.meta.url)),
      "@": fileURLToPath(new URL("../web/src", import.meta.url)),
      "server-only": fileURLToPath(new URL("../web/src/test/server-only.ts", import.meta.url)),
    },
  },
  test: { include: ["src/**/*.test.ts"] },
});
