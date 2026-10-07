import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useMMKVString } from "react-native-mmkv";
import { storage } from "~/lib/storage";
import { DARK, LIGHT, type Palette } from "./palette";

export { FONT, OW_TYPE, RADIUS, SPACE, TYPE } from "./type";
export type { Palette } from "./palette";
export { AVATAR_COLORS } from "./palette";

export type ThemeName = "dark" | "light";
/** Web's key (lib/theme.ts): a stored choice wins; otherwise light, whatever the system says (K-403). */
const THEME_KEY = "owarine_theme";

interface ThemeValue {
  name: ThemeName;
  color: Palette;
  setTheme: (name: ThemeName | null) => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [stored, setStored] = useMMKVString(THEME_KEY, storage);
  const name: ThemeName = stored === "dark" ? "dark" : "light";
  const value = useMemo<ThemeValue>(
    () => ({ name, color: name === "dark" ? DARK : LIGHT, setTheme: (next) => setStored(next ?? undefined) }),
    [name, setStored],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme outside ThemeProvider");
  return value;
}
