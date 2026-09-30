import { LEGAL } from "./copy";

/** `/legal`, in the news page's section rhythm: the head, then one block per notice. */
export function LegalScreen() {
  return (
    <div className="container news-page">
      <div className="news-inner">
        <h1 className="news-title">
          {LEGAL.heading} <span className="vermilion">{LEGAL.headingAccent}</span>
        </h1>
        <p className="news-intro">{LEGAL.intro}</p>
        {LEGAL.sections.map((section) => (
          <section key={section.id} id={section.id} aria-labelledby={`legal-${section.id}`}>
            <h2 id={`legal-${section.id}`}>{section.heading}</h2>
            <p>{section.body}</p>
            <p>
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
        <p className="news-intro">{LEGAL.notices}</p>
      </div>
    </div>
  );
}
