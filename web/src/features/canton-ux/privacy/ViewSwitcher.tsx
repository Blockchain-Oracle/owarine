"use client";

import { partyLead } from "@owarine/core/units";
import { UserX } from "lucide-react";
import { useState } from "react";
import { Hash } from "@/components/data/Hash";
import { TapHash } from "@/components/data/TapHash";
import { ID_LABEL } from "../id-label";
import { CodeBlock } from "@/components/ui/code-block";
import { EmptyState, TabsPanel, UnderlineTabs } from "@/components/ui/desk-kit";
import { SIDE_WORD } from "@/features/markets/side-styles";
import { PRIVACY } from "./copy";
import type { PartyView } from "./party-views";
import { WhoCanSee } from "./WhoCanSee";
import "./privacy.css";

const S = PRIVACY.switcher;

export { type PartyPosition, type PartyView } from "./party-views";

function Positions({ view }: { view: PartyView }) {
  if (view.status?.kind === "loading") {
    return (
      <p className="cx-switcher-status" role="status" aria-busy="true">
        {S.asking}
      </p>
    );
  }
  if (view.status?.kind === "error") {
    return (
      <p className="cx-switcher-status" role="alert" data-error="">
        {S.failed} <span className="cx-muted">{view.status.text}</span>
      </p>
    );
  }
  if (view.positions.length === 0) {
    return <EmptyState icon={<UserX />} title={S.emptyTitle} body={S.emptyBody} />;
  }
  return (
    <ul className="cx-positions" aria-label={S.returned(view.positions.length)}>
      {view.positions.map((p) => (
        <li key={p.contractId} className="cx-position">
          <span className="cx-position-market">
            {p.market}
            {p.here && <span className="cx-position-here">{S.here}</span>}
          </span>
          <span className="cx-position-side" data-side={p.side}>
            {SIDE_WORD[p.side]}
          </span>
          <span className="cx-position-stake">
            {p.stakeText} {p.priceCents !== null && <span className="cx-muted">{S.at(p.priceCents)}</span>}
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
export function ViewSwitcher({ views, initial, onSelect }: { views: readonly PartyView[]; initial?: string; onSelect?: (value: string) => void }) {
  const [value, setValue] = useState(initial ?? views[0]?.value ?? "");
  const select = (next: string) => {
    setValue(next);
    onSelect?.(next);
  };
  const items = views.map((v) => ({ value: v.value, label: v.label, count: v.status ? undefined : v.positions.length }));
  return (
    <div className="cx-switcher">
      <p className="cx-switcher-intro">{S.intro}</p>
      <UnderlineTabs value={value} onChange={select} items={items} label={S.label}>
        {views.map((view) => (
          <TabsPanel key={view.value} value={view.value} className="cx-switcher-panel">
            <div className="cx-switcher-head">
              <span className="cx-muted">{S.asParty}</span>
              <TapHash value={view.party} lead={partyLead(view.party)} tail={4} label={ID_LABEL.party} className="cx-party" />
              {!view.status && <span className="cx-switcher-count">{S.returned(view.positions.length)}</span>}
            </div>
            <Positions view={view} />
            <div className="cx-switcher-query">
              <span className="cx-label">{S.query}</span>
              <CodeBlock filename={view.request} code={view.query} hashes={[{ value: view.party, lead: partyLead(view.party), tail: 4 }]} label={S.queryLabel(view.label)} />
              {view.note && <p className="cx-switcher-note">{view.note}</p>}
            </div>
          </TabsPanel>
        ))}
      </UnderlineTabs>
    </div>
  );
}
