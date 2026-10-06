/**
 * The docs' "Built on" marks (K-250): Canton Network, Noders and BitSafe, each file as its owner's brand kit supplies
 * it, the light-ground variant in the light theme and the dark-ground one under `.dark`, never recoloured, each alone in
 * its own cell. The words match the app's band (`web/src/features/landing/sponsors.ts`).
 */
const SPONSORS = [
  { id: 'canton', name: 'Canton Network', role: 'The ledger', href: 'https://www.canton.network', height: 30 },
  { id: 'noders', name: 'Noders', role: 'The node and the hackathon', href: 'https://noders.team', height: 36 },
  { id: 'bitsafe', name: 'BitSafe', role: 'Governed resolution', href: 'https://bitsafe.finance', height: 22 },
] as const;

export function SponsorLogos() {
  return (
    <ul className="sponsor-logos not-prose">
      {SPONSORS.map((s) => (
        <li key={s.id}>
          <a href={s.href} target="_blank" rel="noreferrer" aria-label={s.name}>
            {/* eslint-disable-next-line @next/next/no-img-element -- a brand's supplied SVG, shown as supplied */}
            <img className="sponsor-on-light" src={`/brands/${s.id}-on-light.svg`} alt="" style={{ height: s.height }} loading="lazy" />
            {/* eslint-disable-next-line @next/next/no-img-element -- a brand's supplied SVG, shown as supplied */}
            <img className="sponsor-on-dark" src={`/brands/${s.id}-on-dark.svg`} alt="" style={{ height: s.height }} loading="lazy" />
          </a>
          <span>{s.role}</span>
        </li>
      ))}
    </ul>
  );
}
