import { createSeatLink, decideSeatLink, normalizeSeatLinkCode, readSeatLink, seatLinkPath, type SeatLinkCode } from "@owarine/markets";
import { diagnosisCopy } from "@owarine/core/copy";
import { useLocalSearchParams } from "expo-router";
import { RefreshCw } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { leasedOf, seatNumberOf } from "@/providers/wallet/seat-lease-context";
import { useWalletShell } from "@/providers/wallet/wallet-shell-context";
import { Button, Screen } from "~/components/kit";
import { SeatLinkCard, type SeatLinkCardState } from "~/features/seat-link/SeatLinkCard";
import { appUrl } from "~/lib/identity";
import { FONT, SPACE, useTheme } from "~/theme";
import { SEAT as WEB_SEAT } from "@/features/canton-ux/seat/copy";
import { SEAT } from "~/wallet/seat-copy";
import { useSeat } from "~/wallet/SeatProvider";

/** How often the holder's screen asks whether its code was used, while it shows. */
const POLL_MS = 2_000;

/**
 * `/seat/link` (plan, iOS step 2b; `<scheme>://seat/link?code=…` from a QR): web's seat link page on the phone. A phone
 * that took its seat shows a fresh one-time code and its QR, and turns to "Linked" once another device joins. Any phone
 * can join another device's seat with its code; a code from the link is filled in and joins only on the button. A phone
 * that has not accepted the demo-credits terms accepts them here first. The code boxes, the note and the button are the last
 * things in a tall card, so the page lifts above the keyboard as the app's chat sheets do (`KeyboardAvoidingView`, padding
 * on iOS) and, while the entry has the keyboard, scrolls to the end each time the keyboard resizes it.
 */
export default function SeatLinkScreen() {
  const { color } = useTheme();
  const params = useLocalSearchParams<{ code?: string }>();
  const initialCode = typeof params.code === "string" ? normalizeSeatLinkCode(params.code) : null;
  const shell = useWalletShell();
  const seat = useSeat();
  const leased = leasedOf(seat.lease.view);
  const holder = leased !== null && shell.address !== null && leased.address === shell.address;
  const [issued, setIssued] = useState<SeatLinkCode | null>(null);
  const [state, setState] = useState<Exclude<SeatLinkCardState, "join">>("showing");
  const [waitingKey, setWaitingKey] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const scroll = useRef<ScrollView>(null);
  const [entering, setEntering] = useState(false);

  const fresh = useCallback(async () => {
    const answer = await createSeatLink();
    if (answer.ok) {
      setIssued(answer.value);
      setState("showing");
      setWaitingKey(null);
      setProblem(null);
    } else setProblem(diagnosisCopy(answer.diagnosis.kind).headline);
  }, []);

  useEffect(() => {
    if (holder && issued === null) void fresh();
  }, [holder, issued, fresh]);

  // While the code shows, and while a device waits on it, this phone follows it (C4c: it asks before linking).
  useEffect(() => {
    if (!issued || (state !== "showing" && state !== "confirm")) return;
    const timer = setInterval(() => {
      void readSeatLink(issued.code).then((answer) => {
        if (!answer.ok) return;
        const next = answer.value.state === "pending" ? "confirm" : answer.value.state;
        if (next === "confirm") setWaitingKey(answer.value.device);
        if (next !== state) setState(next);
      });
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [issued, state]);

  const decide = useCallback(
    async (allow: boolean) => {
      if (!issued) return;
      const answer = await decideSeatLink(issued.code, allow);
      if (answer.ok) setState(answer.value.state);
      else {
        setState("expired");
        setProblem(diagnosisCopy(answer.diagnosis.kind).headline);
      }
    },
    [issued],
  );

  const verify = useCallback(
    async (code: string) => {
      const joined = await shell.joinSeat(code);
      if (joined.ok) return joined.value.kind === "leased";
      if (joined.status === 403) return WEB_SEAT.link.joinDeclined;
      return joined.status === 410 ? false : joined.diagnosis.technical;
    },
    [shell],
  );

  return (
    <Screen title={SEAT.link.screen} scroll={false}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          ref={scroll}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          // The keyboard resizes this view; with the code entry focused, keep its end (the boxes, the note, the button) in sight.
          onLayout={() => entering && scroll.current?.scrollToEnd({ animated: true })}
        >
          {seat.termsAccepted ? null : (
            <View style={[styles.terms, { borderColor: color.hairline, backgroundColor: color.surface1 }]}>
              <Text style={[styles.termsLine, { color: color.inkSecondary }]}>{SEAT.link.termsLine}</Text>
              <Button label={SEAT.link.accept} variant="secondary" size="sm" onPress={seat.acceptTerms} />
            </View>
          )}
          <SeatLinkCard
            state={holder && issued ? state : "join"}
            code={issued?.code ?? ""}
            url={issued ? appUrl(seatLinkPath(issued.code)) : ""}
            expiresAtMs={issued?.expiresAtMs ?? null}
            seatNumber={(leased && seatNumberOf(leased.party)) ?? 0}
            waitingKey={waitingKey}
            onDecide={decide}
            onFresh={() => void fresh()}
            verify={verify}
            initialCode={initialCode}
            onEntryFocus={setEntering}
          />
          {problem ? (
            <Text style={[styles.problem, { color: color.loss }]} accessibilityRole="alert">
              {problem}
            </Text>
          ) : null}
          {/* The holder whose first code did not issue has nothing on screen to press (web's SeatLinkPanel offers the same retry). */}
          {problem && holder && issued === null ? <Button label={WEB_SEAT.link.fresh} icon={RefreshCw} variant="secondary" size="sm" block={false} style={styles.retry} onPress={() => void fresh()} /> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  // `Screen`'s own body (the 16 gutter, room under the floating dock) with this page's tighter gap and top.
  content: { padding: SPACE.gutter, paddingTop: 16, paddingBottom: 120, gap: 12 },
  terms: { gap: 10, padding: 16, borderWidth: 1, borderRadius: 12 },
  termsLine: { fontFamily: FONT.body, fontSize: 13, lineHeight: 19.5, textAlign: "center" },
  problem: { fontFamily: FONT.body, fontSize: 12, lineHeight: 18, textAlign: "center" },
  retry: { alignSelf: "center" },
});
