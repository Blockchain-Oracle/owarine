import type { NextConfig } from "next";
import { DOCS_URL, docsUrl } from "./src/lib/docs-url";

const nextConfig: NextConfig = {
  redirects: () => [
    { source: "/docs", destination: DOCS_URL, permanent: false },
    { source: "/docs/:path*", destination: docsUrl(":path*"), permanent: false },
    // Retired routes (revamp step 3): kept as redirects so old links land.
    { source: "/markets-live", destination: "/markets", permanent: true },
    { source: "/bell", destination: "/markets", permanent: true },
    { source: "/beta", destination: "/markets", permanent: true },
    { source: "/pool", destination: "/earn", permanent: true },
  ],
  transpilePackages: ["@owarine/brain", "@owarine/core", "@owarine/daml", "@owarine/ledger", "@owarine/markets"],
  // Next 16 writes AGENTS.md and CLAUDE.md on `next dev`; this repository carries no AI-tool files.
  agentRules: false,
};

export default nextConfig;
