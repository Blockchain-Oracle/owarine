"use client";

import { Eye } from "lucide-react";
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
  return (
    <Tooltip defaultOpen={defaultOpen}>
      <TooltipTrigger className="cx-seen" aria-label={C.aria(holder)}>
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
