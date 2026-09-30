import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { X } from "lucide-react-native";
import { diagnosisCopy } from "@agari/core/copy";
import { FUNDING } from "@/features/funding/copy";
import { useSeatCredit } from "@/features/funding/useSeatCredit";
import { useWalletSession } from "@/lib/wallet-session";
import { CcRailCard } from "~/components/funding/CcRailCard";
import { CreditWelcome } from "~/components/funding/CreditWelcome";
import { FootLine, FundingFacts, fundStyles } from "~/components/funding/FundingFacts";
import { BottomDrawer, type DrawerClose } from "~/components/drawer/BottomDrawer";
import { WebButton } from "~/components/portfolio/web";
import { dismiss } from "~/components/wallet/WalletSheet";
import { FONT, useTheme } from "~/theme";
import { walletTokens } from "~/theme/web/portfolio-wallet";
import { SEAT } from "~/wallet/seat-copy";

const short = (a: string) => `${a.slice(0, 8)}…${a.slice(-6)}`;
const F = SEAT.funds;

/**
 * web `AddFunds` in the app's bottom drawer (the owner's call, 09-25: Add funds rises from the bottom on a phone) — web's
 * card paper, border, 28 of padding and gray-600 X, over the blurred scrim — for a seat: the glowing eyebrow, "Demo
 * credits", what they are (no cash value, nothing to buy, sell or withdraw), the seat row that copies, the credits and
 * their cash value, and the grant pill. The grant is the seat funding its lease asks for (web's `useSeatCredit`), so the
 * pill leases or re-leases the seat; there is no faucet, no network-fee line and no outside link.
 */
export default function FundsModal() {
  const { color, name } = useTheme();
  const t = walletTokens(name);
  const session = useWalletSession();
  const { address } = session;
  const credit = useSeatCredit();
  const [copied, setCopied] = useState(false);
  const drawer = useRef<DrawerClose | null>(null);
  const close = (after?: () => void) => (drawer.current ? drawer.current(after) : (dismiss(), after?.()));

  return (
    <View style={styles.fill}>
      <BottomDrawer
        onClose={dismiss}
        closeRef={drawer}
        closeLabel={FUNDING.modal.close}
        background={t.fundPaper}
        border={t.fundBorder}
        contentStyle={styles.sheet}
        corner={
          <Pressable onPress={() => close()} accessibilityRole="button" accessibilityLabel={FUNDING.modal.close} hitSlop={8} style={({ pressed }) => [styles.x, pressed && { backgroundColor: t.fundLine }]}>
            <X size={16} color={color.inkDisabled} />
          </Pressable>
        }
      >
        <View style={styles.eyebrowRow}>
          <View style={[styles.dot, { backgroundColor: t.vermilion, shadowColor: t.vermilion }]} />
          <Text style={[styles.eyebrow, { color: color.inkMuted }]}>{F.eyebrow}</Text>
        </View>
        <Text style={[styles.title, { color: color.ink }]} accessibilityRole="header">
          {F.title}
        </Text>
        <Text style={[styles.body, { color: color.inkSecondary }]}>{F.body}</Text>

        {!address ? (
          <View style={styles.connectFirst}>
            <Text style={[styles.connectLine, { color: color.inkMuted }]}>{F.takeSeatFirst}</Text>
            <WebButton label={SEAT.sheet.title} onPress={() => close(() => router.push("/connect"))} style={styles.center} />
          </View>
        ) : (
          <>
            <View style={[styles.account, { borderColor: t.fundLine }]}>
              <Text style={[styles.accountLabel, { color: color.inkMuted }]}>{F.account}</Text>
              <Pressable
                onPress={() => {
                  void Clipboard.setStringAsync(address);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                accessibilityRole="button"
                accessibilityLabel={SEAT.account.copy}
                hitSlop={8}
              >
                {({ pressed }) => <Text style={[styles.addr, { color: pressed ? color.ink : t.addrInk }]}>{copied ? F.copied : `${short(address)} ⧉`}</Text>}
              </Pressable>
            </View>

            <FundingFacts />

            <View style={styles.rows}>
              {credit.status === "funded" ? (
                <WebButton label={FUNDING.seat.trade} onPress={() => close(() => router.push("/markets"))} style={styles.center} />
              ) : (
                <Pressable
                  onPress={() => void credit.request()}
                  disabled={credit.busy}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: credit.busy, busy: credit.busy }}
                  style={({ pressed }) => [styles.pill, { backgroundColor: t.ctaWhite }, (pressed || credit.busy) && styles.inert]}
                >
                  <Text style={[styles.pillText, { color: t.ctaWhiteInk }]}>{credit.busy ? FUNDING.seat.requesting : credit.status === "unleased" ? FUNDING.seat.lease : F.request}</Text>
                </Pressable>
              )}
              <View style={styles.center} accessibilityLiveRegion="polite">
                <FootLine text={credit.status === "funded" ? FUNDING.seat.funded : credit.status === "unleased" ? FUNDING.seat.unleased : FUNDING.seat.unfunded} />
              </View>
              {/* A refused lease or grant says so (web's `fund-msg--err`); the reference drew its faucet failure here in the same place and ink. */}
              {credit.refusal ? (
                <Text style={[fundStyles.msg, { color: color.loss }]} accessibilityRole="alert">
                  {diagnosisCopy(credit.refusal.kind).headline}
                </Text>
              ) : null}
            </View>
            <CcRailCard />
          </>
        )}
      </BottomDrawer>
      <CreditWelcome local />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  sheet: { paddingHorizontal: 28, paddingTop: 12, paddingBottom: 28 },
  x: { borderRadius: 999, padding: 8 },
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  dot: { width: 6, height: 6, borderRadius: 999, shadowOpacity: 1, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
  eyebrow: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 2, textTransform: "uppercase" },
  title: { fontFamily: FONT.headingHeavy, fontSize: 24, lineHeight: 28.8, letterSpacing: -0.6, marginBottom: 4, paddingRight: 24 },
  body: { fontFamily: FONT.body, fontSize: 14, lineHeight: 22.75, marginBottom: 24 },
  connectFirst: { alignItems: "center", gap: 16, paddingVertical: 24 },
  connectLine: { fontFamily: FONT.dataRegular, fontSize: 12, lineHeight: 19.2, textAlign: "center" },
  center: { alignSelf: "center" },
  account: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16 },
  accountLabel: { fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6 },
  addr: { fontFamily: FONT.dataRegular, fontSize: 12, lineHeight: 19.2 },
  rows: { gap: 10 },
  pill: { alignSelf: "stretch", borderRadius: 999, paddingVertical: 12, alignItems: "center", justifyContent: "center" },
  pillText: { fontFamily: FONT.bodyStrong, fontSize: 15, lineHeight: 24 },
  inert: { opacity: 0.6 },
});
