"use client";

import { Search, Wallet, BarChart3 } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Card,
  CountdownRing,
  DirectionPill,
  Eyebrow,
  FeatureCard,
  FluentArt,
  Keypad,
  Odometer,
  PillButton,
  PositionCard,
  PrivacyMask,
  PrivacyToggle,
  Seal,
  SearchPill,
  ShareCharm,
  Sheet,
  SkyCollage,
  Sticker,
  SwipeToConfirm,
  TextTabs,
  TextTabPanel,
} from "@/components/kit";
import { keypadDisplay } from "@owarine/core/input";
import { installTradeSounds, playTrade } from "@/lib/sound/trade";
import { setStoredTheme, resolveTheme, type Theme } from "@/lib/theme";

export function KitShowcase() {
  const [theme, setTheme] = useState<Theme>("light");
  const [tab, setTab] = useState<"home" | "portfolio" | "clubs" | "games">("home");
  const [pnl, setPnl] = useState(1.2345);
  const [open, setOpen] = useState(false);
  const [trail, setTrail] = useState(false);
  const [amount, setAmount] = useState("");
  const [sheet, setSheet] = useState(false);
  const [confirm, setConfirm] = useState<"idle" | "busy" | "done">("idle");
  const [now, setNow] = useState(0);

  useEffect(() => {
    setTheme(resolveTheme());
    setNow(Date.now());
  }, []);
  useEffect(() => installTradeSounds(), []);
  useEffect(() => {
    const id = window.setInterval(() => setPnl((p) => p + (Math.random() - 0.48) * 0.8), 400);
    return () => window.clearInterval(id);
  }, []);

  return (
    <main className="min-h-dvh bg-ow-canvas pb-40 text-ow-ink">
      <SkyCollage
        className="px-4 pt-16 pb-24 md:px-10"
        objects={[
          { name: "oldKey", x: 12, y: 30, size: 120, rotate: -18, float: 0 },
          { name: "coin", x: 86, y: 22, size: 96, rotate: 12, float: 1 },
          { name: "redPaperLantern", x: 80, y: 74, size: 130, rotate: 8, float: 2 },
          { name: "locked", x: 18, y: 80, size: 90, rotate: -10, float: 3 },
        ]}
      >
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <Seal size={72} stamp />
          <h1 className="ow-display ow-display-xl mt-6">Call the close</h1>
          <p className="ow-display ow-display-sm mt-4">Nobody sees your bets.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <PillButton tone="pink" size="lg">Start trading</PillButton>
            <PillButton tone="white" size="lg">Try the demo</PillButton>
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Sticker tone="lime">Private</Sticker>
            <Sticker tone="pink" tilt={5}>3 oracles sign it</Sticker>
            <Sticker tone="cream" tilt={-2}>On Canton</Sticker>
            <Sticker tone="black" tilt={3}>Pays 1.9×</Sticker>
          </div>
        </div>
      </SkyCollage>

      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 px-4 pt-10 md:grid-cols-2 md:px-6">
        <section className="flex min-w-0 flex-col gap-4">
          <div className="flex items-center justify-between">
            <TextTabs
              label="Sections"
              value={tab}
              onChange={setTab}
              size="lg"
              tabs={[
                { value: "home", label: "Home" },
                { value: "portfolio", label: "Portfolio" },
                { value: "clubs", label: "Clubs" },
                { value: "games", label: "Games" },
              ]}
            >
              <TextTabPanel value="home" />
            </TextTabs>
            <button
              type="button"
              className="rounded-full bg-ow-recessed px-3 py-1.5 text-ow-caption font-semibold"
              onClick={() => {
                const next = theme === "light" ? "dark" : "light";
                setStoredTheme(next);
                setTheme(next);
              }}
            >
              {theme === "light" ? "Dark" : "Light"}
            </button>
          </div>

          <FeatureCard tone="white">
            <div className="flex items-center justify-between">
              <Eyebrow>Balance</Eyebrow>
              <PrivacyToggle />
            </div>
            <PrivacyMask size="lg">
              <Odometer value={1284.56 + pnl} kind="usd" className="text-ow-hero leading-none font-extrabold tracking-[-0.045em]" />
            </PrivacyMask>
            <div className="mt-1 text-ow-body font-bold">
              <PrivacyMask size="sm">
                <Odometer value={pnl} kind="pnl" /> <span className="text-ow-muted font-medium">today</span>
              </PrivacyMask>
            </div>
            <div className="mt-6 flex gap-2">
              <PillButton tone="black" block>Add funds</PillButton>
              <PillButton tone="ghost" block>Withdraw</PillButton>
            </div>
          </FeatureCard>

          <Card className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="ow-body text-ow-cta font-bold">BTC · 5 min</p>
                <p className="text-ow-caption text-ow-muted">Closes 14:05 · above $98,420</p>
              </div>
              {now > 0 ? <CountdownRing startMs={now - 60_000} endMs={now + 240_000} /> : null}
            </div>
            {open ? (
              <DirectionPill mode="open" pnl={pnl} trailArmed={trail} onTrail={() => { playTrade("toggle"); setTrail((t) => !t); }} onClose={() => { playTrade(pnl >= 0 ? "close-win" : "close-loss"); setOpen(false); setTrail(false); }} />
            ) : (
              <DirectionPill mode="flat" upSub="pays 1.9×" downSub="pays 2.1×" onUp={() => { playTrade("open-up"); setOpen(true); }} onDown={() => { playTrade("open-down"); setOpen(true); }} />
            )}
          </Card>

          <PositionCard title="BTC UP · 5 min" side="up" meta="Window closes 14:05" value={10 + pnl} invested={10} avgIn="52¢" action={<PillButton tone="black" block>Close</PillButton>} />
        </section>

        <section className="flex min-w-0 flex-col gap-4">
          <Card className="flex flex-col items-center gap-4">
            <p className="ow-num text-ow-hero font-extrabold tracking-[-0.045em]">{keypadDisplay(amount)}</p>
            <Keypad value={amount} onChange={setAmount} onPress={() => playTrade("key")} className="w-full" />
            <PillButton tone="pink" size="lg" block onClick={() => { setConfirm("idle"); setSheet(true); playTrade("sheet-open"); }}>
              Review
            </PillButton>
          </Card>

          <div className="flex flex-wrap items-center gap-3">
            <PillButton tone="black">Black</PillButton>
            <PillButton tone="pink">Pink</PillButton>
            <PillButton tone="white">White</PillButton>
            <PillButton tone="ghost">Ghost</PillButton>
            <PillButton tone="up" size="sm">Up</PillButton>
            <PillButton tone="down" size="sm">Down</PillButton>
            <SearchPill />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <FeatureCard tone="pink" className="p-5"><FluentArt name="rocket" size={64} /><p className="ow-display mt-2 text-ow-heading">Moonshot</p></FeatureCard>
            <FeatureCard tone="sky" className="p-5"><FluentArt name="bullseye" size={64} /><p className="ow-display mt-2 text-ow-heading">Bullseye</p></FeatureCard>
            <FeatureCard tone="lime" className="p-5"><FluentArt name="slotMachine" size={64} /><p className="ow-display mt-2 text-ow-heading">Lucky</p></FeatureCard>
          </div>

          <ShareCharm call="BTC UP 5M" result="+184%" win handle="abu" />
        </section>
      </div>

      <Sheet
        open={sheet}
        onOpenChange={(o) => { setSheet(o); if (!o) playTrade("sheet-close"); }}
        title="Confirm"
        description={`Buy ${keypadDisplay(amount)} of BTC UP · 5 min`}
        footer={
          <SwipeToConfirm
            label="Swipe to confirm"
            state={confirm}
            onConfirm={() => {
              playTrade("swipe-confirm");
              setConfirm("busy");
              window.setTimeout(() => { setConfirm("done"); playTrade("success"); }, 1200);
            }}
          />
        }
      >
        <dl className="grid gap-3 text-ow-body">
          {[["You pay", keypadDisplay(amount)], ["Pays if right", "1.9×"], ["You lose it all if", "BTC closes below $98,420 at 14:05"], ["Who sees it", "You and the venue. Nobody else."]].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-6 border-b border-ow-hairline pb-3">
              <dt className="text-ow-muted">{k}</dt>
              <dd className="text-right font-bold">{v}</dd>
            </div>
          ))}
        </dl>
      </Sheet>

      <nav aria-label="Main" className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex items-center justify-center gap-2 px-4 pb-4 md:hidden">
        <div className="pointer-events-auto flex h-16 items-center gap-1 rounded-full bg-ow-black px-2 text-ow-white">
          <span className="flex h-12 min-w-16 flex-col items-center justify-center text-ow-micro font-semibold"><BarChart3 className="size-5" />Markets</span>
          <span className="grid size-12 place-items-center rounded-full bg-ow-pink"><Seal size={30} tone="white" /></span>
          <span className="flex h-12 min-w-16 flex-col items-center justify-center text-ow-micro font-semibold text-ow-white/60"><Wallet className="size-5" />Cash</span>
        </div>
        <button type="button" aria-label="Search" className="pointer-events-auto grid size-16 place-items-center rounded-full bg-ow-card"><Search className="size-5" /></button>
      </nav>
    </main>
  );
}
