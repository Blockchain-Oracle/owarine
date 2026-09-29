/**
 * The generated Daml bindings (`@daml/types`) log "Registered template …" through `console.debug` for every template
 * as they load: 40 lines of noise at every boot. Import this module first to drop exactly those lines.
 */
const debug = console.debug.bind(console);
console.debug = (...args: unknown[]) => {
  if (typeof args[0] === "string" && args[0].startsWith("Registered template ")) return;
  debug(...args);
};
export {};
