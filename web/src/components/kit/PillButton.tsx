import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * UGLYCASH's buttons: always a pill, never a shadow. Black is the default action, Power Pink is THE action on a screen
 * (one per view: Trade, Confirm, Start trading), white sits on the canvas, ghost sits on a card. Labels are bold Inter,
 * ≥17px on the large size so white-on-pink keeps its contrast as large text. Pressing sinks the pill slightly.
 */
export const pillButtonVariants = cva(
  "inline-flex shrink-0 select-none items-center justify-center gap-2 rounded-full font-ow-body font-bold tracking-[-0.02em] whitespace-nowrap outline-none transition-[background-color,color,transform,opacity] duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ow-pink-ink [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      tone: {
        black: "bg-ow-ink text-ow-inverse hover:opacity-90",
        pink: "bg-ow-pink text-ow-on-pink hover:bg-ow-pink-pressed",
        white: "bg-ow-card text-ow-ink hover:bg-ow-recessed",
        ghost: "bg-ow-recessed text-ow-ink hover:bg-ow-hairline",
        up: "bg-ow-up-line text-ow-white hover:opacity-90",
        down: "bg-ow-down-line text-ow-white hover:opacity-90",
      },
      size: {
        sm: "h-9 px-4 text-ow-label [&_svg]:size-4",
        md: "h-12 px-5 text-ow-lead [&_svg]:size-4.5",
        lg: "h-14 px-7 text-ow-cta [&_svg]:size-5",
        icon: "size-12 [&_svg]:size-5",
      },
      block: { true: "w-full min-w-0 flex-1 shrink", false: "" },
    },
    defaultVariants: { tone: "black", size: "md", block: false },
  },
);

export type PillButtonProps = ButtonPrimitive.Props & VariantProps<typeof pillButtonVariants>;

export function PillButton({ className, tone, size, block, nativeButton, ...props }: PillButtonProps) {
  return (
    <ButtonPrimitive
      data-slot="pill-button"
      nativeButton={nativeButton ?? props.render === undefined}
      className={cn(pillButtonVariants({ tone, size, block }), className)}
      {...props}
    />
  );
}
