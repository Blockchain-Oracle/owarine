import type { OutcomeColumn } from "@owarine/core/desk";
import { router } from "expo-router";
import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { RECORD } from "@/features/desk/copy-record";
import { ago } from "@/features/desk/format";
import type { RecordSummaryWire } from "@/features/desk/protocol";
import { FONT, useTheme } from "~/theme";
import { ReelFrame } from "./ReelFrame";
import { TakeAuthor, TakeCta, TakeFootNote, takeStyles, TakeVoice } from "./TakeParts";
import { useReelTokens } from "./tokens";


export interface DeskReelDecision {
  deskId: string;
  record: RecordSummaryWire;
  isLive: boolean;
}

const TONE: Record<OutcomeColumn, "acted" | "asked" | "quiet" | "stopped"> = {
  acted: "acted", acted_in_part: "acted", acted_by_override: "acted", would_have_acted: "acted",
  asked: "asked", nothing_to_do: "quiet", waited: "quiet", declined: "quiet",
  not_executed: "stopped", blocked_by_limit: "stopped", failed: "stopped",
};

/** web's `DeskReelCard`: your own desk's latest notable decision, in the take card's grammar, read from its record. */
export const DeskReelCard = memo(function DeskReelCard({ decision, nowSec }: { decision: DeskReelDecision; nowSec: number }) {
  const t = useReelTokens();
  const { color } = useTheme();
  const R = RECORD.hooks.reel;
  const { record } = decision;
  const tone = TONE[record.outcome as OutcomeColumn] ?? "quiet";
  const toneInk = tone === "acted" ? color.accent : tone === "asked" ? t.warning : tone === "stopped" ? color.loss : t.ink45;
  return (
    <View style={styles.fill} accessibilityLabel={`${R.title}: ${record.summary}`}>
      <ReelFrame>
        <TakeAuthor
          name={R.title}
          meta={
            <>
              <Text style={[styles.outcome, { color: toneInk }]}>
                {`${RECORD.outcome[record.outcome as OutcomeColumn] ?? record.outcome}${record.mode === "practice" ? ` · ${RECORD.list.practiceTag}` : ""}`.toUpperCase()}
              </Text>
              {` · ${ago(record.decidedAtSec, nowSec)}`.toUpperCase()}
            </>
          }
          badge={R.badge}
        />
        <TakeVoice>{R.voice(record.summary)}</TakeVoice>
        <View style={takeStyles.foot}>
          <TakeCta label={R.cta} onPress={() => router.push({ pathname: "/desk/[id]/decision/[seq]", params: { id: decision.deskId, seq: String(record.seq) } })} />
          <TakeFootNote>{R.foot}</TakeFootNote>
        </View>
      </ReelFrame>
    </View>
  );
});

const styles = StyleSheet.create({
  fill: { flex: 1, width: "100%", alignItems: "center" },
  outcome: { fontFamily: FONT.dataRegular, fontSize: 11, letterSpacing: 0.88 },
});
