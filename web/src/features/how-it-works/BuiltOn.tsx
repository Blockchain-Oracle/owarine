import { BlocksIcon } from "lucide-react";
import { SponsorMark } from "@/components/brand/SponsorMark";
import { SPONSORS } from "@/features/landing/sponsors";
import { HOW_IT_WORKS } from "./copy";
import { BUILT_ON_LEAD } from "./leg";
import { riseDelay } from "./rise";

/** "Built On" (C-S25): Canton Network, Noders and BitSafe as the architecture cards, each with its own mark (K-250). */
export function BuiltOn() {
  return (
    <section className="hiw-section" aria-label={HOW_IT_WORKS.sections.builtOn}>
      <h2 className="hiw-label hiw-label-blue">
        <BlocksIcon aria-hidden />
        {HOW_IT_WORKS.sections.builtOn}
      </h2>
      <p className="hiw-body hiw-built-lead">{BUILT_ON_LEAD}</p>
      <div className="hiw-built">
        {SPONSORS.map((sponsor, index) => (
          <article key={sponsor.id} className="hiw-card hiw-rise hiw-built-card" style={riseDelay(index, 650)} data-sponsor={sponsor.id}>
            <SponsorMark sponsor={sponsor} className="hiw-built-mark" />
            <p className="hiw-built-role">{sponsor.role}</p>
            <p className="hiw-body">{sponsor.line}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
