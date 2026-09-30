import { formatClock, shortHex } from "@agari/core/units";
import { formatSeatLinkCode, SEAT_LINK_CODE_LENGTH } from "@agari/markets";
import * as Clipboard from "expo-clipboard";
import { Check, Copy, Link2, RefreshCw, ShieldQuestion } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useNowMs } from "@/components/data/useNowMs";
import { SEAT } from "@/features/canton-ux/seat/copy";
import { Button, haptic } from "~/components/kit";
import { FONT, RADIUS, useTheme } from "~/theme";
import { SEAT as PHONE_SEAT } from "~/wallet/seat-copy";
import { LinkCodeInput, type LinkCodeStatus } from "./LinkCodeInput";
import { SeatQr } from "./SeatQr";

const L = SEAT.link;
const COPIED_MS = 1_500;
const QR_SIZE = 128;

/**
 * `join`: this phone holds no seat of its own to show, so the card is only the code entry (web's same states).
 * `confirm`: a device used this seat's code and waits for this phone to allow it (C4c); `declined`: this phone refused.
 */
export type SeatLinkCardState = "showing" | "expired" | "confirm" | "linked" | "declined" | "join";

interface Props {
  state: SeatLinkCardState;
  code: string;
  /** What the QR carries: this app's deep link, `<scheme>://seat/link?code=…`. */
  url: string;
  expiresAtMs: number | null;
  seatNumber: number;
  /** `confirm`: the key waiting on this seat's code, and this phone's answer to it. */
  waitingKey?: string | null;
  onDecide?: (allow: boolean) => Promise<void>;
  onFresh: () => void;
  /** True joins; false or a sentence refuses (the sentence replaces the generic error line). */
  verify: (code: string) => Promise<boolean | string>;
  /** A code that arrived with the deep link: filled in, joined only on the button (never on arrival). */
  initialCode?: string | null;
}

/**
 * web's `SeatLinkCard` (21st #29246 layout, restyled into the reference's tokens) ported literally: the mark and title,
 * the QR beside the manual code with copy and its countdown, then the code entry and one button. The top half is this
 * seat's code for another device; the bottom half joins another device's seat.
 */
function Decide({ waitingKey, seatNumber, onDecide }: { waitingKey: string; seatNumber: number; onDecide: (allow: boolean) => Promise<void> }) {
  const { color } = useTheme();
  const [busy, setBusy] = useState(false);
  const answer = (allow: boolean) => {
    haptic.select();
    setBusy(true);
    void onDecide(allow).finally(() => setBusy(false));
  };
  return (
    <View style={styles.done} accessibilityRole="alert" accessibilityLiveRegion="assertive">
      <View style={[styles.doneMark, { backgroundColor: color.accentWash }]}>
        <ShieldQuestion size={22} color={color.accent} />
      </View>
      <Text style={[styles.doneTitle, { color: color.ink }]}>{L.confirmTitle}</Text>
      <Text style={[styles.sub, { color: color.inkSecondary }]}>{L.confirmBody(shortHex(waitingKey, 4, 4), seatNumber)}</Text>
      <View style={styles.decide}>
        <View style={styles.decideCell}>
          <Button label={L.decline} variant="secondary" disabled={busy} onPress={() => answer(false)} />
        </View>
        <View style={styles.decideCell}>
          <Button label={busy ? L.deciding : L.allow} loading={busy} disabled={busy} onPress={() => answer(true)} />
        </View>
      </View>
    </View>
  );
}

