// From docs-site: node scripts/export-readme-architecture.mjs
// Uses the existing Playwright and Mermaid dependencies; no external services.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const require = createRequire(import.meta.url);
const assets = resolve(import.meta.dirname, '../../.github/assets');
const source = readFileSync(resolve(assets, 'architecture.mmd'), 'utf8');
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1800, height: 1000 }, deviceScaleFactor: 2 });
  await page.setContent('<!doctype html><html><head><style>body{margin:0;background:#fff}main{display:inline-block;padding:32px}svg{display:block;max-width:none!important}</style></head><body><main></main></body></html>');
  await page.addScriptTag({ path: require.resolve('mermaid/dist/mermaid.min.js') });
  await page.evaluate(async diagram => {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: 'base',
      look: 'classic',
      fontFamily: 'Arial, sans-serif',
      themeVariables: {
        fontSize: '18px',
        primaryColor: '#FFFFFF',
        primaryTextColor: '#161616',
        primaryBorderColor: '#B000B5',
        lineColor: '#B000B5',
      },
      flowchart: { htmlLabels: false, curve: 'basis', nodeSpacing: 40, rankSpacing: 50, padding: 20, wrappingWidth: 350 },
    });
    const { svg } = await mermaid.render('readme-architecture', diagram);
    document.querySelector('main').innerHTML = svg;
    const element = document.querySelector('svg');
    const { width, height } = element.viewBox.baseVal;
    element.setAttribute('width', width);
    element.setAttribute('height', height);
    await document.fonts.ready;
  }, source);
  const nodes = await page.locator('g.node').count();
  const edges = await page.locator('path.flowchart-link').count();
  if (nodes !== 6 || edges !== 6) throw new Error(`Unexpected graph: ${nodes} nodes, ${edges} edges`);
  await page.locator('main').screenshot({ path: resolve(assets, 'architecture.png') });
  console.log(`Exported architecture.png (${nodes} nodes, ${edges} arrows; 2× resolution)`);
} finally {
  await browser.close();
}
