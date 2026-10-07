import { formatCadence } from "@owarine/core/copy";
import { PRIVATE_BUCKET, type PrivatePosition } from "@owarine/core/private";
import { formatBaseUnits } from "@owarine/core/units";
import { LoaderCircle, ShieldCheck } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { PRIVATE } from "@/features/private/copy";
import { usePrivateCashout } from "@/features/private/usePrivateCashout";
import { usePortfolioTokens } from "~/components/portfolio/web";
import { FONT } from "~/theme";
import { usePlateInk } from "../usePlateInk";

const closeLabel = (expirySec: number) => `${new Date(expirySec * 1000).toISOString().slice(11, 16)} UTC`;

function sinceLabel(tsSec: number, nowMs: number): string {
  const mins = Math.max(0, Math.round((nowMs - tsSec * 1000) / 60_000));
  if (mins < 1) return PRIVATE.claims.just;
  if (mins < 60) return PRIVATE.claims.minutes(mins);
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return PRIVATE.claims.hours(hrs);
  return PRIVATE.claims.days(Math.round(hrs / 24));
}

interface Props {
  /** The seat's private calls from the ledger; null while the first read is in flight. */
  positions: readonly PrivatePosition[] | null;
  decimals: number;
  symbol: string;
}

/**
 * web `PrivateClaims` in the plate (private-claims.css `.plate-rows .pc*`), on Canton (C8d): the seat's private calls
 * read from the ledger, each "On the ledger"; a settled one shows its result, already in the private balance since
 * abu-pm-main 0.5.2 (K-315); only a call the 0.5.1 engine paid into the public balance shows Cash out. Nothing to back up:
 * the seat's own ledger is the record.
 */
export function PrivateClaims({ positions, decimals, symbol }: Props) {
  const ink = usePlateInk();
  const t = usePortfolioTokens();
  const cashout = usePrivateCashout(() => undefined, decimals, symbol);
  const nowMs = Date.now();
  const rows = positions ?? [];

  return (
    <View style={[styles.pc, { borderColor: ink.line, backgroundColor: ink.raised }]}>
      <View style={styles.head}>
        <View style={styles.headText}>
          <Text style={[styles.title, { color: ink.ink }]}>{PRIVATE.claims.title}</Text>
          <Text style={[styles.sub, { color: ink.mute }]}>{PRIVATE.claims.sub}</Text>
        </View>
      </View>
      {positions === null ? <Text style={[styles.note, { color: t.ink78 }]}>{PRIVATE.claims.checking}</Text> : null}
      {positions !== null && rows.length === 0 ? (
        <View style={[styles.pc, styles.empty, { borderColor: ink.line, backgroundColor: ink.raised }]}>
          <Text style={[styles.title, { color: ink.ink }]}>{PRIVATE.claims.emptyTitle}</Text>
          <Text style={[styles.sub, { color: ink.mute }]}>{PRIVATE.claims.emptySub}</Text>
        </View>
      ) : null}
      <View style={styles.list}>
        {rows.map((p) => {
          const busy = cashout.busySlot === p.pairId;
          const cost = BigInt(p.costBase);
          const payout = p.payoutBase !== null ? BigInt(p.payoutBase) : null;
          const up = p.side === "up";
          const won = payout !== null && payout >= cost;
          return (
            <View key={p.pairId} style={[styles.row, { borderColor: ink.line }]}>
              <View style={styles.rowMain}>
                <Text style={[styles.side, { color: up ? t.pcUp : t.pcDown, backgroundColor: up ? t.pcUpWash : t.pcDownWash }]}>{up ? "UP" : "DOWN"}</Text>
                <Text style={[styles.strike, { color: ink.ink }]}>
                  {p.asset} {formatCadence(p.intervalSec)} · {closeLabel(p.expirySec)}
                </Text>
                <Text style={[styles.stake, { color: ink.mute }]}>
                  {formatBaseUnits(cost, decimals)} {symbol}
                </Text>
                {payout !== null && p.status !== "open" ? (
                  <Text style={[styles.payout, { color: won ? t.pcUp : t.pcDown }]}>
                    {won ? "+" : "−"}
                    {formatBaseUnits(won ? payout - cost : cost - payout, decimals)}
                  </Text>
                ) : null}
                <Text style={[styles.when, { color: t.ink50 }]}>{sinceLabel(p.openedAtSec, nowMs)}</Text>
              </View>
              <View style={styles.rowSide}>
                <View style={styles.checkRow}>
                  <ShieldCheck size={14} color={t.pcUp} />
                  <Text style={[styles.check, { color: t.pcUp }]}>{PRIVATE.claims.verified}</Text>
                </View>
                {p.status === "settled" ? (
                  <Pressable onPress={() => void cashout.cashOut(p)} disabled={busy} accessibilityRole="button" style={[styles.cash, { backgroundColor: ink.ink }, busy && styles.half]}>
                    {busy ? <LoaderCircle size={14} color={ink.paper} /> : null}
                    <Text style={[styles.cashText, { color: ink.paper }]}>{busy ? PRIVATE.claims.cashingOut : PRIVATE.claims.cashOut}</Text>
                  </Pressable>
                ) : (
                  <Text style={[styles.status, { color: t.ink50 }]} accessibilityHint={p.paidInto === PRIVATE_BUCKET ? PRIVATE.claims.paidPrivateTitle : undefined}>
                    {p.status === "credited" ? (p.paidInto === PRIVATE_BUCKET ? PRIVATE.claims.paidPrivate : PRIVATE.claims.credited) : PRIVATE.claims.open}
                  </Text>
                )}
              </View>
            </View>
          );
        })}
      </View>
      <Text style={[styles.foot, { color: ink.mute }]}>{PRIVATE.claims.foot}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pc: { borderWidth: 1, borderRadius: 16, padding: 16 },
  empty: { marginTop: 14 },
  head: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  headText: { flexShrink: 1 },
  title: { fontFamily: FONT.bodyBold, fontSize: 14, lineHeight: 22.4 },
  sub: { marginTop: 2, fontFamily: FONT.body, fontSize: 12, lineHeight: 19.2 },
  note: { marginTop: 10, fontFamily: FONT.body, fontSize: 12, lineHeight: 19.2 },
  list: { marginTop: 14, gap: 8 },
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, borderWidth: 1, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12 },
  rowMain: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10, minWidth: 0, flexShrink: 1 },
  rowSide: { flexDirection: "row", alignItems: "center", gap: 10 },
  side: { fontFamily: FONT.bodyHeavy, fontSize: 11, letterSpacing: 0.66, paddingVertical: 2, paddingHorizontal: 8, borderRadius: 999, overflow: "hidden" },
  strike: { fontFamily: FONT.bodyBold, fontSize: 13, fontVariant: ["tabular-nums"] },
  stake: { fontFamily: FONT.body, fontSize: 12, fontVariant: ["tabular-nums"] },
  payout: { fontFamily: FONT.bodyBold, fontSize: 12, fontVariant: ["tabular-nums"] },
  when: { fontFamily: FONT.body, fontSize: 11 },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  check: { fontFamily: FONT.bodyBold, fontSize: 11 },
  cash: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 14 },
  cashText: { fontFamily: FONT.bodyBold, fontSize: 12 },
  half: { opacity: 0.5 },
  status: { fontFamily: FONT.body, fontSize: 11, textTransform: "capitalize" },
  foot: { marginTop: 14, fontFamily: FONT.body, fontSize: 11, lineHeight: 16.5 },
});
