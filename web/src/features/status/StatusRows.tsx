import {
  Activity, AlertTriangle, Armchair, Bot, Boxes, CheckCircle2, CircleDashed, Cpu, Database, Droplets, Gavel, GitCompare, HandCoins,
  LineChart, PauseCircle, Printer, Radar, Radio, Satellite, ToggleRight, Wallet, XCircle, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { STATUS } from "./copy";
import { lagTone, type LagTone, type StatusPayload, type StatusPipeline } from "./protocol";

const B = STATUS.board;

/** The tone's colours, on the kit tokens: dot, value ink, and the wash a failing card sits on. */
const TONE: Record<LagTone, { dot: string; ink: string; wash: string }> = {
  good: { dot: "bg-ow-up-line", ink: "text-ow-ink", wash: "" },
  warn: { dot: "bg-ow-breakeven", ink: "text-ow-breakeven", wash: "bg-ow-breakeven/10 ring-ow-breakeven/30" },
  bad: { dot: "bg-ow-down-line", ink: "text-ow-down", wash: "bg-ow-down-line/10 ring-ow-down-line/30" },
  off: { dot: "bg-ow-helper", ink: "text-ow-muted", wash: "" },
};
const RANK: Record<LagTone, number> = { bad: 0, warn: 1, good: 2, off: 3 };

/** "Oracle · Bitstamp freshness" → the system ("Oracle") and what is measured ("Bitstamp freshness"). */
function split(label: string): { group: string; metric: string } {
  const at = label.indexOf(" · ");
  return at < 0 ? { group: label, metric: label } : { group: label.slice(0, at), metric: label.slice(at + 3) };
}

/** Each system's glyph, by the first word of its name. */
const ICONS: readonly [RegExp, LucideIcon][] = [
  [/^canton ledger/i, Boxes], [/^projector/i, Radar], [/^oracle/i, Radio], [/^resolver/i, Gavel], [/^settler/i, HandCoins],
  [/^print sources/i, Printer], [/^pyth|^price relay/i, LineChart], [/^venue mode/i, ToggleRight], [/^redstone/i, Satellite],
  [/^cross-check|^switchboard/i, GitCompare], [/^lanes/i, PauseCircle], [/^faucet/i, Droplets], [/^sponsor/i, Wallet],
  [/^guest seats/i, Armchair], [/^ops/i, Cpu], [/^price feed/i, Activity], [/^database/i, Database], [/^sensei/i, Bot],
];
const iconOf = (group: string): LucideIcon => ICONS.find(([re]) => re.test(group))?.[1] ?? CircleDashed;

/** Seconds as a person reads them: 50s, 4m 10s, 1h 23m. */
function duration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m${sec % 60 ? ` ${sec % 60}s` : ""}`;
  return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
}
const valueOf = (p: StatusPipeline): string => (p.lagSec !== null ? duration(p.lagSec) : p.latencyMs !== null ? `${p.latencyMs} ms` : "—");

/**
 * The verdict, as the page's hero (Abu, 8 Oct: "too small to see, be creative"): the overall state in Owarine's display
 * type on its own tone, the slowest check, the ledger offset, a tally, and a pulse strip — one bar per check, in order,
 * so the whole venue's health reads at a glance before a word is read.
 */
export function StatusBanner({ payload }: { payload: StatusPayload }) {
  const tones = payload.pipelines.map(lagTone);
  const count = (t: LagTone) => tones.filter((x) => x === t).length;
  const tone: LagTone = payload.overall === "healthy" ? "good" : payload.overall === "degraded" ? "warn" : "bad";
  const Icon = tone === "good" ? CheckCircle2 : tone === "warn" ? AlertTriangle : XCircle;
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-ow-feature p-6 ring-1 sm:p-8",
        tone === "good" ? "bg-ow-up-line/10 ring-ow-up-line/30" : TONE[tone].wash,
      )}
      aria-label={B.verdict[payload.overall]}
    >
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="flex min-w-0 flex-col gap-3">
          <span className="flex items-center gap-2 text-ow-label font-semibold text-ow-muted">
            <Icon aria-hidden className={cn("size-5", tone === "good" ? "text-ow-up" : TONE[tone].ink)} strokeWidth={2.5} />
            {B.eyebrow}
          </span>
          <h1 className="ow-display ow-display-md">{B.verdict[payload.overall]}</h1>
          <p className="text-ow-lead text-ow-muted">
            {payload.maxLagSec !== null && payload.maxLagPipeline ? B.worst(payload.maxLagPipeline, duration(payload.maxLagSec)) : B.allFresh}
          </p>
        </div>
        <div className="flex flex-col items-start gap-1 sm:items-end sm:text-right">
          <span className="text-ow-label font-medium text-ow-muted">{B.offset}</span>
          <span className="ow-num text-ow-figure leading-none font-bold">{payload.slot === null ? STATUS.noSlot : payload.slot.toLocaleString("en-US")}</span>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {(["bad", "warn", "good", "off"] as const).map((t) =>
          count(t) > 0 ? (
            <span key={t} className="inline-flex h-9 items-center gap-2 rounded-full bg-ow-card px-3.5 text-ow-label ring-1 ring-ow-hairline">
              <span aria-hidden className={cn("size-2.5 rounded-full", TONE[t].dot)} />
              <span className="ow-num font-bold">{count(t)}</span>
              <span className="text-ow-muted">{B.tally[t]}</span>
            </span>
          ) : null,
        )}
      </div>

      <div className="mt-5 flex h-8 items-end gap-0.75" aria-hidden>
        {payload.pipelines.map((p, i) => (
          <span
            key={p.id}
            title={`${p.label} · ${B.tone[tones[i] ?? "off"]}`}
            className={cn("min-w-0 flex-1 rounded-full", TONE[tones[i] ?? "off"].dot, tones[i] === "bad" ? "h-8" : tones[i] === "warn" ? "h-6" : tones[i] === "off" ? "h-2.5 opacity-50" : "h-4")}
          />
        ))}
      </div>
    </section>
  );
}

function Row({ pipeline, sessionLabel, metricOnly }: { pipeline: StatusPipeline; sessionLabel: string | null; metricOnly: boolean }) {
  const tone = lagTone(pipeline);
  const { metric } = split(pipeline.label);
  const notConfigured = pipeline.optional && !pipeline.configured;
  return (
    <li className="flex gap-3 py-3.5">
      <span aria-hidden className={cn("mt-2 size-2.5 shrink-0 rounded-full", TONE[tone].dot)} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-ow-lead font-semibold">{metricOnly ? metric : pipeline.label}</span>
          <span className={cn("ow-num shrink-0 text-ow-title font-bold", TONE[tone].ink)}>{valueOf(pipeline)}</span>
        </div>
        <p className="text-ow-label text-ow-muted">{pipeline.detail}</p>
        {notConfigured || pipeline.expected ? (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {notConfigured && <span className="rounded-full bg-ow-recessed px-2.5 py-0.5 text-ow-micro font-semibold text-ow-muted">{STATUS.optional}</span>}
            {pipeline.expected && <span className="rounded-full bg-ow-breakeven/12 px-2.5 py-0.5 text-ow-micro font-semibold text-ow-ink">{STATUS.expected(sessionLabel)}</span>}
          </div>
        ) : null}
      </div>
    </li>
  );
}

/**
 * Every check, said large enough to read: what needs attention first (failing, then slow) as cards of their own, then
 * each system as a card — its glyph, its name, a dot per check — with its checks as rows whose detail wraps instead of
 * being cut off. Systems with a problem come first; inside one, the worst check leads.
 */
export function StatusTable({ pipelines, sessionLabel = null }: { pipelines: StatusPipeline[]; sessionLabel?: string | null }) {
  const attention = pipelines.filter((p) => RANK[lagTone(p)] <= 1).sort((a, b) => RANK[lagTone(a)] - RANK[lagTone(b)]);
  const groups = new Map<string, StatusPipeline[]>();
  for (const p of pipelines) {
    const { group } = split(p.label);
    groups.set(group, [...(groups.get(group) ?? []), p]);
  }
  const worst = (list: StatusPipeline[]) => Math.min(...list.map((p) => RANK[lagTone(p)]));
  const ordered = [...groups.entries()].map(([name, list], i) => ({ name, i, list: [...list].sort((a, b) => RANK[lagTone(a)] - RANK[lagTone(b)]) })).sort((a, b) => worst(a.list) - worst(b.list) || a.i - b.i);

  return (
    <div className="flex flex-col gap-8">
      {attention.length > 0 ? (
        <section className="flex flex-col gap-3" aria-labelledby="status-attention">
          <h2 id="status-attention" className="ow-display ow-display-sm">
            {B.attention}
          </h2>
          <ul className="grid gap-3 lg:grid-cols-2">
            {attention.map((p) => (
              <li key={p.id} className={cn("rounded-ow-card px-5 ring-1", TONE[lagTone(p)].wash)}>
                <ul>
                  <Row pipeline={p} sessionLabel={sessionLabel} metricOnly={false} />
                </ul>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="flex flex-col gap-3" aria-labelledby="status-all">
        <h2 id="status-all" className="ow-display ow-display-sm">
          {B.allChecks(pipelines.length)}
        </h2>
        <div className="columns-1 gap-4 lg:columns-2">
          {ordered.map(({ name, list }) => {
            const Glyph = iconOf(name);
            return (
              <section key={name} className="mb-4 break-inside-avoid rounded-ow-card bg-ow-card px-5 pt-4 pb-1 ring-1 ring-ow-hairline" aria-label={name}>
                <header className="flex items-center gap-3 border-b border-ow-hairline pb-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-ow-recessed">
                    <Glyph aria-hidden className="size-4.5" />
                  </span>
                  <h3 className="min-w-0 flex-1 truncate text-ow-title font-bold">{name}</h3>
                  <span className="flex gap-1" aria-hidden>
                    {list.map((p) => (
                      <span key={p.id} className={cn("size-2 rounded-full", TONE[lagTone(p)].dot)} />
                    ))}
                  </span>
                </header>
                <ul className="divide-y divide-ow-hairline">
                  {list.map((p) => (
                    <Row key={p.id} pipeline={p} sessionLabel={sessionLabel} metricOnly={list.length > 1 || split(p.label).metric !== p.label} />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </section>
    </div>
  );
}
