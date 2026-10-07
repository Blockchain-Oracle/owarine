"use client";

import { useEffect, useState } from "react";
import { AddFunds, CreditWelcome, OPEN_FUNDS_EVENT } from "@/features/funding";

/** What the old header mounted for every page: the credit welcome and Add funds, opened from anywhere by event. */
export function ShellOverlays() {
  const [funds, setFunds] = useState(false);
  useEffect(() => {
    const open = () => setFunds(true);
    window.addEventListener(OPEN_FUNDS_EVENT, open);
    return () => window.removeEventListener(OPEN_FUNDS_EVENT, open);
  }, []);
  return (
    <>
      <CreditWelcome />
      <AddFunds open={funds} onClose={() => setFunds(false)} />
    </>
  );
}
