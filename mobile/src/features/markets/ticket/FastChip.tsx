import { StyleSheet, Text, View } from "react-native";
import { SEAT } from "~/wallet/seat-copy";
import { tkType, useTk } from "./tk";

/**
 * Where web's tap-trading chip sat on the ticket: the same chip grammar (leverage-chip border, 4 pt radius), shown as
 * on and not pressable, because there is nothing to arm. A seat already trades in one tap, with no second key and no
 * caps to set.
 */
export function FastChip() {
  const tk = useTk();
  return (
    <View accessible accessibilityLabel={`${SEAT.fast.label}: ${SEAT.fast.why}`} style={[styles.chip, { borderColor: tk.levOnBorder, backgroundColor: tk.levOnBg }]}>
      <Text style={[tkType.chip, { color: tk.levOnInk }]}>{SEAT.fast.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { minWidth: 40, borderRadius: 4, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4 },
});
