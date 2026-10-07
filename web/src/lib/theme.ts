// Theme: light (default, K-403) — UGLYCASH's ice canvas #F2F2F2, white cards, black ink, Power Pink #FA00FF as the
// one action fill — and dark as a toggle the user chooses. Persisted per-browser; with no stored choice the page is
// light whatever the OS says (Abu, 7 Oct: light everywhere, dark is a toggle).
const STORAGE_KEY = "owarine_theme";

export type Theme = "dark" | "light";

export function getStoredTheme(): Theme | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "light" || v === "dark" ? v : null;
  } catch {
    return null;
  }
}

/** Stored choice wins; else light. */
export function resolveTheme(): Theme {
  return getStoredTheme() ?? "light";
}

function apply(theme: Theme): void {
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-theme", theme);
  }
}

export function setStoredTheme(theme: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* storage unavailable — the attribute still applies for this page */
  }
  apply(theme);
}

export function toggleTheme(current: Theme): Theme {
  const next: Theme = current === "dark" ? "light" : "dark";
  setStoredTheme(next);
  return next;
}

/** Idempotent: set the attribute from the resolved theme, return it. */
export function initTheme(): Theme {
  const theme = resolveTheme();
  apply(theme);
  return theme;
}

// Blocking snippet injected before the app renders so the correct theme paints on the
// FIRST frame — no flash. Kept tiny and dependency-free; mirrors resolveTheme().
export const THEME_INIT_SCRIPT = `(()=>{var t='light';try{var s=localStorage.getItem('${STORAGE_KEY}');if(s==='dark')t=s;}catch(e){}document.documentElement.setAttribute('data-theme',t);})();`;
