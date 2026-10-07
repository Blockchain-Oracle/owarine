import { X } from "lucide-react-native";
import type { MutableRefObject, ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BottomDrawer, useDrawerClose, type DrawerClose } from "~/components/drawer/BottomDrawer";
import { OW_TYPE, useTheme } from "~/theme";

/**
 * The kit's sheet (web components/kit/Sheet): UGLYCASH's bottom sheet, built on the app's one BottomDrawer (spring,
 * drag to dismiss, keyboard-aware, Reduce Motion) with the kit's card, a condensed title and a round close.
 */
export function Sheet({ title, description, children, footer, onClose, closeRef }: { title: string; description?: string; children: ReactNode; footer?: ReactNode; onClose: () => void; closeRef?: MutableRefObject<DrawerClose | null> }) {
  const { color } = useTheme();
  return (
    <BottomDrawer onClose={onClose} closeLabel="Close" background={color.ow.card} radius={32} contentStyle={styles.content} closeRef={closeRef} corner={<CloseButton />}>
      <Text accessibilityRole="header" style={[OW_TYPE.display(24), styles.title, { color: color.ow.ink }]}>
        {title}
      </Text>
      {description ? <Text style={[OW_TYPE.body(14), styles.description, { color: color.ow.muted }]}>{description}</Text> : null}
      <View style={styles.body}>{children}</View>
      {footer ? <View style={[styles.footer, { borderTopColor: color.ow.hairline }]}>{footer}</View> : null}
    </BottomDrawer>
  );
}

function CloseButton() {
  const { color } = useTheme();
  const close = useDrawerClose();
  return (
    <Pressable onPress={() => close()} accessibilityRole="button" accessibilityLabel="Close" hitSlop={8} style={[styles.close, { backgroundColor: color.ow.recessed }]}>
      <X size={16} color={color.ow.ink} strokeWidth={2.5} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 16 },
  title: { paddingRight: 48 },
  description: { marginTop: 8 },
  body: { marginTop: 16 },
  footer: { marginTop: 20, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth },
  close: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
});
