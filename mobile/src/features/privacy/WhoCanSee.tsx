import { Eye } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { PRIVACY, type SeenKind } from "@/features/canton-ux/privacy/copy";
import { haptic } from "~/components/kit";
import { FONT, RADIUS, useTheme } from "~/theme";

const C = PRIVACY.chip;
const DISC = 18;

/**
 * web's "Who can see this" chip (C-ADD-01, `canton-ux/privacy/WhoCanSee.tsx`) ported literally: the outline pill with
 * the two stakeholders as overlapping discs (the venue's on the accent wash, as `.cx-seen-badge .dkit-logo:last-child`),
 * "You + venue" in mono, and the eye. A phone has no hover, so a tap opens web's tooltip text in place beneath it: what
 * each party is to the contract, and that the ledger sends it to no one else.
 */
export function WhoCanSee({ kind, holder = "You" }: { kind: SeenKind; holder?: string }) {
  const { color } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => {
          haptic.select();
          setOpen((o) => !o);
        }}
        accessibilityRole="button"
        accessibilityLabel={C.aria(holder)}
        accessibilityState={{ expanded: open }}
        hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
        style={[styles.badge, { borderColor: open ? color.accentDim : color.hairline, backgroundColor: color.surface1 }]}
      >
        <View style={styles.discs} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View style={[styles.disc, { backgroundColor: color.surface2, borderColor: color.surface1 }]}>
            <Text style={[styles.initial, { color: color.ink }]}>{holder.slice(0, 1)}</Text>
          </View>
          <View style={[styles.disc, styles.second, { backgroundColor: color.accentWash, borderColor: color.surface1 }]}>
            <Text style={[styles.initial, { color: color.accent }]}>V</Text>
          </View>
        </View>
        <Text style={[styles.text, { color: open ? color.ink : color.inkSecondary }]} numberOfLines={1}>
          {C.short(holder)}
        </Text>
        <Eye size={13} color={color.inkMuted} />
      </Pressable>
      {open ? (
        <View style={[styles.tip, { borderColor: color.hairline, backgroundColor: color.surface2 }]} accessibilityLiveRegion="polite">
          <Text style={[styles.tipTitle, { color: color.inkSecondary }]}>{C.label.toUpperCase()}</Text>
          <Text style={[styles.tipRow, { color: color.ink }]}>
            <Text style={styles.strong}>{holder}</Text> {C.holderRole[kind]}
          </Text>
          <Text style={[styles.tipRow, { color: color.ink }]}>
            <Text style={styles.strong}>{C.venue}</Text> {C.venueRole}
          </Text>
          <Text style={[styles.tipRow, styles.tipFoot, { color: color.inkSecondary, borderTopColor: color.hairline }]}>{C.foot[kind]}</Text>
        </View>
      ) : null}
    </View>
  );
}

// web privacy.css `.cx-seen*`: the pill 3/10/3/3 with an 8 gap, mono 11/500; the tip 10/12 padding, max 280, 4 gap.
const styles = StyleSheet.create({
  wrap: { alignItems: "flex-start", gap: 6 },
  badge: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 3, paddingLeft: 3, paddingRight: 10, borderWidth: 1, borderRadius: RADIUS.full },
  discs: { flexDirection: "row" },
  disc: { width: DISC + 2, height: DISC + 2, borderRadius: DISC, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  second: { marginLeft: -DISC * 0.3 },
  initial: { fontFamily: FONT.dataStrong, fontSize: 10, lineHeight: 12 },
  text: { fontFamily: FONT.data, fontSize: 11, lineHeight: 14, letterSpacing: 0.2 },
  tip: { maxWidth: 280, gap: 4, paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderRadius: RADIUS.md },
  tipTitle: { fontFamily: FONT.data, fontSize: 10, lineHeight: 14, letterSpacing: 1.2 },
  tipRow: { fontFamily: FONT.body, fontSize: 12, lineHeight: 17.4 },
  strong: { fontFamily: FONT.bodyBold },
  tipFoot: { marginTop: 4, paddingTop: 6, borderTopWidth: 1 },
});
