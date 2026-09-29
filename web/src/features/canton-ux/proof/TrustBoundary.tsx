import { ShieldAlert } from "lucide-react";
import { useId } from "react";
import { StatusDot } from "@/components/ui/desk-kit";
import { PROOF_CANTON } from "./copy";
import "./proof-canton.css";

const T = PROOF_CANTON.trust;

/**
 * The trust-boundary statement (C-ADD-11) in the desk's panel grammar (`desk.css` `.dk-panel`, `.dk-panel-head`,
 * `.dk-panel-title`, restated in proof-canton.css so the proof page does not load the desk's sheet): a titled card, a
 * state dot, one plain sentence, and what it does and does not mean.
 */
export function TrustBoundary() {
  const titleId = useId();
  return (
    <section className="cx-panel" aria-labelledby={titleId}>
      <header className="cx-panel-head">
        <h2 id={titleId} className="cx-panel-title">
          <ShieldAlert aria-hidden /> {T.title}
        </h2>
        <StatusDot tone="warn">{T.state}</StatusDot>
      </header>
      <p className="cx-trust-statement">{T.statement}</p>
      <ul className="cx-trust-points">
        {T.points.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
    </section>
  );
}