export function SeatLinkCard({ state, code, url, expiresAtMs, seatNumber, waitingKey = null, onDecide, onFresh, verify, initialCode }: Props) {
  const { color } = useTheme();
  const now = useNowMs();
  const leftSec = expiresAtMs !== null && now > 0 ? Math.max(0, Math.ceil((expiresAtMs - now) / 1000)) : null;
  const expired = state === "expired" || (state === "showing" && leftSec === 0);
  return (
    <View style={[styles.card, { borderColor: color.hairline, backgroundColor: color.surface1 }]} accessibilityLabel={L.title}>
      <View style={styles.head}>
        <View style={[styles.mark, { borderColor: color.accentDim, backgroundColor: color.accentWash }]}>
          <Link2 size={24} color={color.accent} />
        </View>
        <Text style={[styles.title, { color: color.ink }]} accessibilityRole="header">
          {L.title}
        </Text>
        <Text style={[styles.sub, { color: color.inkSecondary }]}>{L.subtitle}</Text>
      </View>

      {state === "join" ? null : state === "confirm" && waitingKey && onDecide ? (
        <Decide waitingKey={waitingKey} seatNumber={seatNumber} onDecide={onDecide} />
      ) : state === "declined" ? (
        <View style={styles.done} accessibilityRole="summary" accessibilityLiveRegion="polite">
          <Text style={[styles.doneTitle, { color: color.ink }]}>{L.declinedTitle}</Text>
          <Text style={[styles.sub, { color: color.inkSecondary }]}>{L.declinedBody}</Text>
          <Button label={L.fresh} icon={RefreshCw} variant="secondary" size="sm" block={false} onPress={onFresh} />
        </View>
      ) : state === "linked" ? (
        <View style={styles.done} accessibilityRole="summary" accessibilityLiveRegion="polite">
          <View style={[styles.doneMark, { backgroundColor: color.profitWash }]}>
            <Check size={22} color={color.profit} />
          </View>
          <Text style={[styles.doneTitle, { color: color.ink }]}>{L.linkedTitle}</Text>
          <Text style={[styles.sub, { color: color.inkSecondary }]}>{L.linkedBody(PHONE_SEAT.link.joinedDevice, seatNumber)}</Text>
        </View>
      ) : (
        <View style={styles.show}>
          <View style={styles.qrFrame}>
            <View style={expired ? styles.veiled : undefined}>{code ? <SeatQr text={url} label={L.qrAlt} size={QR_SIZE} /> : <View style={{ width: QR_SIZE, height: QR_SIZE }} />}</View>
            {expired ? (
              <View style={styles.veil}>
                <Text style={[styles.veilText, { color: color.ink }]}>{L.expired}</Text>
              </View>
            ) : null}
            {(["tl", "tr", "bl", "br"] as const).map((at) => (
              <View key={at} style={[styles.corner, CORNER[at], { borderColor: color.borderStrong }]} />
            ))}
          </View>
          <View style={styles.side}>
            <Text style={[styles.manual, { color: color.inkSecondary }]}>{L.manual}</Text>
            <CopyCode code={code} disabled={expired || !code} />
            {expired ? (
              <>
                <Text style={[styles.expiry, { color: color.loss }]}>{L.expiredBody}</Text>
                <Button label={L.fresh} icon={RefreshCw} variant="secondary" size="sm" block={false} onPress={onFresh} />
              </>
            ) : (
              <Text style={[styles.expiry, { color: color.inkSecondary }]}>
                {L.expiresIn}{" "}
                <Text style={[styles.clock, { color: color.ink }]} accessibilityRole="timer">
                  {leftSec !== null ? formatClock(leftSec) : "–:––"}
                </Text>
              </Text>
            )}
          </View>
        </View>
      )}

      <Join verify={verify} initialCode={initialCode ?? null} />
      <Text style={[styles.foot, { color: color.inkMuted }]}>{L.foot}</Text>
    </View>
  );
}

function CopyCode({ code, disabled }: { code: string; disabled: boolean }) {
  const { color } = useTheme();
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);
  const Icon = copied ? Check : Copy;
  return (
    <View style={[styles.code, { borderColor: color.hairline, backgroundColor: color.surface2 }]}>
      <Text style={[styles.codeValue, { color: color.ink }]} accessibilityLabel={`${L.code}: ${disabled ? "none" : code.split("").join(" ")}`}>
        {disabled ? "–––– ––––" : formatSeatLinkCode(code)}
      </Text>
      <Pressable
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={copied ? L.copied : L.copy}
        hitSlop={10}
        onPress={() => {
          haptic.select();
          void Clipboard.setStringAsync(code).then(() => setCopied(true));
        }}
      >
        <Icon size={16} color={disabled ? color.inkDisabled : color.inkSecondary} />
      </Pressable>
    </View>
  );
}

