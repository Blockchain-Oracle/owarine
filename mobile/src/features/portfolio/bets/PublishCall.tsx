import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { PUBLISH } from "@/features/leaderboard/publish/copy";
import { usePublications, usePublishCall, type PublishSource } from "@/features/leaderboard/publish/usePublications";
import { haptic } from "~/components/kit";
import { FONT, useTheme } from "~/theme";

/**
 * web's opt-in "Publish this call" (C5, `leaderboard/publish/PublishCall.tsx`) in the row's own grammar: an accent
 * caption that publishes; a published call says so and can be retracted; a settled one never published says why it
 * cannot be now. Nothing reaches the leaderboard, activity, takes or sentiment until its owner publishes it.
 */
export function PublishCall({ marketId, address, source, ticket }: { marketId: string; address: string | null; source: PublishSource; ticket?: { receiptId: string; product: string } }) {
  const { color } = useTheme();
  const list = usePublications(address);
  const { publish, retract } = usePublishCall(address);
  const [note, setNote] = useState<string | null>(null);
  if (!address || !list.data) return null;
  const mine = list.data.value.filter((p) => p.marketId === marketId && (p.product ?? null) === (ticket?.product ?? null));

  if (mine.length > 0) {
    return (
      <Text style={[styles.caption, { color: color.inkSecondary }]} accessibilityHint={PUBLISH.scope}>
        <Text style={{ color: color.accent }}>✓ </Text>
        {PUBLISH.published}{" "}
        <Text
          style={[styles.link, { color: color.accent }]}
          // A nested Text is not its own VoiceOver element unless it is a link (as `ControlCard`'s receipt link is).
          accessibilityRole="link"
          disabled={retract.isPending}
          onPress={() => {
            haptic.select();
            retract.mutate({ marketId, product: ticket?.product ?? null });
          }}
        >
          {retract.isPending ? PUBLISH.retracting : PUBLISH.retract}
        </Text>
      </Text>
    );
  }
  if (source === "receipt" && !list.data.receipts) return <Text style={[styles.caption, { color: color.inkMuted }]}>{PUBLISH.settledUnpublished}</Text>;

  const go = () => {
    haptic.select();
    setNote(null);
    publish.mutate(
      { marketId, source, ...(ticket ? { receiptId: ticket.receiptId } : {}) },
      {
        onSuccess: (r) => {
          if (r.kind === "refused") setNote(PUBLISH.refused[r.code]);
        },
        onError: () => setNote(PUBLISH.failed),
      },
    );
  };
  return (
    <View style={styles.wrap}>
      <Pressable onPress={go} disabled={publish.isPending} accessibilityRole="button" accessibilityHint={PUBLISH.explain} hitSlop={6}>
        <Text style={[styles.caption, styles.link, { color: color.accent }]}>{publish.isPending ? PUBLISH.publishing : PUBLISH.publish}</Text>
      </Pressable>
      {note ? (
        <Text style={[styles.caption, { color: color.warning }]} accessibilityRole="alert">
          {note}
        </Text>
      ) : null}
    </View>
  );
}

// web `type-caption text-accent underline`: Inter 12/18, the underline in the text's own colour.
const styles = StyleSheet.create({
  wrap: { gap: 2 },
  caption: { fontFamily: FONT.body, fontSize: 12, lineHeight: 18 },
  link: { textDecorationLine: "underline" },
});
