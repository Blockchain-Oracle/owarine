"use client";

import { Globe, LoaderCircle } from "lucide-react";
import { PUBLISH, usePublications, usePublishCall } from "@/features/leaderboard/publish";
import { useWalletSession } from "@/lib/wallet-session";
import { toast } from "../toasts";

/**
 * "Publish this call" for a live seat position, in the terminal's grammar: Owarine positions are private on Canton, so the
 * leaderboard and activity only ever see calls their owners publish. Published calls say so and can be retracted.
 */
export function PublishToggle({ marketId }: { marketId: string }) {
  const { address } = useWalletSession();
  const list = usePublications(address);
  const { publish, retract } = usePublishCall(address);
  if (!address || !list.data) return null;
  const published = list.data.value.some((p) => p.marketId === marketId && (p.product ?? null) === null);
  const busy = publish.isPending || retract.isPending;
  const go = () => {
    if (published) return retract.mutate({ marketId, product: null }, { onError: () => toast({ kind: "error", title: PUBLISH.failed }) });
    publish.mutate(
      { marketId, source: "leg" },
      {
        onSuccess: (r) => (r.kind === "refused" ? toast({ kind: "error", title: PUBLISH.refused[r.code] }) : toast({ kind: "success", title: "Published", description: "It counts on the leaderboard once it settles." })),
        onError: () => toast({ kind: "error", title: PUBLISH.failed }),
      },
    );
  };
  return (
    <button type="button" title={PUBLISH.explain} disabled={busy} onClick={go} className="col-span-2 flex h-9 items-center justify-center gap-1.5 rounded-full bg-ow-recessed text-ow-caption font-bold disabled:opacity-50">
      {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Globe className="size-4" />}
      {busy ? (published ? PUBLISH.retracting : PUBLISH.publishing) : published ? `${PUBLISH.published} · ${PUBLISH.retract}` : PUBLISH.publish}
    </button>
  );
}
