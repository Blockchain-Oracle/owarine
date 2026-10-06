import { CANTON_ATTRIBUTION } from "@/features/landing/sponsors";
import { DOCS_URL } from "@/lib/docs-url";

/**
 * S25: where the prices come from, in one factual line. On Canton the venue's oracle parties sign every print, and each
 * one is re-checkable on the proof page; the upstream sources are named neutrally, as data, not as a chain.
 * K-250: the Canton mark appears on the landing and in How It Works, so every page carries the attribution Canton's
 * trademark guidelines ask for, under the credit.
 */
const CREDIT = "Prices signed by the venue's oracle parties from Coinbase, Kraken, Bitstamp, RedStone, Alpaca, Jupiter Price v3 and PreStocks data · every print checkable on the proof page";

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
        <p className="footer-credit footer-attribution">{CANTON_ATTRIBUTION}</p>
      </div>
    </footer>
  );
}
