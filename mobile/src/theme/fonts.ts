import { JetBrainsMono_400Regular, JetBrainsMono_500Medium } from "@expo-google-fonts/jetbrains-mono";
import { useFonts } from "expo-font";

/**
 * Owarine's faces (K-402), keyed by the names theme/type.ts uses. One family, Mona Sans (OFL, github/mona-sans via
 * google/fonts), at three widths, cut from its variable font into static files because React Native cannot set a
 * variable axis: Expanded (wdth 125) for headings and labels, Normal for body text and figures, Condensed (wdth 75)
 * for the scoreboard numerals. Noto Sans JP 900 ships as a subset of the 40 kana and kanji the app draws. JetBrains
 * Mono stays for code only: party ids, update ids, the literal ledger query.
 */
const FACES = {
  MonaSans_Expanded600: require("../../assets/fonts/MonaSans-Expanded-600.ttf"),
  MonaSans_Expanded700: require("../../assets/fonts/MonaSans-Expanded-700.ttf"),
  MonaSans_Expanded800: require("../../assets/fonts/MonaSans-Expanded-800.ttf"),
  MonaSans_400: require("../../assets/fonts/MonaSans-Normal-400.ttf"),
  MonaSans_500: require("../../assets/fonts/MonaSans-Normal-500.ttf"),
  MonaSans_600: require("../../assets/fonts/MonaSans-Normal-600.ttf"),
  MonaSans_700: require("../../assets/fonts/MonaSans-Normal-700.ttf"),
  MonaSans_800: require("../../assets/fonts/MonaSans-Normal-800.ttf"),
  MonaSans_Condensed800: require("../../assets/fonts/MonaSans-Condensed-800.ttf"),
  NotoSansJP_900: require("../../assets/fonts/NotoSansJP-900-subset.ttf"),
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
};

/** True once every face is ready (or failed: the system face stands in rather than holding the splash forever). */
export function useAppFonts(): boolean {
  const [loaded, error] = useFonts(FACES);
  return loaded || error !== null;
}
