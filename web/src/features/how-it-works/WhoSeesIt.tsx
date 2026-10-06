import { EyeOffIcon, LayersIcon } from "lucide-react";
import Link from "next/link";
import { SUMMARY } from "@/features/privacy-matrix/matrix";
import { WHO_SEES_WHAT_PATH } from "@/features/landing/story-copy";
import { HOW_IT_WORKS } from "./copy";
import { LEG } from "./leg";
import { riseDelay } from "./rise";

/**
 * "The Leg and Who Sees It" (C10f): the two-sided leg in the pricing card's grammar (a lead, the formula box, a
 * parameter grid), then who receives it as the blue architecture card, one line per kind of party, with the full
 * matrix one link away. Static.
 */
export function WhoSeesIt() {
  return (
    <section className="hiw-section" aria-label={HOW_IT_WORKS.sections.leg}>
      <h2 className="hiw-label">
        <LayersIcon aria-hidden />
        {HOW_IT_WORKS.sections.leg}
      </h2>
      <div className="hiw-card hiw-card-wide hiw-rise" style={riseDelay(0, 500)}>
        <p className="hiw-body hiw-leg-lead">{LEG.lead}</p>
        <div className="hiw-formula" role="figure" aria-label={LEG.formulaLabel}>
          {LEG.formula.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </div>
        <dl className="hiw-params">
          {LEG.rows.map(([key, meaning]) => (
            <div key={key}>
              <dt>{key}</dt>
              <dd>: {meaning}</dd>
            </div>
          ))}
        </dl>
      </div>
      <article className="hiw-card hiw-card-blue hiw-rise hiw-who" style={riseDelay(1, 500)}>
        <div className="hiw-card-head">
          <span className="hiw-icon" data-tone="blue" aria-hidden>
            <EyeOffIcon />
          </span>
          <h3 className="hiw-card-title hiw-who-title">{LEG.whoTitle}</h3>
        </div>
        <p className="hiw-body">{LEG.whoLead}</p>
        <dl className="hiw-who-rows">
          {SUMMARY.map(([who, sees]) => (
            <div key={who}>
              <dt>{who}</dt>
              <dd>{sees}</dd>
            </div>
          ))}
        </dl>
        <Link href={WHO_SEES_WHAT_PATH} className="hiw-who-link" data-cursor="hover">
          {LEG.matrixLink}
        </Link>
      </article>
    </section>
  );
}
