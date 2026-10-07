import { partyLead } from "@owarine/core/units";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ID_LABEL } from "@/features/canton-ux/id-label";
import { emojiAvatarFor, formatAccountAddress } from "@/providers/wallet/emoji-avatar";
import { useWalletSession } from "@/lib/wallet-session";
import { haptic } from "~/components/kit";
import { TapHash } from "~/components/ui/TapHash";
import { CopiedIcon, CopyIcon, DisconnectIcon } from "~/components/wallet/profile-icons";
import { Link2 } from "lucide-react-native";
import { CloseButton } from "~/components/wallet/sheet-parts";
import type { DrawerClose } from "~/components/drawer/BottomDrawer";
import { dismiss, WalletSheet } from "~/components/wallet/WalletSheet";
import { AVATAR_COLORS, FONT, useTheme } from "~/theme";
import { SEAT } from "~/wallet/seat-copy";
import { useSeat } from "~/wallet/SeatProvider";
import type { SeatLeaseView } from "@owarine/markets";

const COPIED_MS = 1_500;
const T = SEAT.account;

/**
 * web `AccountModal` (RainbowKit's `ProfileDetails`) in its phone sheet, for a seat: the 82 pt emoji avatar, the short
 * seat ID at 20, the lease's honest state, and Copy seat ID / Reset seat as two surface-2 tiles. Reset asks first, in
 * place: it forgets the seat's key for good, so the second tap names what is lost.
 */
export default function AccountSheet() {
  const { color } = useTheme();
  const session = useWalletSession();
  const seat = useSeat();
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const drawer = useRef<DrawerClose | null>(null);
  const close = (after?: () => void) => (drawer.current ? drawer.current(after) : (dismiss(), after?.()));
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);
  const address = session.address;
  const avatar = address ? emojiAvatarFor(address) : null;

  return (
    <WalletSheet closeRef={drawer}>
      {address && avatar ? (
        <View style={[styles.profile, { backgroundColor: color.surface1 }]}>
          <View style={styles.close}>
            <CloseButton onPress={() => close()} />
          </View>
          <View style={styles.id}>
            <View style={[styles.avatar, { backgroundColor: AVATAR_COLORS[Number(avatar.colorClass.slice("wm-ava-".length))] ?? AVATAR_COLORS[0] }]} accessibilityElementsHidden>
              <Text style={styles.emoji}>{avatar.emoji}</Text>
            </View>
            {/* Base58 is shown exactly as written, never re-cased (D-010). */}
            <Text style={[styles.name, { color: color.ink }]} accessibilityRole="header" accessibilityLabel={address}>
              {formatAccountAddress(address)}
            </Text>
            <LeaseLine view={seat.lease.view} />
          </View>
          {confirming ? (
            <>
              <Text style={[styles.note, styles.warning, { color: color.loss }]} accessibilityRole="alert">
                {T.resetWarning}
              </Text>
              <View style={styles.actions}>
                <Action label={T.resetCancel} icon={<CopiedIcon color={color.ink} />} onPress={() => setConfirming(false)} />
                <Action label={T.resetConfirm} icon={<DisconnectIcon color={color.loss} />} onPress={() => close(() => void seat.resetSeat())} />
              </View>
            </>
          ) : (
            <View style={styles.actions}>
              <Action
                label={copied ? T.copied : T.copy}
                icon={copied ? <CopiedIcon color={color.ink} /> : <CopyIcon color={color.ink} />}
                onPress={() => {
                  void Clipboard.setStringAsync(address).then(() => setCopied(true), () => undefined);
                }}
              />
              {seat.lease.view && seat.lease.view.kind !== "leased" && seat.lease.view.kind !== "pool-full" ? (
                <Action label={seat.lease.leasing ? T.leasing : T.lease} icon={<CopiedIcon color={color.ink} />} disabled={seat.lease.leasing} onPress={() => void seat.lease.lease()} />
              ) : null}
              {/* Only the phone that took the seat shows link codes; a joined phone cannot pass the seat on. */}
              {seat.lease.view?.kind === "leased" && seat.lease.view.address === address ? (
                <Action label={SEAT.link.entry} icon={<Link2 size={16} color={color.ink} />} onPress={() => close(() => router.push("/seat/link"))} />
              ) : null}
              <Action label={T.reset} icon={<DisconnectIcon color={color.ink} />} onPress={() => setConfirming(true)} />
            </View>
          )}
        </View>
      ) : null}
    </WalletSheet>
  );
}

/** The lease under the seat ID: the leased party (hint and fingerprint head; a tap shows all of it), or its honest state. */
function LeaseLine({ view }: { view: SeatLeaseView | null }) {
  const { color } = useTheme();
  const note = [styles.note, { color: color.inkSecondary }];
  if (view?.kind === "leased") {
    const part = [styles.note, { color: color.inkSecondary, paddingHorizontal: 0 }];
    return (
      <View style={styles.party}>
        <Text style={part}>{T.party}:</Text>
        <TapHash value={view.party} lead={partyLead(view.party)} label={ID_LABEL.party} style={part} />
      </View>
    );
  }
  return <Text style={note}>{leaseLine(view)}</Text>;
}

function leaseLine(view: Exclude<SeatLeaseView, { kind: "leased" }> | null): string {
  if (view === null) return T.leaseReading;
  switch (view.kind) {
    case "pool-full":
      return T.leasePoolFull;
    case "not-live":
      return T.leaseNotLive;
    case "refused":
      return T.leaseRefused;
    case "none":
      return T.leaseNone;
  }
}

function Action({ label, icon, onPress, disabled = false }: { label: string; icon: ReactNode; onPress: () => void; disabled?: boolean }) {
  const { color } = useTheme();
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        onPress();
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, busy: disabled }}
      style={({ pressed }) => [styles.action, { backgroundColor: color.surface2 }, pressed && styles.shrink, disabled && styles.off]}
    >
      <View style={styles.actionIcon}>{icon}</View>
      <Text style={[styles.actionLabel, { color: color.ink }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // .wm-profile: padding 16; its close at right 16, top 16
  profile: { padding: 16 },
  close: { position: "absolute", right: 16, top: 16, zIndex: 1 },
  id: { alignItems: "center", justifyContent: "center", gap: 16, margin: 8 },
  avatar: { width: 82, height: 82, borderRadius: 9999, marginTop: 24, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  emoji: { fontSize: 45, lineHeight: 54 },
  name: { fontFamily: FONT.bodyHeavy, fontSize: 20, lineHeight: 24, textAlign: "center" },
  party: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "center", gap: 6, paddingHorizontal: 8 },
  note: { fontFamily: FONT.body, fontSize: 13, lineHeight: 18, textAlign: "center", paddingHorizontal: 8 },
  warning: { marginTop: 12 },
  actions: { flexDirection: "row", gap: 8, margin: 2, marginTop: 16 },
  action: { flex: 1, padding: 6, paddingTop: 8, borderRadius: 8, alignItems: "center", justifyContent: "center", gap: 1 },
  actionIcon: { height: 16, justifyContent: "center" },
  actionLabel: { fontFamily: FONT.bodyStrong, fontSize: 12, lineHeight: 18 },
  shrink: { transform: [{ scale: 0.9 }] },
  off: { opacity: 0.5 },
});
