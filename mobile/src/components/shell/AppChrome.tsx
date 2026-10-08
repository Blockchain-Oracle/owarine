import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FONT, useTheme } from "~/theme";
import { OwarineMark } from "./OwarineMark";
import { CHROME, chromeTokens } from "~/theme/chrome";
import { HeaderAccount } from "./HeaderAccount";
import { ThemeToggle } from "./ThemeToggle";

/**
 * The phone's fixed top: the Header (46) — the 終値 seal, OWARINE and 終値 on the left; the theme ring and the account
 * on the right. The marquee went with web's (K-405). The status bar area takes the header's ground so the chrome reads
 * as one piece.
 */
export function AppChrome() {
  const insets = useSafeAreaInsets();
  const { name } = useTheme();
  const t = chromeTokens(name);
  return (
    <View style={{ paddingTop: insets.top, backgroundColor: t.headerBg }}>
      <View style={[styles.header, { backgroundColor: t.headerBg, borderBottomColor: t.headerBorder }]}>
        <Pressable style={styles.logo} onPress={() => router.navigate("/markets")} accessibilityRole="link" accessibilityLabel="Owarine 終値 home">
          <OwarineMark />
          <Text style={[styles.name, { color: t.logoInk }]}>OWARINE</Text>
          <Text style={[styles.jp, { color: t.logoJp }]}>終値</Text>
        </Pressable>
        <View style={styles.right}>
          <ThemeToggle />
          <HeaderAccount />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { height: CHROME.header, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, borderBottomWidth: 1 },
  logo: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: { fontFamily: FONT.headingHeavy, fontSize: 14, lineHeight: 22.4, letterSpacing: 1.68 },
  jp: { fontFamily: FONT.stamp, fontSize: 14, lineHeight: 22.4, letterSpacing: 0.84 },
  right: { flexDirection: "row", alignItems: "center", gap: 8 },
});
