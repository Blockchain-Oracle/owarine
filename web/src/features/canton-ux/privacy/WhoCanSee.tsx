"use client";

import { Eye } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { LogoStack } from "@/components/ui/desk-kit";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PRIVACY, type SeenKind } from "./copy";
import "./privacy.css";

const C = PRIVACY.chip;

interface WhoCanSeeProps {
  kind: SeenKind;
  /** The other stakeholder beside the venue: "You" in the app, a demo party's name in the view switcher. */
  holder?: string;
  /** Fixtures only: open on first paint so the details can be seen without hovering. */
  defaultOpen?: boolean;
}

/**
 * "Who can see this" (C-ADD-01): the reference's `badge` inside the reference's `tooltip`, the two stakeholders drawn
 * with the desk kit's `LogoStack` (21st #28355 as the reference adapted it). A Canton contract is disclosed to its
 * stakeholders only, so the chip names exactly two, and the tooltip says what each one is to the contract.
 */
export function WhoCanSee({ kind, holder = "You", defaultOpen }: WhoCanSeeProps) {
  // A tooltip opens on hover and keyboard focus, and neither happens on a tap: on a touch screen the chip explained nothing.
  // So a touch tap toggles it (and a touch anywhere else closes it); the mouse and the keyboard keep the tooltip's own behaviour.
  const [open, setOpen] = useState(defaultOpen ?? false);
  const byTouch = useRef(false);
  useEffect(() => {
    if (!open || !byTouch.current) return;
    const away = (event: PointerEvent) => {
      if (event.target instanceof Element && event.target.closest(".cx-seen, .cx-seen-tip")) return;
      byTouch.current = false;
      setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);
  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger
        className="cx-seen"
        aria-label={C.aria(holder)}
        closeOnClick={false}
        onClick={(event) => {
          if ((event.nativeEvent as PointerEvent).pointerType !== "touch") return;
          byTouch.current = !open;
          setOpen(!open);
        }}
      >
        <Badge variant="outline" className="cx-seen-badge">
          <LogoStack symbols={[holder, "Venue"]} names={[holder, C.venue]} size="sm" />
          <span className="cx-seen-text">{C.short(holder)}</span>
          <Eye className="cx-seen-eye" aria-hidden />
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="cx-seen-tip">
        <span className="cx-seen-tip-title">{C.label}</span>
        <span className="cx-seen-tip-row">
          <strong>{holder}</strong> {C.holderRole[kind]}
        </span>
        <span className="cx-seen-tip-row">
          <strong>{C.venue}</strong> {C.venueRole}
        </span>
        <span className="cx-seen-tip-foot">{C.foot[kind]}</span>
      </TooltipContent>
    </Tooltip>
  );
}
