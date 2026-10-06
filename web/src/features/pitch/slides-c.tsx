"use client";

import { PITCH_STORY } from "./copy-story";
import { Emph, Kicker, Mono, Rise, SpecPanel } from "./primitives";
import type { Slide } from "./types";

/**
 * The folio's business slides (C10f): the problem, who it is for, and go-to-market, laid out only with the
 * reference's own slide grammar (the headline column beside a `SpecPanel`, the `pitch-cells` strip). Words and
 * sources are in `copy-story.ts`.
 */

const P = PITCH_STORY.problem;
const I = PITCH_STORY.icp;
const G = PITCH_STORY.gtm;

export const SLIDES_C: Slide[] = [
  // THE PROBLEM — public positions get copied
  {
    id: "problem",
    section: P.section,
    render: () => (
      <div className="pitch-row pitch-row-between">
        <div className="pitch-col pitch-col-52">
          <Kicker>{P.kicker}</Kicker>
          <Rise i={1} className="pitch-h1 pitch-h1-art">
            {P.h1a}
            <br />
            {P.h1b}
            <Emph delay={0.7}>{P.emph}</Emph>.
          </Rise>
          <Rise i={2} className="pitch-lead">
            {P.lead}
          </Rise>
          <Rise i={3} className="pitch-provenance">
            <Mono tone="mute">{P.sources}</Mono>
          </Rise>
        </div>
        <SpecPanel i={4} title={P.panelTitle} badge={P.panelBadge} badgeTone="verm" rows={[P.rows[0], P.rows[1], P.rows[2], P.rows[3], [P.rows[4][0], P.rows[4][1], true]]} />
      </div>
    ),
  },

  // WHO IT IS FOR — the user, the buyer, and who it is not for
  {
    id: "icp",
    section: I.section,
    paper: 2,
    render: () => (
      <div className="pitch-stack">
        <Kicker>{I.kicker}</Kicker>
        <Rise i={1} className="pitch-h1 pitch-h1-art">
          {I.h1a}
          <br />
          {I.h1b}
          <Emph delay={0.85}>{I.emph}</Emph>.
        </Rise>
        <Rise i={2} className="pitch-lead pitch-lead-66">
          {I.lead}
        </Rise>
        <Rise i={3} className="pitch-cells-wrap">
          <div className="pitch-cells pitch-cells-3">
            {I.cells.map(([name, label]) => (
              <div key={name} className="pitch-cell">
                <div className="pitch-cell-name">{name}</div>
                <div className="pitch-cell-label">{label}</div>
              </div>
            ))}
          </div>
          <Mono className="pitch-cells-note" tone="verm">
            {I.note}
          </Mono>
        </Rise>
      </div>
    ),
  },

  // GO TO MARKET — the first ten users and the channels, in order
  {
    id: "gtm",
    section: G.section,
    render: () => (
      <div className="pitch-stack">
        <Kicker>{G.kicker}</Kicker>
        <Rise i={1} className="pitch-h1 pitch-h1-dense">
          {G.h1a}
          <br />
          {G.h1b}
          <Emph delay={0.85}>{G.emph}</Emph>.
        </Rise>
        <Rise i={2} className="pitch-lead pitch-lead-66">
          {G.lead}
        </Rise>
        <div className="pitch-panels">
          <SpecPanel i={3} title={G.panelTitle} badge={G.panelBadge} rows={[G.rows[0], [G.rows[1][0], G.rows[1][1], true], G.rows[2]]} />
          <SpecPanel i={4} title={G.channelsTitle} rows={[G.channels[0], G.channels[1], G.channels[2], [G.channels[3][0], G.channels[3][1], true]]} />
        </div>
      </div>
    ),
  },
];
