import type { BookedOrder } from "@agari/core/ports";
import type { EventMarket } from "@agari/core/types";
import { formatBaseUnits } from "@agari/core/units";
import { useOpeningPrice } from "@agari/markets/react";
import { router } from "expo-router";
import { ArrowDown, ArrowUp, ArrowUpRight } from "lucide-react-native";
import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { useReducedMotion, ZoomIn } from "react-native-reanimated";
import { useChainNowMs } from "@/features/markets/useChainNow";
import { usePlacedWindow } from "@/features/markets/ticket/placed-window";
import { useSettlementFee } from "@/features/markets/verdict/useVerdict";
import { buildCallTweetText, callBandLabel, callMultiple, callWinBase, shortCallId, type CallCard } from "@/features/share/call-card";
import { SHARE } from "@/features/share/copy";
import { Countdown } from "~/features/markets/parts/Countdown";
import { ShareButton } from "~/features/markets/share/ShareButton";
import { LiveVerdict } from "~/features/markets/verdict/LiveVerdict";
import { openLedgerLink } from "~/lib/external";
import { FONT, RADIUS, TYPE, useTheme } from "~/theme";
import { LIGHT } from "~/theme/palette";
import { WhoCanSee } from "~/features/privacy/WhoCanSee";

interface Props {
  booked: BookedOrder;
  market: EventMarket;
  decimals: number;
  symbol: string;
  /** A boost's multiple and the reserve's claim; null for a plain call. */
  leverage?: { leverageBps: number; frontedBase: bigint } | null;
  onAnother: () => void;
}

/**
 * web's PlacedCall → The Call: the booked order and its Window as the chain has them, on the cream paper card — the
 * side, the band, what was staked and what it wins if it lands (net of the fee once read), the clock to the bell and
 * the entry tx. Past the bell the same sheet carries the verdict and the claim, so the loop closes where it began.
 */
