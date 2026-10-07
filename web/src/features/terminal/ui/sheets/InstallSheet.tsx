"use client";

import { CircleCheck } from "lucide-react";
import { Seal, Sheet } from "@/components/kit";
import { useInstallPrompt } from "@/features/install/useInstallPrompt";
import { haptic } from "@/lib/haptics";
import { playTrade } from "@/lib/sound/trade";
import { toast } from "../../toasts";

const tap = () => (playTrade("tap"), haptic("tap"));

/** Tradash's `InstallSheet` words, on Owarine. */
const IOS = ["Tap the Share button in Safari's toolbar.", "Choose “Add to Home Screen”.", "Tap “Add” — Owarine lands on your home screen."];
const ANDROID = ["Open your browser menu (⋮).", "Choose “Install app” or “Add to Home screen”.", "Confirm — Owarine installs like a native app."];

function Steps({ steps }: { steps: readonly string[] }) {
  return (
    <ol className="flex flex-col gap-2">
      {steps.map((s, i) => (
        <li key={s} className="flex items-center gap-3 rounded-ow-card bg-ow-recessed/60 px-3 py-3">
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-ow-ink text-ow-caption font-bold text-ow-inverse">{i + 1}</span>
          <span className="text-ow-body">{s}</span>
        </li>
      ))}
    </ol>
  );
}

/**
 * Install app: the browser's own install sheet where it offers one (Chromium's held prompt), else the steps for this
 * phone — iOS has no install event, so Safari's Share → Add to Home Screen — and "Already installed" when it is.
 */
export function InstallSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, install, busy } = useInstallPrompt();

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title="Install app">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Seal size={52} />
          <div>
            <p className="text-ow-title font-bold">Install Owarine</p>
            <p className="text-ow-caption text-ow-muted">Add it to your home screen for a full-screen, app-like experience.</p>
          </div>
        </div>
        {state === "installed" ? (
          <p className="flex items-center justify-center gap-2 rounded-ow-card bg-ow-recessed/60 py-4 text-ow-body font-semibold">
            <CircleCheck className="size-5 text-ow-up" /> Already installed
          </p>
        ) : state === "prompt" ? (
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              tap();
              const choice = await install();
              if (choice === "accepted") {
                toast({ kind: "success", title: "Owarine installed", description: "Open it from your home screen." });
                onClose();
              }
            }}
            className="h-12 rounded-full bg-ow-ink font-bold text-ow-inverse disabled:opacity-50"
          >
            {busy ? "Opening…" : "Install"}
          </button>
        ) : (
          /* Android and desktop Chromium keep Install under the browser menu when they hold no prompt. */
          <Steps steps={state === "ios" ? IOS : ANDROID} />
        )}
      </div>
    </Sheet>
  );
}
