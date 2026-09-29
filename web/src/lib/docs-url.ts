/**
 * Where "Docs" points. The documentation is a separate application (`docs-site/`, ported for Canton in C10), so a
 * deployment names its host with `NEXT_PUBLIC_DOCS_URL`, and every `/docs/*` bookmark lands on the same path there.
 * With no host configured the link stays inside the app, on its own explainer, rather than pointing at another
 * product's domain.
 */
const IN_APP_DOCS = "/how-it-works";

const configured = process.env.NEXT_PUBLIC_DOCS_URL?.trim().replace(/\/+$/, "") || null;

export const DOCS_URL = configured ?? IN_APP_DOCS;

/** Resolve a documentation page beneath the docs site, including any base path; the in-app explainer has one page. */
export function docsUrl(path = ""): string {
  if (!configured) return IN_APP_DOCS;
  return path ? `${configured}/${path.replace(/^\/+/, "")}` : configured;
}
