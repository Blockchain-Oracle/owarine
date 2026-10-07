import { pressKey, type KeypadKey, type KeypadRules } from "@owarine/core/input";
import { Delete } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { OW_TYPE, useTheme } from "~/theme";
import { haptic } from "../haptics";

/** UGLYCASH's big amount keypad (web components/kit/Keypad); the shared `pressKey` machine decides each press. */
const KEYS: readonly KeypadKey[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "del"];

export function Keypad({ value, onChange, rules, onPress }: { value: string; onChange: (next: string) => void; rules?: KeypadRules; onPress?: (key: KeypadKey) => void }) {
  const { color } = useTheme();
  return (
    <View accessibilityRole="keyboardkey" accessibilityLabel="Amount keypad" style={styles.grid}>
      {KEYS.map((key) => (
        <Pressable
          key={key}
          onPress={() => {
            haptic.select();
            onPress?.(key);
            onChange(pressKey(value, key, rules));
          }}
          accessibilityRole="button"
          accessibilityLabel={key === "del" ? "Delete" : key === "." ? "Decimal point" : key}
          style={({ pressed }) => [styles.key, pressed ? { backgroundColor: color.ow.recessed } : null]}
        >
          {key === "del" ? <Delete size={28} color={color.ow.ink} strokeWidth={2.25} /> : <Text style={[OW_TYPE.num(28, "700"), { color: color.ow.ink }]}>{key}</Text>}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", rowGap: 4 },
  key: { width: "33.333%", height: 64, alignItems: "center", justifyContent: "center", borderRadius: 16 },
});
