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
  repository: 'https://github.com/Blockchain-Oracle/owarine',
  // Public, revision-pinned source notes and llms.txt's README entry.
  // Null until the repository is public; the sidebar repository link is independent.
  source: null as string | null,
  revision: 'ecf948f',
  reviewed: '2026-10-06',
};
export function appUrl(path = '/markets') { return new URL(path, site.app).toString(); }
export function sourceUrl(path: string): string | null {
  return site.source && site.revision ? `${site.source}/blob/${site.revision}/${path}` : null;
}
