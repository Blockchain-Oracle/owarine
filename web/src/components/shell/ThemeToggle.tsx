"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { resolveTheme, toggleTheme, type Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";

// ☀ / ☾ — flips the cream light / ink dark theme. The init script has already set
// data-theme before paint; this mirrors it into state on mount so the icon matches,
// then toggles + persists on click.
export default function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTheme(resolveTheme());
    setMounted(true);
  }, []);

  // Stable placeholder until mounted so SSR/CSR markup matches.
  if (!mounted) {
    return <button className={cn("theme-toggle", className)} aria-hidden="true" tabIndex={-1} />;
  }

  const isDark = theme === "dark";
  return (
    <button
      type="button"
      className={cn("theme-toggle", className)}
      data-cursor="hover"
      // The flip crossfades the whole page through a view transition (roy-chain's toggle); instant with reduced motion.
      onClick={() => {
        const flip = () => setTheme(toggleTheme(theme));
        if (typeof document.startViewTransition === "function" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) document.startViewTransition(() => flushSync(flip));
        else flip();
      }}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
    >
      {isDark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
    </button>
  );
}
