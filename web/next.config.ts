import { execSync } from "node:child_process";
import type { NextConfig } from "next";
import { DOCS_URL, docsUrl } from "./src/lib/docs-url";

/** This build's id: the deploy's commit, else the checkout's, else the time — the updater compares it with the server's. */
function buildId(): string {
  const fromEnv = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.SOURCE_COMMIT ?? process.env.GIT_SHA;
  if (fromEnv) return fromEnv.slice(0, 12);
  try {
    return execSync("git rev-parse --short=12 HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return `t${Date.now()}`;
  }
}
const BUILD_ID = buildId();

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_BUILD_ID: BUILD_ID },
  generateBuildId: () => BUILD_ID,
  redirects: () => [
    { source: "/docs", destination: DOCS_URL, permanent: false },
    { source: "/docs/:path*", destination: docsUrl(":path*"), permanent: false },
    // Retired routes (revamp step 3): kept as redirects so old links land.
    { source: "/markets-live", destination: "/markets", permanent: true },
    { source: "/bell", destination: "/markets", permanent: true },
    { source: "/beta", destination: "/markets", permanent: true },
    { source: "/pool", destination: "/earn", permanent: true },
    // Developer surfaces taken off the product (8 Oct): the plain-words privacy answer lives on How it works.
    { source: "/demo", destination: "/how-it-works", permanent: true },
    { source: "/who-sees-what", destination: "/how-it-works", permanent: true },
  ],
  transpilePackages: ["@owarine/brain", "@owarine/core", "@owarine/daml", "@owarine/ledger", "@owarine/markets"],
  // Next 16 writes AGENTS.md and CLAUDE.md on `next dev`; this repository carries no AI-tool files.
  agentRules: false,
};

export default nextConfig;
