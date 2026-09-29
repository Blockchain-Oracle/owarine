import { source } from '@/lib/source';
import { site } from '@/lib/site';
export const dynamic = 'force-static';

export function GET() {
  const start = ['/start/quickstart', '/trading/first-trade', '/architecture/overview', '/architecture/prestocks-and-pyth'];
  const pages = source.getPages();
  const priority = start.flatMap(url => pages.filter(page => page.url === url));
  const entry = (page: (typeof pages)[number]) => {
    const raw = `${site.docs}/raw/${page.slugs.join('/')}`;
    return `- [${page.data.title}](${site.docs}${page.url}): ${page.data.description || ''} [Markdown](${raw})`;
  };
  const readme = site.source && site.revision ? `\n- [Application README](${site.source}/blob/${site.revision}/README.md): Product overview, proof and architecture.` : '';
  const text = `# Agari Docs

> Guides to Agari, an Up/Down prediction market on Canton Network (test network, demo credits). Reviewed ${site.reviewed}.

Agari's Daml package (\`abu-pm-main\`) settles Up/Down Windows with demo credits. Three oracle parties post signed 1-minute candle closes, a quorum of two agrees each boundary, and a separate resolver party resolves each Window exactly once. Each position is a contract only its seat's party and the venue can see. Stock, PreStocks and Pyth prices on the same path, and the desk's live leg, are planned; practice desks move no money. ${site.source ? `Application source: ${site.source} at ${site.revision}.` : 'The application repository is not public yet, so source links are not included.'}

## Start here

${priority.map(entry).join('\n')}

## All guides

${pages.filter(page => !start.includes(page.url)).map(entry).join('\n')}

## Complete export

- [Full documentation text](${site.docs}/llms-full.txt): All guides with canonical URLs.${readme}
`;
  return new Response(text, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
