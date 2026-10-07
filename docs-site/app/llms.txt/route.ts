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
  const text = `# Owarine Docs

> Guides to Owarine, an Up/Down prediction market on Canton Network (test network, demo credits). Reviewed ${site.reviewed}.

Owarine's Daml packages (\`abu-pm-main\`, \`abu-pm-tickets\`, \`abu-pm-agents\`, \`abu-pm-games\`, and the Canton Coin rail \`abu-pm-cc\`, which is not run on a network yet) settle Up/Down Windows and tickets in demo credits; Three oracle parties post every boundary price: Coinbase, Kraken and Bitstamp 1-minute candle closes for crypto, and attested prints that name their source (RedStone, Alpaca, Jupiter Price v3, PreStocks) for the other lanes. A quorum of two agrees each boundary, and the resolver and the venue record each Window's result exactly once. Each position is a contract with two stakeholders, its seat's party and the venue. Everything described runs on a local Canton sandbox; nothing is on DevNet or a hosted URL yet. ${site.source ? `Application source: ${site.source} at ${site.revision}.` : 'The application repository is not public yet, so source links are not included.'}

## Start here

${priority.map(entry).join('\n')}

## All guides

${pages.filter(page => !start.includes(page.url)).map(entry).join('\n')}

## Complete export

- [Full documentation text](${site.docs}/llms-full.txt): All guides with canonical URLs.${readme}
`;
  return new Response(text, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
