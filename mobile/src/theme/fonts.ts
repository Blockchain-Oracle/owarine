import { JetBrainsMono_400Regular, JetBrainsMono_500Medium } from "@expo-google-fonts/jetbrains-mono";
import { useFonts } from "expo-font";

/**
 * Owarine's faces (K-403), keyed by the names theme/type.ts uses. React Native cannot drive a variable axis, so Archivo
 * and Inter are static cuts from their variable fonts (OFL, google/fonts; assets/fonts/*-OFL.txt): Archivo at wdth 62
 * (ExtraCondensed) 900 and 800 and wdth 75 700 for the display, Inter at opsz 14 in five weights. Noto Sans JP 900
 * ships as a subset of the kana and kanji the app draws. JetBrains Mono stays for code only.
 */
const FACES = {
  Archivo_ExtraCondensed900: require("../../assets/fonts/Archivo-ExtraCondensed-900.ttf"),
  Archivo_ExtraCondensed800: require("../../assets/fonts/Archivo-ExtraCondensed-800.ttf"),
  Archivo_Condensed700: require("../../assets/fonts/Archivo-Condensed-700.ttf"),
  Inter_400: require("../../assets/fonts/Inter-400.ttf"),
  Inter_500: require("../../assets/fonts/Inter-500.ttf"),
  Inter_600: require("../../assets/fonts/Inter-600.ttf"),
  Inter_700: require("../../assets/fonts/Inter-700.ttf"),
  Inter_800: require("../../assets/fonts/Inter-800.ttf"),
  NotoSansJP_900: require("../../assets/fonts/NotoSansJP-900-subset.ttf"),
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
};

/** True once every face is ready (or failed: the system face stands in rather than holding the splash forever). */
export function useAppFonts(): boolean {
  const [loaded, error] = useFonts(FACES);
  return loaded || error !== null;
}
