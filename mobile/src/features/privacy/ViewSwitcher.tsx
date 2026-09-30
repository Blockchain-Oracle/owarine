import type { MarketId } from "@agari/core/types";
import { partyLead, shortHex } from "@agari/core/units";
import { useLedgerViews, type LedgerViewAs } from "@agari/markets/react";
import * as Clipboard from "expo-clipboard";
import { Check, Copy, RefreshCw, UserX } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { PRIVACY } from "@/features/canton-ux/privacy/copy";
import { viewOf, type PartyView } from "@/features/canton-ux/privacy/party-views";
import { SIDE_WORD } from "@/features/markets/side-styles";
import { Button, haptic } from "~/components/kit";
import { EmptyState, UnderlineTabs } from "~/features/desk/kit";
import { SectionHeader } from "~/features/explore/SectionHeader";
import { FONT, RADIUS, useTheme } from "~/theme";
import { WhoCanSee } from "./WhoCanSee";

const S = PRIVACY.switcher;
const COPIED_MS = 1_500;
const short = (party: string) => (party ? shortHex(party, partyLead(party), 4) : "…");

/**
 * web's `LiveViewSwitcher` + `ViewSwitcher` (C-ADD-02) ported literally for the phone's `/markets/<id>` page: the same
 * active-contracts query sent as Alice, Bob, an outsider and (once leased) this seat, through `/api/view`; the desk
 * kit's underline tabs; each panel exactly what the participant returned, with the literal request body beneath. An
 * empty list is the ledger's own answer, never a filter here.
 */
export function LiveViewSwitcher({ index, marketId, symbol, withSeat }: { index: string; marketId: MarketId | null; symbol: string; withSeat: boolean }) {
  const parties: LedgerViewAs[] = withSeat ? ["alice", "bob", "outsider", "me"] : ["alice", "bob", "outsider"];
  const results = useLedgerViews(parties);
  const views = parties.map((as, i) => viewOf(as, results[i]?.data, results[i]?.isFetching ?? true, marketId, symbol));
  const busy = results.some((r) => r.isFetching);
  const [value, setValue] = useState<string>(views[0]?.value ?? "alice");
  const view = views.find((v) => v.value === value) ?? views[0];
  return (
    <View style={styles.section} accessibilityLabel={S.title}>
      <SectionHeader
        index={index}
        title={S.title}
        eyebrow={S.live}
        aside={<Button label={S.again} icon={RefreshCw} variant="ghost" size="sm" block={false} loading={busy} onPress={() => results.forEach((r) => void r.refetch())} />}
      />
      <IntroText />
      <UnderlineTabs value={value} onChange={setValue} items={views.map((v) => ({ value: v.value, label: v.label, count: v.status ? undefined : v.positions.length }))} label={S.label} />
      {view ? <Panel view={view} /> : null}
    </View>
  );
}

function IntroText() {
  const { color } = useTheme();
  return <Text style={[styles.intro, { color: color.inkSecondary }]}>{S.intro}</Text>;
}

function Panel({ view }: { view: PartyView }) {
  const { color } = useTheme();
  return (
    <View style={styles.panel} accessibilityRole="summary">
      <View style={styles.head}>
        <Text style={[styles.headText, { color: color.inkMuted }]}>{S.asParty}</Text>
        <Text style={[styles.party, { color: color.ink }]} accessibilityLabel={view.party}>
          {short(view.party)}
        </Text>
        {!view.status ? <Text style={[styles.count, { color: color.inkMuted }]}>{S.returned(view.positions.length)}</Text> : null}
      </View>
      <Positions view={view} />
      <View style={styles.query}>
        <Text style={[styles.label, { color: color.inkMuted }]}>{S.query.toUpperCase()}</Text>
        <CodeBlock filename={view.request} code={view.query} label={S.queryLabel(view.label)} />
        {view.note ? <Text style={[styles.note, { color: color.inkMuted }]}>{view.note}</Text> : null}
      </View>
    </View>
  );
}

