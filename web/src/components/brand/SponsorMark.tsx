import type { CSSProperties } from "react";
import type { Sponsor } from "@/features/landing/sponsors";
import "./sponsor-mark.css";

/**
 * A sponsor's own mark (K-250): the file its brand kit supplies for a light ground and the one for a dark ground, each
 * shown only under its theme (`[data-theme]`), never recoloured or redrawn. Both are lazy, so the hidden one is not
 * fetched. The accessible name is the brand's, once.
 */
export function SponsorMark({ sponsor, className }: { sponsor: Sponsor; className?: string }) {
  const style = { "--mark-aspect": sponsor.aspect } as CSSProperties;
  return (
    <span className={className ? `sponsor-mark ${className}` : "sponsor-mark"} style={style} role="img" aria-label={sponsor.name}>
      {/* eslint-disable-next-line @next/next/no-img-element -- a brand's supplied SVG, shown as supplied */}
      <img className="sponsor-mark-light" src={`/brands/${sponsor.id}-on-light.svg`} alt="" loading="lazy" decoding="async" />
      {/* eslint-disable-next-line @next/next/no-img-element -- a brand's supplied SVG, shown as supplied */}
      <img className="sponsor-mark-dark" src={`/brands/${sponsor.id}-on-dark.svg`} alt="" loading="lazy" decoding="async" />
    </span>
  );
}
