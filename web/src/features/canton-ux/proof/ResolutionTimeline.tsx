"use client";

import { formatUtc, partyLead } from "@owarine/core/units";
import { Ban, CircleDot, Flag, Radio, RadioTower, Sigma } from "lucide-react";
import type { ReactNode } from "react";
import { TapHash } from "@/components/data/TapHash";
import { ID_LABEL } from "../id-label";
import { Timeline, TimelineNode, type NodeTone } from "@/components/ui/desk-kit";
import { PROOF_CANTON } from "./copy";
import "./proof-canton.css";

const P = PROOF_CANTON;

export interface OracleQuote {
  party: string;
  /** null when the oracle did not report before the deadline. */
  priceText: string | null;
  atMs: number | null;
  updateId: string | null;
}

export interface ResolutionEvidence {
  open: { priceText: string; atMs: number; updateId: string };
  quotes: readonly OracleQuote[];
  deadlineMs: number;
  median: { priceText: string; spreadText: string; limitText: string } | null;
  outcome: { kind: "resolved"; side: string; word: "above" | "under"; closeText: string; atMs: number; updateId: string } | { kind: "voided"; reason: keyof typeof P.voidReason; atMs: number; updateId: string };
}

const time = (ms: number) => formatUtc(ms);

function Meta({ updateId, party, atMs }: { updateId?: string | null; party?: string; atMs?: number | null }) {
  return (
    <p className="cx-ev-meta">
      {atMs != null && <span>{time(atMs)}</span>}
      {party && (
        <span>
          {P.party} <TapHash value={party} lead={partyLead(party)} tail={4} label={ID_LABEL.party} />
        </span>
      )}
      {updateId && (
        <span>
          {P.update} <TapHash value={updateId} lead={8} tail={4} label={ID_LABEL.update} />
        </span>
      )}
    </p>
  );
}

function Node({ icon, tone, index, title, body, children }: { icon: ReactNode; tone: NodeTone; index: number; title: string; body?: string; children?: ReactNode }) {
  return (
    <TimelineNode icon={icon} tone={tone} index={index}>
      <p className="cx-ev-title">{title}</p>
      {body && <p className="cx-ev-body">{body}</p>}
      {children}
    </TimelineNode>
  );
}

/**
 * Resolution evidence on the desk kit's `Timeline` / `TimelineNode` (21st #28276 and #29318): the open print, each
 * oracle's quote (or its silence), the median and spread against the limit, and the result, resolved or voided with
 * its named reason. Every step names the ledger update it came from.
 */
export function ResolutionTimeline({ evidence }: { evidence: ResolutionEvidence }) {
  const { open, quotes, median, outcome } = evidence;
  let i = 0;
  return (
    <Timeline label={P.timeline} className="cx-ev">
      <Node icon={<Flag />} tone="neutral" index={i++} title={P.openPrint(open.priceText)}>
        <Meta atMs={open.atMs} updateId={open.updateId} />
      </Node>
      {quotes.map((q, n) =>
        q.priceText ? (
          <Node key={q.party} icon={<Radio />} tone="acted" index={i++} title={P.quoted(n + 1, q.priceText)}>
            <Meta atMs={q.atMs} party={q.party} updateId={q.updateId} />
          </Node>
        ) : (
          <Node key={q.party} icon={<RadioTower />} tone="error" index={i++} title={P.missed(n + 1)} body={P.missedBody(time(evidence.deadlineMs))}>
            <Meta party={q.party} />
          </Node>
        ),
      )}
      {median ? (
        <Node icon={<Sigma />} tone="declined" index={i++} title={P.median(median.priceText)} body={P.spread(median.spreadText, median.limitText)} />
      ) : (
        <Node icon={<Sigma />} tone="quiet" index={i++} title={P.noMedian} body={P.noMedianBody} />
      )}
      {outcome.kind === "resolved" ? (
        <Node icon={<CircleDot />} tone="acted" index={i++} title={P.resolved(outcome.side)} body={P.resolvedBody(outcome.closeText, open.priceText, outcome.word)}>
          <Meta atMs={outcome.atMs} updateId={outcome.updateId} />
        </Node>
      ) : (
        <Node icon={<Ban />} tone="stopped" index={i++} title={`${P.voided}: ${P.voidReason[outcome.reason]}`} body={P.voidBody}>
          <Meta atMs={outcome.atMs} updateId={outcome.updateId} />
        </Node>
      )}
    </Timeline>
  );
}