export function CallReceipt({ booked, market, decimals, symbol, leverage = null, onAnother }: Props) {
  const { color } = useTheme();
  const reduce = useReducedMotion();
  const nowMs = useChainNowMs();
  // The Window the fill landed in, from the order: inside the no-entry buffer the ticket advances, even while a firm
  // quote is held, and the call stays (web's PlacedCall, `usePlacedWindow`).
  const placedIn = usePlacedWindow(booked, market);
  const [placedAtMs] = useState(() => Date.now());
  const opening = useOpeningPrice(booked.marketId);
  const fee = useSettlementFee(booked.marketId, true);
  const paper = useRef<View>(null);
  if (!placedIn) return null;
  const card: CallCard = {
    asset: placedIn.asset,
    side: booked.side,
    intervalSec: placedIn.intervalSec,
    lineRaw: opening?.ok ? opening.value : placedIn.openingPriceRaw,
    stakeBase: booked.costBase,
    contractsRaw: booked.contractsRaw,
    decimals,
    symbol,
    feeBps: fee?.ok ? fee.value : null,
    expirySec: placedIn.expirySec,
    txHash: booked.txHash,
    placedAtMs,
    leverage,
  };
  const ink = color.creamInk;
  // The paper is cream in both themes, so its inks are the light ramp's.
  const sideInk = booked.side === "up" ? LIGHT.profit : LIGHT.loss;
  const pastBell = nowMs > 0 && nowMs >= placedIn.expirySec * 1000;
  const multiple = callMultiple(card);

  return (
    <View style={styles.stack}>
      <Animated.View ref={paper} collapsable={false} entering={reduce ? undefined : ZoomIn.springify().damping(16)} style={[styles.paper, { backgroundColor: color.cream, shadowColor: color.shadow }]}>
        <View style={styles.top}>
          <Text style={[TYPE.labelMicro, { color: ink, opacity: 0.6 }]}>{SHARE.call.recordType}</Text>
          <Text style={[TYPE.labelMicro, { color: ink, opacity: 0.6 }]}>#{shortCallId(card)}</Text>
        </View>
        <View style={styles.sideRow}>
          {booked.side === "up" ? <ArrowUp size={22} color={sideInk} strokeWidth={2.25} /> : <ArrowDown size={22} color={sideInk} strokeWidth={2.25} />}
          <Text style={[styles.side, { color: sideInk }]}>{(booked.side === "up" ? SHARE.call.up : SHARE.call.down).replace(/^\S+\s/, "")}</Text>
        </View>
        <Text style={[TYPE.title, { color: ink }]}>{callBandLabel(card)}</Text>
        <Text style={[TYPE.caption, { color: ink, opacity: 0.7 }]}>{SHARE.call.winsIf(placedIn.asset, booked.side)}</Text>
        {leverage ? <Text style={[TYPE.caption, { color: LIGHT.accent }]}>{SHARE.call.leverageNote(multiple)}</Text> : null}
        <View style={[styles.rule, { borderColor: color.creamHairline }]} />
        <View style={styles.row}>
          <Figure label={SHARE.call.youStake} value={`${formatBaseUnits(booked.costBase, decimals)} ${symbol}`} ink={ink} />
          <Figure label={SHARE.call.winIfLands} value={`${formatBaseUnits(callWinBase(card), decimals)} ${symbol}`} ink={sideInk} note={card.feeBps !== null ? SHARE.call.afterFee : undefined} />
        </View>
        <View style={[styles.rule, { borderColor: color.creamHairline }]} />
        <View style={styles.row}>
          <Text style={[TYPE.caption, { color: ink, opacity: 0.7 }]}>{pastBell ? SHARE.call.settling : SHARE.call.settlesIn}</Text>
          {pastBell ? null : <Countdown expirySec={placedIn.expirySec} intervalSec={placedIn.intervalSec} nowMs={nowMs} style={[TYPE.dataLg, { color: ink }]} />}
        </View>
        <Pressable onPress={() => openLedgerLink("tx", booked.txHash)} accessibilityRole="link" style={styles.tx} hitSlop={8}>
          <Text style={[TYPE.data, { color: LIGHT.accent }]}>{SHARE.call.tx(booked.txHash.slice(0, 10))}</Text>
          <ArrowUpRight size={12} color={LIGHT.accent} />
        </Pressable>
        <View style={styles.actions}>
          <Pressable
            onPress={() => {
              router.back();
              router.navigate("/portfolio");
            }}
            accessibilityRole="button"
            style={[styles.action, { borderColor: color.creamHairline }]}
          >
            <Text style={[styles.actionText, { color: ink }]}>{SHARE.call.portfolio}</Text>
          </Pressable>
          <Pressable onPress={onAnother} accessibilityRole="button" style={[styles.action, { borderColor: color.creamHairline }]}>
            <Text style={[styles.actionText, { color: ink }]}>{SHARE.call.another}</Text>
          </Pressable>
        </View>
      </Animated.View>
      {/* web's PlacedCall names who can see the new position beside its update; off the paper, in the page's own tones. */}
      <WhoCanSee kind="position" />
      <ShareButton text={buildCallTweetText(card)} card={paper} label={SHARE.shareCall} />
      {pastBell ? <LiveVerdict marketId={placedIn.marketId} /> : null}
    </View>
  );
}

function Figure({ label, value, ink, note }: { label: string; value: string; ink: string; note?: string }) {
  return (
    <View style={styles.figure}>
      <Text style={[TYPE.labelMicro, { color: ink, opacity: 0.6 }]}>{label}</Text>
      <Text style={[TYPE.dataLg, { color: ink }]} adjustsFontSizeToFit numberOfLines={1}>
        {value}
      </Text>
      {note ? <Text style={[TYPE.caption, { color: ink, opacity: 0.55 }]}>{note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 14 },
  paper: { borderRadius: RADIUS.lg, padding: 20, gap: 8, shadowOpacity: 0.25, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } },
  top: { flexDirection: "row", justifyContent: "space-between" },
  sideRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  side: { fontFamily: FONT.stamp, fontSize: 26 },
  rule: { borderTopWidth: 1, borderStyle: "dashed", marginVertical: 6 },
  row: { flexDirection: "row", gap: 12, justifyContent: "space-between", alignItems: "center" },
  figure: { flex: 1, gap: 2 },
  tx: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 32 },
  actions: { flexDirection: "row", gap: 10, marginTop: 8 },
  action: { flex: 1, height: 44, borderRadius: RADIUS.md, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  actionText: { fontFamily: FONT.bodyStrong, fontSize: 14 },
});
