"use client";

import Link from "next/link";
import { proofHref } from "@/lib/routes";
import { namesLine, type BuiltOnSource, type SourceTally } from "./built-on";
import { LANDING } from "./copy";
import { useBuiltOn } from "./useBuiltOn";
import "./built-on.css";

const COUNT = new Intl.NumberFormat("en-US");

/** One source that closed Windows: its plain name, the count, what the oracle parties read from it, and its newest print proof. */
function Column({ tally, proof }: { tally: SourceTally; proof: string | null }) {
  const { builtOn } = LANDING;
  const source: BuiltOnSource = tally.source;
  const copy = builtOn.sources[source];
  return (
    <div className="lp-built-col" data-source={source}>
      <p className="lp-built-name">{copy.name}</p>
      <p className="lp-built-figure">
        <span className="lp-built-num numbers">{COUNT.format(tally.windows)}</span>
        <span className="lp-built-unit">{builtOn.figure}</span>
      </p>
      <p className="lp-built-what">{builtOn.what(namesLine(tally.names), copy.how, builtOn.signed, tally.baskets.length)}</p>
      {proof && (
        <Link href={proofHref(proof)} className="lp-link lp-built-proof" data-cursor="hover">
          {builtOn.proof}
        </Link>
      )}
    </div>
  );
}

/**
 * The band under the hero (S25): the original sources the venue's Windows have settled on, by their plain names, each
 * with the count of Windows its prints closed and a link to the newest one's print proof. The figures are the index's
 * print mix (`/status`'s read), so the columns are the sources that printed and nothing here is written by hand.
 */
export function LandingBuiltOn() {
  const { builtOn } = LANDING;
  const reading = useBuiltOn();
  const value = reading?.ok ? reading.value : null;
  const note = reading === null ? builtOn.reading : !value ? builtOn.unread : value.tally.length === 0 ? builtOn.none : null;
  return (
    <div className="lp-built">
      <p className="section-eyebrow lp-built-label">{builtOn.label}</p>
      <div className="lp-built-cols">
        {value?.tally.map((tally) => (
          <Column key={tally.source} tally={tally} proof={value.proof[tally.source] ?? null} />
        ))}
        {note && (
          <div className="lp-built-col">
            <p className="lp-built-what">{note}</p>
          </div>
        )}
      </div>
    </div>
  );
}
