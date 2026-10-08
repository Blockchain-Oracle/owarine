"use client";

import { isOk } from "@owarine/core/schemas";
import { useClaimables, usePositions } from "@owarine/markets/react";
import { SectionHeader } from "@/components/chrome";
import { ErrorState } from "@/components/states";
import { openFunds } from "@/features/funding";
import { PrivateBalancePanel } from "@/features/private";
import { TradingBalancePanel, useVaultOpenBets } from "@/features/vault";
import { XWalletCard } from "@/features/x";
import "@/features/x/x-card.css";
import { CLAIM, PORTFOLIO } from "@/lib/copy";
import { useWalletSession } from "@/lib/wallet-session";
import { useBalancePlate } from "../balance";
import { LiveClaimPlate } from "../claims";
import { RecordSection, TraderEdgeLink, useHistoryReading } from "../history";
import { useVenue } from "../useVenue";
import { BetsPanel } from "./BetsPanel";
import { ConnectCard } from "./ConnectCard";
import { MoneyHero, Pockets, useMoney } from "./plate";
import { usePortfolioTiers } from "./useTiers";

/**
 * Portfolio — the money, the open bets, and what is waiting to be collected (8 Oct redesign).
 *
 * The page has no headline: the rail says where you are, and the thing people open this page for is the number. So it
 * reads top-down at full width: the black balance card (the figure, the two actions, its split), the pockets that are
 * yours but not in the figure (Trading Balance, Private, X replies — each opens its controls in a wide sheet), then the
 * bets, what is waiting to be collected and the record, and the Trader Edge report last. No narrow side column: its
 * Deposit / Withdraw ran off the edge, and a two-column split made the money and the activity compete.
 */
export function PortfolioScreen() {
  const { address } = useWalletSession();
  const { boot, venueId } = useVenue();
  const symbol = boot && isOk(boot) ? boot.value.collateral.symbol : "credits";
  const money = useMoney();
  const positions = usePositions(address);
  const vaultBets = useVaultOpenBets(address);
  const plate = useBalancePlate();
  const claimables = useClaimables(address, venueId);

  // The critical tier: the balance, what is open, and what can be collected. Everything a
  // portfolio is actually opened for, and the only reads allowed to run first.
  const tiers = usePortfolioTiers([plate.kind === "connected" ? plate.reading : null, positions, claimables]);
  // The deferred tier waits for that answer. The settled-history scan is the page's most
  // expensive read and it describes Windows that have already closed; nothing about it is
  // urgent enough to compete with the number at the top of the page.
  const history = useHistoryReading(tiers.criticalSettled);
  const openBets = (positions && isOk(positions) ? positions.value.length : 0) + (vaultBets && isOk(vaultBets) ? vaultBets.value.length : 0);
  const settled = history.reading && isOk(history.reading) ? history.reading.value.rounds.length : 0;

  if (!address) {
    // Kept in the reference's order: the connect card first, the X wallet card below it (page L277–294).
    return (
      <div className="container grid gap-4 py-8 lg:grid-cols-2 lg:items-start">
        <ConnectCard />
        <XWalletCard />
      </div>
    );
  }

  // Every critical read failed on the connection: that is one fact, and it is said once. A page
  // of competing "Try again" buttons describes the same outage five times and fixes none of them.
  if (tiers.outage) {
    return (
      <div className="container flex flex-col gap-4 py-8">
        <ErrorState diagnosis={tiers.outage} retry={tiers.retry} />
      </div>
    );
  }

  return (
    <div className="container flex flex-col gap-10 py-8">
      <MoneyHero money={money} symbol={symbol} openBets={openBets} settled={settled} onPrimary={openFunds} />

      <Pockets money={money} symbol={symbol} panels={{ vault: <TradingBalancePanel inline />, private: <PrivateBalancePanel inline />, x: <XWalletCard /> }} />

      <BetsPanel symbol={symbol} index="01" history={history} />

      <section className="flex flex-col gap-4" aria-label={PORTFOLIO.collectTitle}>
        <SectionHeader index="02" title={PORTFOLIO.collectTitle} />
        <p className="type-body text-ink-secondary">{CLAIM.pageIntro}</p>
        <LiveClaimPlate />
      </section>

      <RecordSection history={history} symbol={symbol} index="03" />

      <TraderEdgeLink />
    </div>
  );
}
