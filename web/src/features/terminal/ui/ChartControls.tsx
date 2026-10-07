"use client";

import { CandlestickChart, ChevronDown, Crosshair, LineChart, Music2 } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type RefObject } from "react";
import { haptic } from "@/lib/haptics";
import { MUSIC_TRACK_NAMES, setMusic } from "@/lib/sound/music";
import { playTrade } from "@/lib/sound/trade";
import { cn } from "@/lib/utils";
import { HOUR_INTERVALS, MINUTE_INTERVALS, type CandleInterval } from "../chart/candles";
import type { ChartHandle } from "../chart/LiveChart";
import { MUSIC_TRACKS, setTradeSettings, useTradeSettings } from "../settings";

const tap = () => (playTrade("tap"), haptic("tap"));
const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Tradash's chart controls (`aW` interval + chart type, `aZ` music, `aq` recentre): the interval pill (dimmed in line
 * view) opens a popover of minutes and hours & days — picking one switches to candles; the round toggle swaps line and
 * candles; the music button shows an equaliser while on and a "♪ Track ›" chip that steps tracks; recentre appears when
 * the candle view is panned away.
 */
export function ChartControls({ handle }: { handle: RefObject<ChartHandle | null> }) {
  const settings = useTradeSettings();
  const reduce = useReducedMotion();
  const [menu, setMenu] = useState(false);
  const [chip, setChip] = useState(false);
  const [offCentre, setOffCentre] = useState(false);
  const chipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const candles = settings.chartView === "candles";

  useEffect(() => setMusic(settings.musicEnabled, settings.musicTrack), [settings.musicEnabled, settings.musicTrack]);
  useEffect(() => {
    if (!candles) return setOffCentre(false);
    const id = setInterval(() => setOffCentre(handle.current?.offCentre() ?? false), 300);
    return () => clearInterval(id);
  }, [candles, handle]);

  const pick = (interval: CandleInterval) => {
    tap();
    setTradeSettings({ chartInterval: interval, chartView: "candles" });
    setMenu(false);
  };
  const showChip = () => {
    setChip(true);
    if (chipTimer.current) clearTimeout(chipTimer.current);
    chipTimer.current = setTimeout(() => setChip(false), 4_000);
  };

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <button
          type="button"
          aria-label={`Candle interval: ${settings.chartInterval}`}
          aria-expanded={menu}
          onClick={() => (tap(), setMenu((m) => !m))}
          className={cn("ow-glass flex h-10 items-center gap-1 rounded-full px-3.5 text-ow-caption font-bold", !candles && "text-ow-muted")}
        >
          {settings.chartInterval}
          <ChevronDown className={cn("size-3.5 transition-transform", menu && "rotate-180")} />
        </button>
        <AnimatePresence>
          {menu ? (
            <motion.div
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97 }}
              transition={{ duration: 0.16, ease: EASE }}
              className="ow-glass absolute bottom-12 left-0 z-40 flex w-[17.5rem] flex-col gap-2 rounded-ow-card p-3"
            >
              {[
                ["Minutes", MINUTE_INTERVALS],
                ["Hours & days", HOUR_INTERVALS],
              ].map(([title, list]) => (
                <div key={title as string}>
                  <p className="mb-1.5 text-ow-micro font-bold text-ow-muted">{title as string}</p>
                  <div className="grid grid-cols-5 gap-1.5">
                    {(list as readonly CandleInterval[]).map((i) => (
                      <button key={i} type="button" onClick={() => pick(i)} className={cn("h-8 rounded-full text-ow-caption font-bold", candles && settings.chartInterval === i ? "ow-up-solid" : "bg-ow-recessed")}>
                        {i}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
      <button
        type="button"
        aria-label={candles ? "Switch to line" : "Switch to candles"}
        onClick={() => (tap(), setTradeSettings({ chartView: candles ? "line" : "candles" }))}
        className="ow-glass grid size-10 place-items-center rounded-full"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span key={candles ? "c" : "l"} initial={reduce ? false : { rotate: -30, scale: 0.8, opacity: 0 }} animate={{ rotate: 0, scale: 1, opacity: 1 }} transition={{ duration: 0.14 }}>
            {candles ? <LineChart className="size-4.5" /> : <CandlestickChart className="size-4.5" />}
          </motion.span>
        </AnimatePresence>
      </button>
      <button
        type="button"
        aria-label={settings.musicEnabled ? "Turn music off" : "Turn music on"}
        aria-pressed={settings.musicEnabled}
        onClick={() => {
          tap();
          const on = !settings.musicEnabled;
          setTradeSettings({ musicEnabled: on });
          if (on) showChip();
        }}
        className={cn("ow-glass grid size-10 place-items-center rounded-full", settings.musicEnabled && "text-ow-up")}
      >
        {settings.musicEnabled ? <Equaliser still={Boolean(reduce)} /> : <Music2 className="size-4.5" />}
      </button>
      <AnimatePresence>
        {chip && settings.musicEnabled ? (
          <motion.button
            type="button"
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              tap();
              const next = MUSIC_TRACKS[(MUSIC_TRACKS.indexOf(settings.musicTrack) + 1) % MUSIC_TRACKS.length]!;
              setTradeSettings({ musicTrack: next });
              showChip();
            }}
            className="ow-glass h-8 rounded-full px-3 text-ow-micro font-bold"
          >
            ♪ {MUSIC_TRACK_NAMES[settings.musicTrack]} ›
          </motion.button>
        ) : null}
      </AnimatePresence>
      {offCentre ? (
        <button type="button" aria-label="Recentre" onClick={() => (tap(), handle.current?.recentre())} className="ow-glass grid size-10 place-items-center rounded-full">
          <Crosshair className="size-4.5" />
        </button>
      ) : null}
    </div>
  );
}

/** Three bars that bounce while music plays (still under reduced motion). */
function Equaliser({ still }: { still: boolean }) {
  return (
    <span aria-hidden className="flex h-4 items-end gap-0.5">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-1 rounded-full bg-current"
          initial={{ height: "40%" }}
          animate={still ? { height: "60%" } : { height: ["30%", "100%", "50%", "80%", "30%"] }}
          transition={still ? undefined : { duration: 0.9 + i * 0.15, repeat: Infinity, ease: "easeInOut", delay: i * 0.12 }}
        />
      ))}
    </span>
  );
}
