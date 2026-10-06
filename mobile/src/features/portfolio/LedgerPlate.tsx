import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { PLATE } from "@/features/markets/portfolio/plate/copy";
import type { Money } from "@/features/markets/portfolio/plate/useMoney";
import { PillButton } from "~/components/portfolio/web";
import { FONT } from "~/theme";
import { fmt2 } from "./format";
import { usePlateInk } from "./usePlateInk";

/** yosuku `.ledger-plate::before`: a 4 px band of 2 px ticks every 10 px across the plate's top edge. */
export function PlateTicks({ color }: { color: string }) {
  return (
    <View style={styles.ticks} pointerEvents="none">
      {Array.from({ length: 80 }, (_, i) => (
        <View key={i} style={[styles.tick, { backgroundColor: color }]} />
      ))}
    </View>
  );
}

/** One leg of the balance, tied to its bar segment by colour so the bar needs no legend of its own. */
function Leg({ dot, label, value }: { dot: string; label: string; value: string }) {
  const ink = usePlateInk();
  return (
    <View style={styles.leg} accessible accessibilityLabel={`${label}: ${value}`}>
      <View style={[styles.legDot, { backgroundColor: dot }]} />
      <Text style={[styles.legLabel, { color: ink.mute }]}>{label}</Text>
      <Text style={[styles.legValue, { color: ink.ink }]}>{value}</Text>
    </View>
  );
}

interface LedgerPlateProps {
  money: Money;
  symbol: string;
  openBets: number;
  settled: number;
  onPrimary: () => void;
  /** The pool rows and the Trading Balance disclosure: the account is the parent, they are its children. */
  children?: ReactNode;
}

/**
 * web `LedgerPlate` + ledger-plate.css at 402 px (`.ledger-plate` 16/14, radius 5, the tick band), as C7a made it: the one
 * number is the balance sheet (demo credits, open positions at the venue mid, what is waiting to be collected), "ready to
 * bet" under it with the named pools that are never summed in, the full-width pill, then the three-segment bar and its
 * legs. The phone kept the Solana-era "In your seat / In your Trading Balance" legs until C4f: on Canton the seat's cash
 * is the Trading Balance (K-087), so the second leg read 0.00 beside a Trading Balance panel holding the same cash.
 */
export function LedgerPlate({ money, symbol, openBets, settled, onPrimary, children }: LedgerPlateProps) {
  const ink = usePlateInk();
  const { decimals } = money;
  const credits = money.walletBase + money.accountBase;
  const empty = credits === 0n && money.positionsBase === 0n && money.claimableBase === 0n;
  const total = money.totalBase;
  const pct = (part: bigint) => (total > 0n ? Number((part * 1000n) / total) / 10 : 0);
  /** Pools that are yours but not in this figure: named with their amounts, never added. */
  const named = money.pools.filter((pool) => (pool.amountBase ?? 0n) > 0n);
  const figure = money.totalUnknown ? "0.00" : fmt2(total, decimals);

  return (
    <View style={[styles.plate, { backgroundColor: ink.paper }]}>
      <PlateTicks color={ink.line} />
      <View style={styles.top}>
        <View>
          <Text style={[styles.eyebrow, { color: ink.mute }]}>{PLATE.balanceEyebrow}</Text>
          <View style={styles.figureRow} accessible accessibilityLabel={`${PLATE.balanceEyebrow}: ${figure} ${symbol}`}>
            <Text style={[styles.figure, { color: ink.figure }, !money.totalBaseReady && styles.pending]}>{figure}</Text>
            <Text style={[styles.unit, { color: ink.mute }]}>{symbol}</Text>
          </View>
          <Text style={[styles.elsewhere, { color: ink.mute }]}>
            <Text style={[styles.tab, { color: ink.ink }]}>{fmt2(money.readyToBetBase, decimals)}</Text> {PLATE.readyToBet}
            {named.map((pool) => (
              <Text key={pool.id}>
                {" · "}
                {pool.label} <Text style={[styles.tab, { color: ink.ink }]}>{fmt2(pool.amountBase ?? 0n, decimals)}</Text> {PLATE.notSummed}
              </Text>
            ))}
          </Text>
        </View>
        <PillButton label={empty ? PLATE.getTest : PLATE.addMoney} onPress={onPrimary} block />
      </View>

      <View style={styles.split} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={[styles.bar, { backgroundColor: ink.line }]}>
          <View style={{ width: `${pct(credits)}%`, backgroundColor: ink.wallet }} />
          <View style={{ width: `${pct(money.positionsBase)}%`, backgroundColor: ink.positions }} />
          <View style={{ width: `${pct(money.claimableBase)}%`, backgroundColor: ink.account }} />
        </View>
      </View>
      <View style={styles.legs}>
        <Leg dot={ink.wallet} label={PLATE.legs.credits} value={fmt2(credits, decimals)} />
        <Leg dot={ink.positions} label={PLATE.legs.positions} value={fmt2(money.positionsBase, decimals)} />
        <Leg dot={ink.account} label={PLATE.legs.collect} value={fmt2(money.claimableBase, decimals)} />
        <Text style={[styles.counts, { color: ink.mute }]}>
          <Text style={[styles.tab, { color: ink.ink }]}>{openBets}</Text> {PLATE.open} <Text style={{ color: ink.line }}>·</Text>{" "}
          <Text style={[styles.tab, { color: ink.ink }]}>{settled}</Text> {PLATE.settled}
        </Text>
      </View>

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  plate: { borderRadius: 5, paddingVertical: 16, paddingHorizontal: 14, overflow: "hidden" },
  ticks: { position: "absolute", top: 0, left: 0, right: 0, height: 4, flexDirection: "row", overflow: "hidden" },
  tick: { width: 2, height: 4, marginLeft: 8 },
  top: { gap: 16 },
  eyebrow: { fontFamily: FONT.dataRegular, fontSize: 9, lineHeight: 14.4, letterSpacing: 1.44, textTransform: "uppercase" },
  figureRow: { marginTop: 4, flexDirection: "row", alignItems: "baseline", gap: 8 },
  figure: { fontFamily: FONT.headingHeavy, fontSize: 32, lineHeight: 34, fontVariant: ["tabular-nums"] },
  pending: { opacity: 0.55 },
  unit: { fontFamily: FONT.dataRegular, fontSize: 12, lineHeight: 19.2 },
  elsewhere: { marginTop: 4, fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6 },
  tab: { fontVariant: ["tabular-nums"] },
  split: { marginTop: 16 },
  bar: { flexDirection: "row", height: 6, borderRadius: 999, overflow: "hidden" },
  legs: { marginTop: 8, flexDirection: "row", flexWrap: "wrap", columnGap: 32, rowGap: 4 },
  leg: { flexDirection: "row", alignItems: "center", gap: 8 },
  legDot: { width: 8, height: 8, borderRadius: 999 },
  legLabel: { fontFamily: FONT.body, fontSize: 12, lineHeight: 19.2 },
  legValue: { fontFamily: FONT.dataRegular, fontSize: 13, lineHeight: 20.8, fontVariant: ["tabular-nums"] },
  counts: { marginLeft: "auto", fontFamily: FONT.dataRegular, fontSize: 12, lineHeight: 19.2 },
});
