import type { Metadata } from "next";
import { TICKERS } from "@owarine/core/market";
import { notFound } from "next/navigation";
import { TerminalScreen } from "@/features/terminal/TerminalScreen";

/** `/trade/BTC` — the trading screen (Tradash's one screen; TRADASH-FIDELITY.md). Unknown symbols 404. */
export async function generateMetadata({ params }: { params: Promise<{ symbol: string }> }): Promise<Metadata> {
  const { symbol } = await params;
  const t = TICKERS[symbol.toUpperCase() as keyof typeof TICKERS];
  return { title: t ? `${t.name} (${symbol.toUpperCase()})` : "Trade" };
}

export default async function TradePage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const upper = symbol.toUpperCase();
  if (!(upper in TICKERS)) notFound();
  return <TerminalScreen symbol={upper} />;
}
