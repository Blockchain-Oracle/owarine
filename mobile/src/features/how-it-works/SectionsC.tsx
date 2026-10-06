import { Blocks, EyeOff, Layers } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";
import { HOW_IT_WORKS } from "@/features/how-it-works/copy";
import { BUILT_ON_LEAD, LEG } from "@/features/how-it-works/leg";
import { SPONSORS } from "@/features/landing/sponsors";
import { SUMMARY } from "@/features/privacy-matrix/matrix";
import { SponsorMark } from "~/components/logos/SponsorMark";
import { FONT, useTheme } from "~/theme";
import { hiwTokens } from "~/theme/web/explore/how-it-works";
import { Body, Card, CardHead, HIW_FONT, Label, Params, Rise, Section } from "./Blocks";

const W = HOW_IT_WORKS;

/** web BuiltOn.tsx's per-brand mark height (how-it-works-canton.css `--mark-height`). */
const MARK_HEIGHT: Record<string, number> = { canton: 26, noders: 32, bitsafe: 20 };

/**
 * web WhoSeesIt.tsx (C10f, C-N34): the two-sided Leg in the pricing card's grammar — the lead, the formula box, the
 * parameter rows — then who sees it as a blue card, one line per kind of party. The full matrix is a web page
 * (`/who-sees-what`, plan: privacy surfaces stay web-only), so the phone keeps the summary.
 */
export function LegSection() {
  const { name, color } = useTheme();
  const t = hiwTokens(name);
  return (
    <Section>
      <Label title={W.sections.leg} icon={Layers} />
      <Rise baseMs={500}>
        <Card>
          <Body style={styles.leadGap}>{LEG.lead}</Body>
          <View style={[styles.formula, { backgroundColor: t.formula, borderColor: t.line }]} accessibilityRole="image" accessibilityLabel={LEG.formulaLabel}>
            {LEG.formula.map((line) => (
              <Text key={line} style={[styles.formulaText, { color: color.accent }]}>
                {line}
              </Text>
            ))}
          </View>
          <Params rows={LEG.rows} />
        </Card>
      </Rise>
      <Rise index={1} baseMs={500} style={styles.top}>
        <Card tone="blue">
          <CardHead icon={EyeOff} title={LEG.whoTitle} blue />
          <Body>{LEG.whoLead}</Body>
          <View style={styles.rows}>
            {SUMMARY.map(([who, sees]) => (
              <View key={who} style={[styles.row, { borderTopColor: t.line }]}>
                <Text style={[styles.rowKey, { color: color.ink }]}>{who}</Text>
                <Text style={[styles.rowValue, { color: color.inkSecondary }]}>{sees}</Text>
              </View>
            ))}
          </View>
        </Card>
      </Rise>
    </Section>
  );
}

/** web BuiltOn.tsx (C-S25): Canton Network, Noders and BitSafe, each card with its own mark (K-250), role and line. */
export function BuiltOnSection() {
  const { name } = useTheme();
  const t = hiwTokens(name);
  return (
    <Section>
      <Label title={W.sections.builtOn} icon={Blocks} blue />
      <Body style={styles.builtLead}>{BUILT_ON_LEAD}</Body>
      <View style={styles.grid}>
        {SPONSORS.map((sponsor, index) => (
          <Rise key={sponsor.id} index={index} baseMs={650}>
            <Card>
              <View style={styles.mark}>
                <SponsorMark brand={sponsor.id} name={sponsor.name} aspect={sponsor.aspect} height={MARK_HEIGHT[sponsor.id] ?? 26} />
              </View>
              <Text style={[styles.role, { color: t.blue }]}>{sponsor.role}</Text>
              <Body>{sponsor.line}</Body>
            </Card>
          </Rise>
        ))}
      </View>
    </Section>
  );
}

const styles = StyleSheet.create({
  leadGap: { marginBottom: 24 },
  formula: { gap: 6, marginBottom: 24, borderWidth: 1, borderRadius: 12, padding: 16 },
  formulaText: { fontFamily: FONT.dataRegular, fontSize: 14, lineHeight: 22.4 },
  top: { marginTop: 16 },
  rows: { gap: 12, marginTop: 16 },
  row: { gap: 4, paddingTop: 12, borderTopWidth: 1 },
  rowKey: { fontFamily: FONT.dataRegular, fontSize: 13, lineHeight: 19.5 },
  rowValue: { fontFamily: FONT.body, fontSize: 14, lineHeight: 22.4 },
  builtLead: { marginTop: -16, marginBottom: 24 },
  grid: { gap: 16 },
  mark: { minHeight: 32, justifyContent: "center", marginBottom: 10 },
  role: { fontFamily: HIW_FONT.monoBold, fontSize: 11, lineHeight: 16.5, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 },
});
