import { source } from '@/lib/source';
import { guideMarkdown } from '@/lib/llms';
import { site } from '@/lib/site';
export const dynamic = 'force-static';

export async function GET() {
  const pages = await Promise.all(source.getPages().map(guideMarkdown));
  const intro = `# Owarine Docs — full text\n\nDocumentation origin: ${site.docs}\nApplication origin: ${site.app}\nOriginal guide review: ${site.reviewed}\nEvidence refresh: 2026-10-08 (entry, availability, packages, mobile and builder guides; other guides retain the original pin)\n\nEach guide includes its canonical URL. Resolve relative documentation links against the docs origin; AppLink components refer to the application origin. ${site.source ? `Application source: ${site.source} at ${site.revision}.` : 'The application repository is not public yet, so no source links are included.'}\n\n`;
  return new Response(intro + pages.join('\n\n---\n\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
