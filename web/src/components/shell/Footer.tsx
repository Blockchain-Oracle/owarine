import { DOCS_URL } from "@/lib/docs-url";

/**
 * S25: where the prices come from, in one factual line. On Canton the venue's oracle parties sign every print, and each
 * one is re-checkable on the proof page; the upstream sources are named neutrally, as data, not as a chain.
 */
const CREDIT = "Prices signed by the venue's oracle parties from exchange, PreStocks, Pyth, RedStone and Switchboard data · every print checkable on the proof page";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-row">
          <span className="footer-credit">{CREDIT}</span>
          <span>
            <a href={DOCS_URL} data-cursor="hover">
              Docs
            </a>
            {" · "}
            <a href="/legal" data-cursor="hover">
              Legal
            </a>
          </span>
        </div>
      </div>
    </footer>
  );
}