function Join({ verify, initialCode }: { verify: Props["verify"]; initialCode: string | null }) {
  const { color } = useTheme();
  const [value, setValue] = useState(initialCode ?? "");
  const [status, setStatus] = useState<LinkCodeStatus>("idle");
  const [why, setWhy] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const complete = value.length === SEAT_LINK_CODE_LENGTH;
  const submit = async (code: string) => {
    if (code.length !== SEAT_LINK_CODE_LENGTH || busy) return;
    setBusy(true);
    const answer = await verify(code);
    setBusy(false);
    setWhy(typeof answer === "string" ? answer : null);
    setStatus(answer === true ? "success" : "error");
    if (answer === true) haptic.success();
    else haptic.error();
  };
  const message = status === "error" ? (why ?? L.joinError) : status === "success" ? L.joinSuccess : null;
  return (
    <View style={[styles.join, { borderTopColor: color.hairline }]}>
      <Text style={[styles.joinTitle, { color: color.ink }]}>{L.joinTitle}</Text>
      <Text style={[styles.sub, { color: color.inkSecondary }]}>{L.joinBody}</Text>
      <LinkCodeInput
        value={value}
        onChange={(next) => {
          setValue(next);
          if (status !== "idle") setStatus("idle");
        }}
        // A typed code joins when complete, as on web; a code that came with a link waits for the button.
        onComplete={(code) => void submit(code)}
        status={status}
        label={L.joinLabel}
        hint={L.joinHint}
        message={message}
        editable={status !== "success"}
      />
      <Button label={busy ? L.joining : L.join} loading={busy} disabled={!complete || status === "success"} onPress={() => void submit(value)} />
    </View>
  );
}

const CORNER = {
  tl: { top: 0, left: 0, borderTopWidth: 1, borderLeftWidth: 1 },
  tr: { top: 0, right: 0, borderTopWidth: 1, borderRightWidth: 1 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 1, borderLeftWidth: 1 },
  br: { bottom: 0, right: 0, borderBottomWidth: 1, borderRightWidth: 1 },
} as const;

// web seat.css `.cx-link*`: 440 max, 24 padding, 20 gap, radius-xl; the mark 52 at radius-lg; the QR 128 in a 4 frame.
const styles = StyleSheet.create({
  card: { width: "100%", maxWidth: 440, alignSelf: "center", gap: 20, padding: 24, borderWidth: 1, borderRadius: RADIUS.xl },
  head: { alignItems: "center", gap: 6 },
  mark: { width: 52, height: 52, marginBottom: 8, borderWidth: 1, borderRadius: RADIUS.lg, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: FONT.heading, fontSize: 18, lineHeight: 22, textAlign: "center" },
  sub: { fontFamily: FONT.body, fontSize: 13, lineHeight: 19.5, textAlign: "center" },
  show: { flexDirection: "row", alignItems: "flex-start", gap: 16 },
  qrFrame: { padding: 4 },
  veiled: { opacity: 0.25 },
  veil: { position: "absolute", top: 4, left: 4, right: 4, bottom: 4, alignItems: "center", justifyContent: "center", padding: 8 },
  veilText: { fontFamily: FONT.dataStrong, fontSize: 11, lineHeight: 14, textAlign: "center" },
  corner: { position: "absolute", width: 14, height: 14 },
  side: { flex: 1, gap: 10 },
  manual: { fontFamily: FONT.body, fontSize: 12, lineHeight: 18 },
  code: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderRadius: RADIUS.md },
  codeValue: { fontFamily: FONT.dataStrong, fontSize: 20, lineHeight: 24, letterSpacing: 2 },
  expiry: { fontFamily: FONT.body, fontSize: 12, lineHeight: 18 },
  clock: { fontFamily: FONT.data },
  done: { alignItems: "center", gap: 8 },
  decide: { flexDirection: "row", gap: 8, alignSelf: "stretch" },
  decideCell: { flex: 1 },
  doneMark: { width: 44, height: 44, borderRadius: RADIUS.full, alignItems: "center", justifyContent: "center" },
  doneTitle: { fontFamily: FONT.bodyBold, fontSize: 16, lineHeight: 22 },
  join: { gap: 12, paddingTop: 20, borderTopWidth: 1 },
  joinTitle: { fontFamily: FONT.bodyStrong, fontSize: 14, lineHeight: 20, textAlign: "center" },
  foot: { fontFamily: FONT.body, fontSize: 11, lineHeight: 16.5, textAlign: "center" },
});
