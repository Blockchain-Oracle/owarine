import { isMarketId, toMarketId } from "@owarine/core/types";
import { SHARE_EXPIRES_PARAM, SHARE_SIG_PARAM, SHARE_STAKE_PARAM } from "@owarine/core/x";
import { Redirect, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { presetStake } from "@/features/markets/ticket/stake-preset";

/** How long the signed-link check may take before the Window opens without its stake preset. */
const CHECK_TIMEOUT_MS = 8_000;

type Params = { id: string; dir?: string; stake?: string; exp?: string; sig?: string };

/**
 * `/markets/<id>` — web's app/markets/[id]/page.tsx renders the Markets page with that Window in the hero: here it is
 * `/markets?m=<id>` (a side, when the link names one, opens the ticket there); a mistyped id lands on /markets.
 *
 * C13a: a Blink's signed Window share link opens here too (the same https path, as a universal link). The app holds no
 * server key, so it asks the web whether the signature holds (`/api/share/window`); if it does, the link's stake
 * pre-fills the ticket once through the same preset the hedge card uses. Either way the ticket opens on the side.
 */
export default function MarketRoute() {
  const { id, dir, stake, exp, sig } = useLocalSearchParams<Params>();
  const signed = isMarketId(id) && Boolean(stake && exp && sig);
  const [checked, setChecked] = useState(!signed);

  useEffect(() => {
    if (!signed) return;
    const q = new URLSearchParams({ m: id, dir: dir ?? "", [SHARE_STAKE_PARAM]: stake ?? "", [SHARE_EXPIRES_PARAM]: exp ?? "", [SHARE_SIG_PARAM]: sig ?? "" });
    let live = true;
    // The route shows nothing until this settles, so a check that hangs must not strand the person on a blank screen.
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), CHECK_TIMEOUT_MS);
    fetch(`/api/share/window?${q.toString()}`, { signal: abort.signal })
      .then((r) => (r.ok ? (r.json() as Promise<{ share: { stakeBase: string } | null }>) : { share: null }))
      .then((body) => {
        if (live && body.share) presetStake(toMarketId(id), BigInt(body.share.stakeBase));
      })
      .catch(() => undefined)
      .finally(() => {
        clearTimeout(timer);
        if (live) setChecked(true);
      });
    return () => {
      live = false;
      clearTimeout(timer);
      abort.abort();
    };
  }, [signed, id, dir, stake, exp, sig]);

  if (!isMarketId(id)) return <Redirect href="/markets" />;
  if (!checked) return null;
  const side = dir === "up" || dir === "down" ? { dir } : {};
  return <Redirect href={{ pathname: "/markets", params: { m: id, ...side } }} />;
}
