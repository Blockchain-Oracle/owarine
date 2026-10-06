import { ArrowLeftIcon, EyeOffIcon, ShieldAlertIcon, TerminalIcon } from "lucide-react";
import Link from "next/link";
import { CodeBlock } from "@/components/ui/code-block";
import { WHO_SEES_WHAT as W } from "./copy";
import { MATRIX, NOT_HIDDEN, OTHER_PACKAGES, PARTIES, RUN_IT, type MatrixGroup } from "./matrix";
import "./who-sees-what.css";

const HOW_IT_WORKS_PATH = "/how-it-works";
const PROOF_PATH = "/proof";

/** One package's table: contracts down, parties across, each cell what that party's node receives. Scrolls inside its card on a phone. */
function GroupTable({ group }: { group: MatrixGroup }) {
  return (
    <section className="hiw-section" aria-label={group.title}>
      <h2 className="hiw-label">
        {group.title} <span className="wsw-package">{group.package}</span>
      </h2>
      <div className="hiw-card wsw-card">
        <div className="wsw-scroll" role="region" aria-label={W.scroll(group.title)} tabIndex={0}>
          <table className="wsw-table">
            <thead>
              <tr>
                <th scope="col">{W.contract}</th>
                {PARTIES.map((party) => (
                  <th key={party} scope="col" className="wsw-party">
                    {party}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {group.rows.map((row) => (
                <tr key={row.contract}>
                  <th scope="row" className="wsw-contract">
                    <span className="wsw-name">
                      {row.contract}
                      {row.tested && (
                        <abbr className="wsw-t" title={W.tested}>
                          T
                        </abbr>
                      )}
                    </span>
                    <span className="wsw-what">{row.what}</span>
                    <span className="wsw-sig">
                      {W.signatory} {row.signatory} · {W.observer} {row.observer}
                    </span>
                  </th>
                  {row.seen.map((seen, index) => (
                    <td key={PARTIES[index]} className="wsw-cell" data-seen={seen}>
                      <span aria-hidden>{W.cell[seen]}</span>
                      <span className="sr-only">{`${PARTIES[index]}: ${W.cellLabel[seen]}`}</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

/**
 * `/who-sees-what` — the privacy matrix with runnable commands (C-ADD-11), in How It Works' own grammar (`.hiw-*`):
 * a legend, one table per package, the other packages in sentences, what the ledger's privacy does not hide, and the
 * three commands from `docs/business/privacy-matrix.md`. Static: every fact is the Daml source's, nothing is read live.
 */
export function WhoSeesWhatPage() {
  return (
    <div className="hiw wsw">
      <div className="hiw-main">
        <div className="hiw-wrap">
          <Link href={HOW_IT_WORKS_PATH} className="hiw-back" data-cursor="hover">
            <ArrowLeftIcon className="hiw-back-arrow" aria-hidden />
            {W.back}
          </Link>

          <header className="hiw-hero">
            <h1 className="hiw-title">{W.title}</h1>
            <p className="hiw-lead">{W.lead}</p>
          </header>

          <section className="hiw-section" aria-label={W.legendTitle}>
            <h2 className="hiw-label">
              <EyeOffIcon aria-hidden />
              {W.legendTitle}
            </h2>
            <dl className="hiw-card wsw-legend">
              {W.legend.map(([mark, meaning]) => (
                <div key={mark}>
                  <dt>{mark}</dt>
                  <dd>{meaning}</dd>
                </div>
              ))}
            </dl>
          </section>

          {MATRIX.map((group) => (
            <GroupTable key={group.title} group={group} />
          ))}

          <section className="hiw-section" aria-label={W.others}>
            <h2 className="hiw-label">{W.others}</h2>
            <dl className="hiw-card wsw-others">
              {OTHER_PACKAGES.map(([contract, sentence]) => (
                <div key={contract}>
                  <dt>{contract}</dt>
                  <dd>{sentence}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="hiw-section" aria-label={W.notHidden}>
            <h2 className="hiw-label hiw-label-blue">
              <ShieldAlertIcon aria-hidden />
              {W.notHidden}
            </h2>
            <div className="hiw-card hiw-card-blue">
              <p className="hiw-body">{W.notHiddenLead}</p>
              <ol className="wsw-limits">
                {NOT_HIDDEN.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ol>
              <p className="hiw-foot">
                {W.trust}{" "}
                <Link href={PROOF_PATH} className="wsw-link" data-cursor="hover">
                  {W.trustLink}
                </Link>
              </p>
            </div>
          </section>

          <section className="hiw-section" aria-label={W.run}>
            <h2 className="hiw-label">
              <TerminalIcon aria-hidden />
              {W.run}
            </h2>
            <p className="hiw-body wsw-run-lead">{W.runLead}</p>
            <ol className="wsw-run">
              {RUN_IT.map((step, index) => (
                <li key={step.title} className="hiw-card">
                  <div className="hiw-step-label">
                    {index + 1}. {step.title}
                  </div>
                  <p className="hiw-body">{step.body}</p>
                  <CodeBlock filename={step.file} code={step.code} label={step.title} className="wsw-code" />
                  <p className="hiw-foot">
                    <strong>{W.look}:</strong> {step.look}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}
