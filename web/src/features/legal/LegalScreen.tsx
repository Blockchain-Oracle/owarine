import { LEGAL } from "./copy";
import "./legal.css";

/** `/legal`, in the news page's section rhythm: the head, then one block per notice. */
export function LegalScreen() {
  return (
    <div className="container news-page">
      <div className="news-inner">
        <h1 className="news-title">
          {LEGAL.heading} <span className="signal">{LEGAL.headingAccent}</span>
        </h1>
        <p className="news-intro">{LEGAL.intro}</p>
        {LEGAL.sections.map((section) => (
          <section key={section.id} id={section.id} className="legal-section" aria-labelledby={`legal-${section.id}`}>
            <h2 id={`legal-${section.id}`} className="legal-heading">
              {section.heading}
            </h2>
            <p className="news-intro">{section.body}</p>
            <p className="news-intro legal-credits">
              <a href={section.credit.href} rel="noopener" data-cursor="hover">
                {section.credit.text}
              </a>
              {" · "}
              <a href={section.license.href} rel="noopener license" data-cursor="hover">
                {section.license.text}
              </a>
            </p>
          </section>
        ))}
        <p className="news-intro legal-notices">{LEGAL.notices}</p>
      </div>
    </div>
  );
}
