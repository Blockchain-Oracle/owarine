import Link from "next/link";
import { LANDING_STORY } from "./story-copy";

const PITCH_PATH = "/pitch";

/**
 * "From sandbox to MainNet" (C10f): the roadmap as the lanes' bordered cards (`.lp-lane`), then go-to-market, who pays
 * and the October targets as the proof strip's ruled label/value rows (`.lp-proof-cell`). MainNet is the
 * post-hackathon step (STATUS "MainNet and TestNet"); the targets say they are targets. Server-rendered; no data.
 */
export function LandingNext() {
  const { next } = LANDING_STORY;
  return (
    <div className="lp-next">
      <p className="lp-proof-label lp-next-label">{next.phasesLabel}</p>
      <ol className="lp-lanes lp-next-phases">
        {next.phases.map((phase, index) => (
          <li key={phase.tag} className="lp-lane lp-next-phase" data-phase={index}>
            <span className="lp-lane-clock">{phase.tag}</span>
            <h3 className="lp-lane-name">{phase.title}</h3>
            <p className="lp-lane-body">{phase.body}</p>
          </li>
        ))}
      </ol>

      <div className="lp-next-grid">
        <section aria-label={next.gtmLabel}>
          <p className="lp-proof-label lp-next-label">{next.gtmLabel}</p>
          <dl className="lp-next-rows">
            {next.users.map(([who, how]) => (
              <div key={who} className="lp-next-row">
                <dt>{who}</dt>
                <dd>{how}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section aria-label={next.revenueLabel}>
          <p className="lp-proof-label lp-next-label">{next.revenueLabel}</p>
          <dl className="lp-next-rows">
            {next.revenue.map(([who, what]) => (
              <div key={who} className="lp-next-row">
                <dt>{who}</dt>
                <dd>{what}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section aria-label={next.targetsLabel}>
          <p className="lp-proof-label lp-next-label">{next.targetsLabel}</p>
          <ul className="lp-next-targets">
            {next.targets.map((target) => (
              <li key={target}>{target}</li>
            ))}
          </ul>
          <p className="lp-note lp-next-note">{next.targetsNote}</p>
          <Link href={PITCH_PATH} className="lp-link lp-next-pitch" data-cursor="hover">
            {next.pitch}
          </Link>
        </section>
      </div>
    </div>
  );
}
