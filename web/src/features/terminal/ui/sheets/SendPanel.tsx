"use client";

import { partyIdPattern, postSend, postTransferEnd, type TransferWire } from "@owarine/markets";
import { Check, Copy, X } from "lucide-react";
import { useState } from "react";
import { diagnosisCopy } from "@/lib/copy";
import { haptic } from "@/lib/haptics";
import { playTrade } from "@/lib/sound/trade";
import { cn } from "@/lib/utils";
import { useSeatPkg } from "../../exits/useSeatPkg";
import { toast } from "../../toasts";

const CREDIT_DECIMALS = 6;
const tap = () => (playTrade("tap"), haptic("tap"));
const credits = (base: bigint) => (Number(base) / 10 ** CREDIT_DECIMALS).toLocaleString("en-US", { maximumFractionDigits: 2 });
const seatName = (party: string) => party.split("::")[0]!.replace(/^.*?-pm-|^owarine-user-/, "");

/**
 * Send credits to another seat (R2, UGLYCASH's P2P send): their seat id, an amount, a memo. It lands as an offer the
 * other seat accepts (or rejects); until then the sender can take it back. Only the two seats and the venue see it.
 */
export function SendPanel() {
  const pkg = useSeatPkg();
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const amountBase = /^\d+(\.\d{0,6})?$/.test(amount.trim()) ? BigInt(Math.round(Number(amount) * 10 ** CREDIT_DECIMALS)) : 0n;
  const toOk = partyIdPattern.test(to.trim()) && to.trim() !== pkg.party;

  if (!pkg.deployed) {
    return <p className="py-6 text-center text-ow-body text-ow-muted">Sending credits between seats arrives with the next ledger release.</p>;
  }

  const send = async () => {
    tap();
    setBusy("send");
    try {
      const r = await postSend({ to: to.trim(), amount: amountBase, memo: memo.trim() });
      await pkg.refresh();
      if (r.ok && r.value.kind === "confirmed") {
        toast({ kind: "success", title: `Sent ${credits(amountBase)} credits`, description: `Waiting for ${seatName(to.trim())} to accept. You can take it back until then.` });
        setAmount("");
        setMemo("");
        return;
      }
      const d = r.ok ? ("diagnosis" in r.value ? r.value.diagnosis : null) : r.diagnosis;
      toast({ kind: r.ok && r.value.kind === "unknown" ? "info" : "error", title: r.ok && r.value.kind === "unknown" ? "Waiting for the ledger" : "Not sent", description: d ? diagnosisCopy(d.kind).headline : "Try again." });
    } finally {
      setBusy(null);
    }
  };

  const end = async (t: TransferWire, choice: "accept" | "reject" | "withdraw") => {
    tap();
    setBusy(t.cid);
    try {
      const r = await postTransferEnd(t.cid, choice);
      await pkg.refresh();
      if (r.ok && r.value.kind === "confirmed") {
        const words = { accept: `+${credits(t.amount)} credits from ${seatName(t.counterparty)}`, reject: "Sent back", withdraw: `${credits(t.amount)} credits back` } as const;
        toast({ kind: "success", title: words[choice] });
        return;
      }
      const d = r.ok ? ("diagnosis" in r.value ? r.value.diagnosis : null) : r.diagnosis;
      toast({ kind: "error", title: "Not done", description: d ? diagnosisCopy(d.kind).headline : "Try again." });
    } finally {
      setBusy(null);
    }
  };

  const field = "w-full rounded-ow-card bg-ow-recessed/60 px-4 py-3 text-ow-body outline-none focus-visible:outline-2 focus-visible:outline-ow-pink-ink";
  return (
    <div className="flex flex-col gap-4">
      {pkg.party ? (
        <button
          type="button"
          onClick={() => void navigator.clipboard.writeText(pkg.party!).then(() => (setCopied(true), setTimeout(() => setCopied(false), 1500)))}
          className="flex items-center justify-between gap-3 rounded-ow-card bg-ow-card p-3 text-left"
        >
          <span className="min-w-0">
            <span className="block text-ow-micro font-bold text-ow-muted">YOUR SEAT ID · share it to get paid</span>
            <span className="block truncate font-mono text-ow-caption">{pkg.party}</span>
          </span>
          {copied ? <Check className="size-4 shrink-0 text-ow-up" /> : <Copy className="size-4 shrink-0 text-ow-muted" />}
        </button>
      ) : null}

      <div className="flex flex-col gap-2">
        <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="Their seat id" aria-label="Their seat id" className={cn(field, "font-mono text-ow-caption")} spellCheck={false} autoComplete="off" />
        <div className="flex items-baseline gap-2">
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0" aria-label="Amount" className="ow-num w-full bg-transparent text-ow-display font-bold outline-none" />
          <span className="shrink-0 text-ow-caption text-ow-muted">credits</span>
        </div>
        <input value={memo} onChange={(e) => setMemo(e.target.value.slice(0, 140))} placeholder="What's it for? (optional)" aria-label="Memo" className={field} />
        <button type="button" disabled={busy !== null || !toOk || amountBase <= 0n} onClick={() => void send()} className="h-12 w-full rounded-full bg-ow-pink font-bold text-ow-on-pink disabled:opacity-40">
          {busy === "send" ? "Sending…" : amountBase > 0n ? `Send ${credits(amountBase)}` : "Send"}
        </button>
        {to.trim() !== "" && !toOk ? <p className="text-ow-caption text-ow-down">{to.trim() === pkg.party ? "That's your own seat." : "That isn't a seat id."}</p> : null}
      </div>

      {pkg.transfers.length > 0 ? (
        <div className="flex flex-col gap-2">
          <span className="px-1 text-ow-micro font-bold tracking-[0.12em] text-ow-muted">WAITING</span>
          {pkg.transfers.map((t) => (
            <div key={t.cid} className="flex items-center gap-3 rounded-ow-card bg-ow-card p-3">
              <span className="min-w-0 flex-1">
                <span className="block text-ow-body font-bold">
                  {t.direction === "in" ? "+" : "−"}
                  {credits(t.amount)} <span className="font-normal text-ow-muted">{t.direction === "in" ? "from" : "to"} {seatName(t.counterparty)}</span>
                </span>
                {t.memo ? <span className="block truncate text-ow-micro text-ow-muted">{t.memo}</span> : null}
              </span>
              {t.direction === "in" ? (
                <>
                  <button type="button" aria-label="Reject" disabled={busy !== null} onClick={() => void end(t, "reject")} className="grid size-9 place-items-center rounded-full bg-ow-recessed disabled:opacity-40">
                    <X className="size-4" />
                  </button>
                  <button type="button" disabled={busy !== null} onClick={() => void end(t, "accept")} className="ow-up-solid h-9 rounded-full px-4 text-ow-caption font-bold disabled:opacity-40">
                    {busy === t.cid ? "…" : "Accept"}
                  </button>
                </>
              ) : (
                <button type="button" disabled={busy !== null} onClick={() => void end(t, "withdraw")} className="h-9 rounded-full bg-ow-recessed px-4 text-ow-caption font-bold disabled:opacity-40">
                  {busy === t.cid ? "…" : "Take back"}
                </button>
              )}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** How many transfers wait for this seat to accept (the Transfer button's badge). */
export function useIncomingCount(): number {
  return useSeatPkg().transfers.filter((t) => t.direction === "in").length;
}
