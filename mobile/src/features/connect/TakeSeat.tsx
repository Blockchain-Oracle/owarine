import { StyleSheet, Text, View } from "react-native";
import { Button } from "~/components/kit";
import { AgariMark } from "~/components/shell/AgariMark";
import { FONT, useTheme } from "~/theme";
import { SEAT } from "~/wallet/seat-copy";

/**
 * The Take a seat sheet's body, where the reference's wallet strip was: the app mark, the three plain lines a seat
 * rests on (the key stays on this phone, demo credits only, a test network), and one button that accepts them and
 * takes the seat. No store links and no wallet apps: a seat is made here, on this phone.
 */
export function TakeSeat({ taking, error, onTake, onBrowse }: { taking: boolean; error: string | null; onTake: () => void; onBrowse: () => void }) {
  const { color } = useTheme();
  return (
    <View style={styles.body}>
      <View style={[styles.mark, { backgroundColor: color.surface2 }]}>
        <AgariMark width={27} height={27} />
      </View>
      <View style={styles.lines}>
        {SEAT.sheet.lines.map((line) => (
          <Text key={line} style={[styles.line, { color: color.inkSecondary }]}>
            {line}
          </Text>
        ))}
      </View>
      {error ? (
        <Text style={[styles.error, { color: color.loss }]} accessibilityRole="alert">
          {SEAT.failed(error)}
        </Text>
      ) : null}
      <View style={styles.actions}>
        <Button label={taking ? SEAT.sheet.taking : SEAT.terms.accept} variant="primary" size="lg" loading={taking} onPress={onTake} />
        <Button label={SEAT.terms.browse} variant="ghost" size="lg" disabled={taking} onPress={onBrowse} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { alignItems: "center", gap: 20, paddingTop: 12, paddingHorizontal: 24 },
  mark: { width: 60, height: 60, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  lines: { gap: 10, alignSelf: "stretch" },
  line: { fontFamily: FONT.body, fontSize: 15, lineHeight: 21, textAlign: "center" },
  error: { fontFamily: FONT.body, fontSize: 13, lineHeight: 18, textAlign: "center" },
  actions: { gap: 8, alignSelf: "stretch" },
});
