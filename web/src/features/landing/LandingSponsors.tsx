import { SponsorMark } from "@/components/brand/SponsorMark";
import { SPONSORS, SPONSORS_COPY } from "./sponsors";

/**
 * The "Built on" row of the band (C-S25): Canton Network, Noders and BitSafe, each as its own mark in its own column
 * (K-250), what it does for this product today, and a link to it. The price sources follow in the band's second row.
 */
export function LandingSponsors() {
  return (
    <div className="lp-built lp-sponsors">
      <p className="section-eyebrow lp-built-label">{SPONSORS_COPY.label}</p>
      <ul className="lp-built-cols lp-sponsor-cols">
        {SPONSORS.map((sponsor) => (
          <li key={sponsor.id} className="lp-built-col lp-sponsor" data-sponsor={sponsor.id}>
            <SponsorMark sponsor={sponsor} className="lp-sponsor-mark" />
            <p className="lp-sponsor-role">{sponsor.role}</p>
            <p className="lp-built-what">{sponsor.line}</p>
            <a href={sponsor.href} target="_blank" rel="noreferrer" className="lp-link lp-built-proof" data-cursor="hover">
              {SPONSORS_COPY.visit(sponsor.name)}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
