"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

/** Throws during render once pressed, so `app/error.tsx` catches it the way it would catch any component's failure. */
export function BoundaryProbe() {
  const [armed, setArmed] = useState(false);
  if (armed) throw new Error("C5d boundary probe: thrown on purpose while the browser rendered /dev/boundary");
  return (
    <Button type="button" variant="outline" onClick={() => setArmed(true)}>
      Throw in render
    </Button>
  );
}
