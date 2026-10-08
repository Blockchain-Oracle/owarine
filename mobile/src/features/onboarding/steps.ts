import { networkLabel } from "@owarine/markets/chain";
import { TOUR_STEPS, tourNetworkNote } from "@/features/terminal/ui/sheets/tour-copy";

/**
 * The phone's first-run cards: web's five-step tour (`terminal/ui/sheets/tour-copy.ts`, the one onboarding since
 * K-405), then one closing card that ends on taking a seat. The web file this used to import was deleted with the old
 * /markets tutorial; the tour's words are now the single source.
 */
export interface TutorialStep {
  readonly title: string;
  readonly description: string;
  /** The closing screen: take a seat. Never auto-advances. */
  readonly choice?: true;
}

export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  ...TOUR_STEPS.map((step) => ({ title: step.title, description: step.body })),
  {
    title: "Your seat",
    get description() {
      return tourNetworkNote();
    },
    choice: true,
  },
];

export const TUTORIAL_UI = {
  close: "Close",
  skip: "Skip",
  next: "Next",
  done: "Get started",
  lastStep: "Last step",
  connectTitle: "Take a seat to start trading",
  get connectNote(): string {
    return `No wallet app needed. ${networkLabel()}, so these are demo credits — and every call is yours alone to place.`;
  },
  progress: (step: number, total: number) => `Step ${step} of ${total}`,
} as const;
