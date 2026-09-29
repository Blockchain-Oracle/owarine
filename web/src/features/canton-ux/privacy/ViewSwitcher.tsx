"use client";

import type { Side } from "@agari/core/types";
import { UserX } from "lucide-react";
import { useState } from "react";
import { Hash } from "@/components/data/Hash";
import { CodeBlock } from "@/components/ui/code-block";
import { EmptyState, TabsPanel, UnderlineTabs } from "@/components/ui/desk-kit";
import { SIDE_WORD } from "@/features/markets/side-styles";
import { PRIVACY } from "./copy";
import { WhoCanSee } from "./WhoCanSee";
import "./privacy.css";

const S = PRIVACY.switcher;

export interface PartyPosition {
  contractId: string;
  market: string;
  side: Side;
  stakeText: string;
  priceCents: number;
}

export interface PartyView {
  value: string;
  /** Tab label: "Alice", "Bob", "Outsider". */
  label: string;
  party: string;
  /** What the ledger returned for this party; an empty list is a real answer, not a missing one. */
  positions: readonly PartyPosition[];
  /** The request line shown in the Code Block's header. */
  request: string;
  /** The literal body sent, party id included. */
  query: string;
}

/** A party id keeps its readable hint and the fingerprint's first four characters: `alice::1220…9f3b`. */
export const partyLead = (party: string) => party.indexOf("::") + 6;

function Positions({ view }: { view: PartyView }) {
  if (view.positions.length === 0) {
    return <EmptyState icon={<UserX />} title={S.emptyTitle} body={S.emptyBody} />;
  }
  return (
    <ul className="cx-positions" aria-label={S.returned(view.positions.length)}>
      {view.positions.map((p) => (
        <li key={p.contractId} className="cx-position">
          <span className="cx-position-market">{p.market}</span>
          <span className="cx-position-side" data-side={p.side}>
            {SIDE_WORD[p.side]}
          </span>
          <span className="cx-position-stake">
            {p.stakeText} <span className="cx-muted">{S.at(p.priceCents)}</span>
          </span>
          <span className="cx-position-cid">
            <span className="cx-muted">{S.contract}</span> <Hash value={p.contractId} lead={6} tail={4} />
          </span>
          <span className="cx-position-seen">
            <WhoCanSee kind="position" holder={view.label} />
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * The per-party view switcher (C-ADD-02): the desk kit's `UnderlineTabs` (21st #24956 on Base UI's tab indicator; tabs,
 * not a radiogroup, because each one drives a panel), each panel the positions that party's query returned and the
 * query itself in the Code Block, party id and all.
 */
export function ViewSwitcher({ views, initial }: { views: readonly PartyView[]; initial?: string }) {
  const [value, setValue] = useState(initial ?? views[0]?.value ?? "");
  const items = views.map((v) => ({ value: v.value, label: v.label, count: v.positions.length }));
  return (
    <div className="cx-switcher">
      <p className="cx-switcher-intro">{S.intro}</p>
      <UnderlineTabs value={value} onChange={setValue} items={items} label={S.label}>
        {views.map((view) => (
          <TabsPanel key={view.value} value={view.value} className="cx-switcher-panel">
            <div className="cx-switcher-head">
              <span className="cx-muted">{S.asParty}</span>
              <Hash value={view.party} lead={partyLead(view.party)} tail={4} className="cx-party" />
              <span className="cx-switcher-count">{S.returned(view.positions.length)}</span>
            </div>
            <Positions view={view} />
            <div className="cx-switcher-query">
              <span className="cx-label">{S.query}</span>
              <CodeBlock filename={view.request} code={view.query} hashes={[{ value: view.party, lead: partyLead(view.party), tail: 4 }]} label={S.queryLabel(view.label)} />
            </div>
          </TabsPanel>
        ))}
      </UnderlineTabs>
    </div>
  );
}
