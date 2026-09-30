function origin(value: string | undefined, fallback: string) {
  const url = new URL(value || fallback);
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Site origins must use HTTP or HTTPS.');
  return url.origin;
}
// The Canton build has no hosted URL yet. A deploy sets both origins as build variables (runbooks/coolify-deploy.md:
// `https://<domain>` and `https://docs.<domain>`); until then the defaults are the local app and docs servers, so no
// link leaves for another product's site.
export const site = {
  name: 'Agari',
  docs: origin(process.env.NEXT_PUBLIC_DOCS_URL, 'http://localhost:3153'),
  app: origin(process.env.NEXT_PUBLIC_APP_URL, 'http://localhost:3000'),
  // The one repository for the app and these docs: the sidebar's GitHub link, llms.txt's README entry and per-page
  // source notes, all pinned to `revision`. Null until the Canton repository is public: pages then name paths alone.
  source: null as string | null,
  revision: 'a4d2e2d',
  reviewed: '2026-09-30',
};
export function appUrl(path = '/markets') { return new URL(path, site.app).toString(); }
export function sourceUrl(path: string): string | null {
  return site.source && site.revision ? `${site.source}/blob/${site.revision}/${path}` : null;
}
