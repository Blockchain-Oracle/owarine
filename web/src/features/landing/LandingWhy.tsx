import Link from "next/link";
import { LANDING_STORY, WHO_SEES_WHAT_PATH } from "./story-copy";

/**
 * "Your position stays yours" (C10f): the problem, who it is for and why Canton, in the three-step section's column
 * grammar (`.lp-step` kicker and display title, hairline-ruled columns). Each fact is a cited outside source or a
 * statement the repository proves; the matrix link opens the contract-by-contract page. Server-rendered; no data.
 */
export function LandingWhy() {
  const { why } = LANDING_STORY;
  return (
    <div className="lp-why">
      <ol className="lp-steps lp-why-cols">
        {why.cards.map((card, index) => (
          <li key={card.kicker} className="lp-step lp-why-col" data-step={index + 1}>
            <p className="lp-step-kicker lp-why-kicker">{card.kicker}</p>
            <h3 className="lp-step-title">{card.title}</h3>
            <p className="lp-step-body lp-why-body">{card.body}</p>
            <ul className="lp-why-facts">
              {card.facts.map((fact) => (
                <li key={fact.text} className="lp-why-fact">
                  <span>{fact.text}</span>
                  {fact.href && (
                    <>
                      {" · "}
                      <a href={fact.href} target="_blank" rel="noreferrer" className="lp-link" data-cursor="hover">
                        {fact.source}
                      </a>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      <Link href={WHO_SEES_WHAT_PATH} className="lp-link lp-why-matrix" data-cursor="hover">
        {why.matrix}
      </Link>
    </div>
  );
}
