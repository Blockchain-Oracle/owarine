"use client";

import { useState } from "react";
import { PUBLISH } from "./copy";
import { usePublications, usePublishCall, type PublishSource } from "./usePublications";

interface PublishCallProps {
  marketId: string;
  address: string | null;
  /** `leg` for a live position; `receipt` for a settled one (publishable once settlements leave a receipt). */
  source: PublishSource;
}

/**
 * The opt-in "Publish this call" control, in the cash-out link's grammar (`type-caption text-accent underline`). A
 * published call says so and can be retracted; a settled one that was never published says why it cannot be now.
 */
export function PublishCall({ marketId, address, source }: PublishCallProps) {
  const list = usePublications(address);
  const { publish, retract } = usePublishCall(address);
  const [note, setNote] = useState<string | null>(null);
  if (!address || !list.data) return null;
  const mine = list.data.value.filter((p) => p.marketId === marketId);

  if (mine.length > 0) {
    return (
      <span className="type-caption text-ink-secondary" title={PUBLISH.scope}>
        <span aria-hidden className="mr-1 text-accent">
          ✓
        </span>
        {PUBLISH.published}{" "}
        <button type="button" className="type-caption text-accent underline" disabled={retract.isPending} onClick={() => retract.mutate({ marketId })} data-cursor="hover">
          {retract.isPending ? PUBLISH.retracting : PUBLISH.retract}
        </button>
      </span>
    );
  }
  if (source === "receipt" && !list.data.receipts) return <span className="type-caption text-ink-muted">{PUBLISH.settledUnpublished}</span>;

  const go = () => {
    setNote(null);
    publish.mutate(
      { marketId, source },
      {
        onSuccess: (r) => r.kind === "refused" && setNote(PUBLISH.refused[r.code]),
        onError: () => setNote(PUBLISH.failed),
      },
    );
  };
  return (
    <>
      <button type="button" className="type-caption text-accent underline" title={PUBLISH.explain} disabled={publish.isPending} onClick={go} data-cursor="hover">
        {publish.isPending ? PUBLISH.publishing : PUBLISH.publish}
      </button>
      {note && (
        <span className="type-caption basis-full text-left text-warning sm:text-right" role="status">
          {note}
        </span>
      )}
    </>
  );
}
