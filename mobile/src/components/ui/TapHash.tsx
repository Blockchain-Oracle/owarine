import { shortHex } from "@owarine/core/units";
import * as Clipboard from "expo-clipboard";
import { Check, Copy } from "lucide-react-native";
import { useEffect, useState } from "react";
import { AccessibilityInfo, Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle } from "react-native";
import { haptic } from "~/components/kit";
import { useTheme } from "~/theme";

const COPIED_MS = 1_500;

interface Props {
  value: string;
  lead?: number;
  tail?: number;
  /** What the id is, for the accessible name: "Party id", "Update id". */
  label: string;
  /** The text style of the line it sits in (size, face, colour). */
  style?: StyleProp<TextStyle>;
}

/**
 * web's `TapHash` on the phone: the short id with the dotted underline `Hash` draws, where a tap shows the whole id
 * where it stands with a Copy control beside it, and a second tap folds it back. A phone has no hover, so an id cut short
 * with the whole one only in a `title` (or an accessibility label) was unreadable to anyone who could see it.
 */
export function TapHash({ value, lead, tail = 4, label, style }: Props) {
  const { color } = useTheme();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const short = shortHex(value, lead, tail);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  // Nothing was cut: there is nothing to reveal.
  if (short === value) return <Text style={style}>{value}</Text>;

  const Icon = copied ? Check : Copy;
  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => {
          haptic.select();
          setOpen((was) => !was);
        }}
        accessibilityRole="button"
        accessibilityLabel={open ? `${label} ${value}. Hide the whole id.` : `${label} ${short}. Show the whole id.`}
        accessibilityState={{ expanded: open }}
        hitSlop={{ top: 13, bottom: 13, left: 8, right: 8 }}
        style={styles.toggle}
      >
        <Text style={[style, styles.id]}>{open ? value : short}</Text>
      </Pressable>
      {open ? (
        <Pressable
          onPress={() => {
            haptic.select();
            void Clipboard.setStringAsync(value).then(
              () => {
                setCopied(true);
                AccessibilityInfo.announceForAccessibility("Copied");
              },
              () => undefined,
            );
          }}
          accessibilityRole="button"
          accessibilityLabel={copied ? "Copied" : `Copy ${label.toLowerCase()}`}
          hitSlop={14}
          style={styles.copy}
        >
          <Icon size={14} color={copied ? color.profit : color.inkSecondary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", flexShrink: 1, gap: 8 },
  toggle: { flexShrink: 1 },
  id: { textDecorationLine: "underline", textDecorationStyle: "dotted" },
  copy: { paddingTop: 2 },
});
