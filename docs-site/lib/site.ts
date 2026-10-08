function origin(value: string | undefined, fallback: string) {
  const url = new URL(value || fallback);
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Site origins must use HTTP or HTTPS.');
  return url.origin;
}
// Local previews can override these origins; ordinary guide links open the hosted product.
export const site = {
  name: 'Owarine',
  docs: origin(process.env.NEXT_PUBLIC_DOCS_URL, 'https://docs.owarine.xyz'),
  app: origin(process.env.NEXT_PUBLIC_APP_URL, 'https://owarine.xyz'),
  // The one repository for the app and these docs: the sidebar's GitHub link, llms.txt's README entry and per-page
  // source notes, all pinned to `revision`. Null until the Canton repository is public: pages then name paths alone.
  source: null as string | null,
  revision: 'ecf948f',
  reviewed: '2026-10-06',
};
export function appUrl(path = '/markets') { return new URL(path, site.app).toString(); }
export function sourceUrl(path: string): string | null {
  return site.source && site.revision ? `${site.source}/blob/${site.revision}/${path}` : null;
}
