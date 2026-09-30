import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { poolFullOf, takeOutcomeOf } from "@/features/canton-ux/seat/pool";
import { useWalletSession } from "@/lib/wallet-session";
import { WALLET_MODAL } from "@/providers/wallet/copy";
import { Button, haptic } from "~/components/kit";
import { CloseButton } from "~/components/wallet/sheet-parts";
import type { DrawerClose } from "~/components/drawer/BottomDrawer";
import { dismiss, WalletSheet } from "~/components/wallet/WalletSheet";
import { PoolFullPlate } from "~/features/connect/PoolFullPlate";
import { TakeSeat } from "~/features/connect/TakeSeat";
import { FONT, useTheme } from "~/theme";
import { SEAT } from "~/wallet/seat-copy";
import { useSeat } from "~/wallet/SeatProvider";

/**
 * Take a seat: where the reference's connect sheet was (web's `openPicker` lands here), in the same bottom sheet. It
 * restates the demo-credits terms, and its button accepts them and takes the seat; a seat already on this phone closes
 * the sheet at once. A failure stays on the sheet with the reason and the button to try again. A full pool is neither:
 * the sheet turns into the pool-full plate (web's `SeatLeaseDialog`) with the reader's place in line, the app keeps asking
 * for the seat by itself, and the sheet closes with the success haptic when one is leased.
 */
export default function ConnectSheet() {
  const { color } = useTheme();
  const session = useWalletSession();
  const seat = useSeat();
  const [taking, setTaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** The take was answered "pool full": this sheet waits in line. */
  const [waiting, setWaiting] = useState(false);
  const drawer = useRef<DrawerClose | null>(null);
  const close = () => (drawer.current ? drawer.current() : dismiss());

  useEffect(() => {
    if (session.isConnected && !taking) close();
    // Only a seat that appears while the sheet is open closes it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.isConnected]);

  const lease = seat.lease.view;
  // A retry the app made on its own (the pool-full wait) can be refused after the plate went up: the sheet says why.
  const failure = error ?? (waiting && lease?.kind === "refused" ? lease.diagnosis.technical : null);
  // The seat frees while the plate is up: the wait is over.
  useEffect(() => {
    if (waiting && lease?.kind === "leased") {
      haptic.success();
      close();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waiting, lease?.kind]);

  const take = async () => {
    setTaking(true);
    setError(null);
    try {
      seat.acceptTerms();
      const outcome = takeOutcomeOf(await seat.takeSeat());
      if (outcome === "seated") {
        haptic.success();
        close();
      } else if (outcome === "waiting") {
        // Not a success (no seat yet) and not a failure (a place in line): the plate says which.
        haptic.select();
        setWaiting(true);
      } else {
        haptic.error();
        setError(WALLET_MODAL.lease.notLiveBody);
      }
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
        {waiting && lease?.kind === "pool-full" ? (
          <View style={styles.plate}>
            <PoolFullPlate {...poolFullOf(lease)} />
            <Button label={WALLET_MODAL.lease.wait} variant="secondary" size="lg" onPress={close} />
          </View>
        ) : (
          <TakeSeat taking={taking} error={failure} onTake={() => void take()} onBrowse={close} onLink={() => (drawer.current ? drawer.current(() => router.push("/seat/link")) : (dismiss(), router.push("/seat/link")))} />
        )}
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
  plate: { gap: 12, paddingTop: 12, paddingHorizontal: 24 },
});
