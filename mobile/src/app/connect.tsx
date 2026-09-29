import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useWalletSession } from "@/lib/wallet-session";
import { haptic } from "~/components/kit";
import { CloseButton } from "~/components/wallet/sheet-parts";
import type { DrawerClose } from "~/components/drawer/BottomDrawer";
import { dismiss, WalletSheet } from "~/components/wallet/WalletSheet";
import { TakeSeat } from "~/features/connect/TakeSeat";
import { FONT, useTheme } from "~/theme";
import { SEAT } from "~/wallet/seat-copy";
import { useSeat } from "~/wallet/SeatProvider";

/**
 * Take a seat: where the reference's connect sheet was (web's `openPicker` lands here), in the same bottom sheet. It
 * restates the demo-credits terms, and its button accepts them and takes the seat; a seat already on this phone closes
 * the sheet at once. A failure stays on the sheet with the reason and the button to try again.
 */
export default function ConnectSheet() {
  const { color } = useTheme();
  const session = useWalletSession();
  const seat = useSeat();
  const [taking, setTaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const drawer = useRef<DrawerClose | null>(null);
  const close = () => (drawer.current ? drawer.current() : dismiss());

  useEffect(() => {
    if (session.isConnected && !taking) close();
    // Only a seat that appears while the sheet is open closes it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.isConnected]);

  const take = async () => {
    setTaking(true);
    setError(null);
    try {
      seat.acceptTerms();
      await seat.takeSeat();
      haptic.success();
      close();
    } catch (failure) {
      haptic.error();
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setTaking(false);
    }
  };

  return (
    <WalletSheet closeRef={drawer}>
      <View style={styles.mobile}>
        <View style={[styles.head, { backgroundColor: color.surface1 }]}>
          <View style={styles.headRow}>
            <Text style={[styles.title, { color: color.ink }]} accessibilityRole="header">
              {SEAT.sheet.title}
            </Text>
            <View style={styles.close}>
              <CloseButton onPress={close} />
            </View>
          </View>
        </View>
        <TakeSeat taking={taking} error={error} onTake={() => void take()} onBrowse={close} />
      </View>
    </WalletSheet>
  );
}

const styles = StyleSheet.create({
  // .wm-mobile: padding-bottom 36 + the safe area (the sheet adds the inset)
  mobile: { paddingBottom: 36 },
  head: { paddingTop: 14, paddingBottom: 4 },
  headRow: { justifyContent: "center", paddingHorizontal: 20, paddingBottom: 6 },
  title: { width: "100%", marginTop: 4, textAlign: "center", fontFamily: FONT.bodyBold, fontSize: 20, lineHeight: 24 },
  close: { position: "absolute", right: 14, top: 0, height: 32, justifyContent: "center" },
});
