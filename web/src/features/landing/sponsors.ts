/**
 * Who this is built on (C-S25, C10f): Canton Network, Noders (and its AppsFactory platform) and BitSafe, each with what
 * it does for this product today, said truthfully. Pure data, shared by the web's "Built on" band and How It Works and
 * by the phone's How It Works (the phone resolves `@/` to `web/src`), so the words cannot drift between them.
 *
 * Marks (K-250): a brand's logo is shown only where its own published brand kit allows it, cited below, each file as
 * supplied in the variant the kit names for a light or a dark ground, never recoloured, alone in its own cell. Canton's
 * guidelines also ask for the attribution line (`CANTON_ATTRIBUTION`), which the site footer and the docs carry.
 * Every other third-party name in the product (the price sources, PreStocks) goes as plain text.
 */
export type SponsorId = "canton" | "noders" | "bitsafe";

export interface Sponsor {
  id: SponsorId;
  name: string;
  /** What it is for this product, in two or three words. */
  role: string;
  /** What it does here today; never more than the evidence shows. */
  line: string;
  href: string;
  /** The published brand kit that allows the mark's use (K-250). */
  kit: string;
  /** The supplied files' aspect, width over height, so the mark keeps its proportions at any height. */
  aspect: number;
}

export const SPONSORS: readonly Sponsor[] = [
  {
    id: "canton",
    name: "Canton Network",
    role: "The ledger",
    line: "Every position is a Daml contract signed by its owner and the venue, so no other party's node receives it. Five Daml packages are written for it.",
    href: "https://www.canton.network",
    kit: "https://www.canton.network/brand-kit-trademark-use",
    aspect: 1432 / 369,
  },
  {
    id: "noders",
    name: "Noders",
    role: "The node and the hackathon",
    line: "Noders organises HackCanton Season 3 on its AppsFactory platform and hosts the shared DevNet node (Canton 3.5.19) these packages go to next. Nothing is uploaded there yet.",
    href: "https://noders.team",
    kit: "https://noders.team/brandkit",
    aspect: 961 / 320,
  },
  {
    id: "bitsafe",
    name: "BitSafe",
    role: "Governed resolution",
    line: "abu-pm-governance runs resolution through BitSafe's released GovernanceRules, so a two-of-three committee, not one key, records and resolves a Window. Its 14 Daml tests pass; the multi-node LocalNet run is next.",
    href: "https://bitsafe.finance",
    kit: "https://bitsafe.finance/brand-kit",
    aspect: 211 / 36,
  },
];

/** The notice Canton's trademark guidelines ask for wherever a Canton mark is used. */
export const CANTON_ATTRIBUTION =
  "Canton is a registered trademark of Digital Asset (Switzerland) GmbH. Digital Asset is not affiliated with, and has not sponsored or endorsed, Agari. The Noders and BitSafe marks belong to their owners and are used as their brand kits allow.";

export const SPONSORS_COPY = {
  label: "Built on",
  prices: "Prices from",
  visit: (name: string) => `${name} ↗`,
} as const;
