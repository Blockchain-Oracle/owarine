import { isOk, type Reading } from "@agari/core/schemas";

/**
 * Waits for the venue the runner scans (C8g). On Canton the venue's facts come from the web's public routes
 * (`/api/venue/facts`), a separate process: ops booting while the web restarts used to leave the runner idle for the
 * life of the process ("no venue to scan … idle"), so no subscriber was ever traded until someone restarted ops.
 * Now it says why and asks again every `everyMs` until a venue answers.
 */
export async function awaitVenue<V extends { venueId: unknown }>(
  resolve: () => Promise<Reading<V>>,
  log: (why: string) => void,
  everyMs: number,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
): Promise<V> {
  for (let attempt = 1; ; attempt += 1) {
    const venue = await resolve();
    if (isOk(venue) && venue.value.venueId) return venue.value;
    if (attempt === 1 || attempt % 10 === 0) log(`no venue to scan yet: ${isOk(venue) ? "none live" : venue.error.technical}; asking again every ${Math.round(everyMs / 1000)} s`);
    await sleep(everyMs);
  }
}
