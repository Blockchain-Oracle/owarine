import { checkWebServerEnv } from "@/lib/server-env";

/**
 * The seat and ledger routes' configuration, checked once at boot. Production refuses to start on any problem (a
 * half-configured seat tier would lease seats it cannot fund, or accept calls it cannot read back), unless the deploy
 * says plainly that it runs without seats (`AGARI_ALLOW_SEATLESS=1`, for a docs-only or read-only host). Development
 * logs the variable names and the seat routes answer "not live" until they are set. Values are never printed.
 */
const { problems } = checkWebServerEnv(process.env);
if (problems.length > 0) {
  const report = `seat/ledger configuration:\n  ${problems.join("\n  ")}`;
  if (process.env.NODE_ENV === "production" && process.env.AGARI_ALLOW_SEATLESS !== "1") {
    // Measured on Next 16.3: a throw here does not stop `next start`; it logs "Failed to prepare server" and answers
    // 500 on every route. Exiting makes a misconfigured host crash-loop where the deploy can see it.
    console.error(`[agari] refusing to start: ${report}`);
    process.exit(1);
  }
  console.warn(`[agari] ${report}\n  (the seat routes answer "not live" until these are set)`);
}
