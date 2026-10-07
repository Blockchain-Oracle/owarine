import { ADVICE_COPY } from "@owarine/core/copy";
import type { Metadata } from "next";
import { AgentsScreen } from "@/features/strategies";

export const metadata: Metadata = { title: "Agents" };

export default function Page() {
  return (
    <>
      <AgentsScreen />
      <p className="container pb-10 type-caption text-ink-muted">{ADVICE_COPY.notAdvice}</p>
    </>
  );
}