function Positions({ view }: { view: PartyView }) {
  const { color } = useTheme();
  if (view.status?.kind === "loading") return <Text style={[styles.status, { borderColor: color.hairline, color: color.inkSecondary }]}>{S.asking}</Text>;
  if (view.status?.kind === "error") {
    return (
      <Text style={[styles.status, { borderColor: color.hairline, color: color.loss }]} accessibilityRole="alert">
        {S.failed} <Text style={{ color: color.inkMuted }}>{view.status.text}</Text>
      </Text>
    );
  }
  if (view.positions.length === 0) return <EmptyState icon={UserX} title={S.emptyTitle} body={S.emptyBody} />;
  return (
    <View style={[styles.list, { borderColor: color.hairline, backgroundColor: color.surface1 }]} accessibilityLabel={S.returned(view.positions.length)}>
      {view.positions.map((p, i) => {
        const up = p.side === "up";
        return (
          <View key={p.contractId} style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: color.hairline }]}>
            <View style={styles.line}>
              <Text style={[styles.market, { color: color.ink }]} numberOfLines={1}>
                {p.market}
                {p.here ? <Text style={[styles.here, { color: color.accent }]}>{`  ${S.here.toUpperCase()}`}</Text> : null}
              </Text>
              <Text style={[styles.side, { borderColor: up ? color.profit : color.loss, backgroundColor: up ? color.profitWash : color.lossWash, color: up ? color.profit : color.loss }]}>
                {SIDE_WORD[p.side]}
              </Text>
            </View>
            <Text style={[styles.stake, { color: color.ink }]}>
              {p.stakeText} {p.priceCents !== null ? <Text style={{ color: color.inkMuted }}>{S.at(p.priceCents)}</Text> : null}
            </Text>
            <View style={styles.line}>
              <Text style={[styles.cid, { color: color.inkSecondary }]} numberOfLines={1}>
                <Text style={{ color: color.inkMuted }}>{S.contract}</Text> {`${p.contractId.slice(0, 6)}…${p.contractId.slice(-4)}`}
              </Text>
              <WhoCanSee kind="position" holder={view.label} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** web's Code Block (21st #23586 as adapted): the filename bar with copy, and the body in mono, scrolling sideways. */
function CodeBlock({ filename, code, label }: { filename: string; code: string; label: string }) {
  const { color } = useTheme();
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);
  const Icon = copied ? Check : Copy;
  return (
    <View style={[styles.code, { borderColor: color.hairline, backgroundColor: color.surface2 }]} accessibilityLabel={label}>
      <View style={[styles.codeBar, { borderBottomColor: color.hairline }]}>
        <Text style={[styles.codeFile, { color: color.inkSecondary }]} numberOfLines={1}>
          {filename}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copied ? "Copied" : "Copy the query"}
          hitSlop={15}
          disabled={!code}
          onPress={() => {
            haptic.select();
            void Clipboard.setStringAsync(code).then(() => setCopied(true), () => undefined);
          }}
        >
          <Icon size={14} color={color.inkSecondary} />
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.codeBody}>
        <Text style={[styles.codeText, { color: color.ink }]} selectable>
          {code || "…"}
        </Text>
      </ScrollView>
    </View>
  );
}

// web privacy.css `.cx-switcher*`, `.cx-position*` at phone width (the three-row grid), and code-block.css.
const styles = StyleSheet.create({
  section: { gap: 12 },
  intro: { fontFamily: FONT.body, fontSize: 13, lineHeight: 19.5 },
  panel: { gap: 16, paddingTop: 4 },
  head: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", columnGap: 10, rowGap: 6 },
  headText: { fontFamily: FONT.body, fontSize: 12.5, lineHeight: 18 },
  party: { fontFamily: FONT.data, fontSize: 12.5, lineHeight: 18 },
  count: { marginLeft: "auto", fontFamily: FONT.data, fontSize: 11, lineHeight: 16 },
  status: { padding: 14, borderWidth: 1, borderRadius: RADIUS.lg, fontFamily: FONT.body, fontSize: 13, lineHeight: 19.5 },
  list: { borderWidth: 1, borderRadius: RADIUS.lg },
  row: { gap: 6, paddingVertical: 12, paddingHorizontal: 14 },
  line: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  market: { flexShrink: 1, fontFamily: FONT.heading, fontSize: 14, lineHeight: 18 },
  here: { fontFamily: FONT.dataStrong, fontSize: 10, letterSpacing: 1 },
  side: { paddingVertical: 2, paddingHorizontal: 8, borderWidth: 1, borderRadius: RADIUS.sm, overflow: "hidden", fontFamily: FONT.dataStrong, fontSize: 11, lineHeight: 14, letterSpacing: 0.7 },
  stake: { fontFamily: FONT.data, fontSize: 12.5, lineHeight: 18, fontVariant: ["tabular-nums"] },
  cid: { flexShrink: 1, fontFamily: FONT.data, fontSize: 11.5, lineHeight: 16 },
  query: { gap: 8 },
  label: { fontFamily: FONT.data, fontSize: 10, lineHeight: 14, letterSpacing: 1.2 },
  note: { fontFamily: FONT.data, fontSize: 11, lineHeight: 16.5 },
  code: { borderWidth: 1, borderRadius: RADIUS.md, overflow: "hidden" },
  codeBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1 },
  codeFile: { flexShrink: 1, fontFamily: FONT.data, fontSize: 11, lineHeight: 14 },
  codeBody: { padding: 12 },
  codeText: { fontFamily: FONT.dataRegular, fontSize: 11.5, lineHeight: 17 },
});
