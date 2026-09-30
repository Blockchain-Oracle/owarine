/**
 * The source's own mark at the head of the PreStocks and Pyth page. Only PreStocks is shown: it is a source the
 * oracle parties attest on Canton. Pyth is not used on Canton (no entitled key), so its mark is left off rather than
 * implying a live feed; the page explains why.
 */
export function SponsorLogos() {
  return <div className="not-prose my-6 flex flex-wrap items-center gap-x-10 gap-y-4">
    {/* eslint-disable-next-line @next/next/no-img-element -- a fixed-colour vector; next/image adds nothing */}
    <a href="https://prestocks.com" target="_blank" rel="noopener noreferrer"><img src="/brand/sponsors/prestocks-logo.svg" alt="PreStocks" className="h-7 w-auto" /></a>
  </div>;
}
