"use client";

import { ArrowLeft, ArrowRight, ExternalLink, NotebookPen } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import OwarineMark from "@/components/shell/OwarineMark";

const SLIDES = [
  {
    id: "watch",
    label: "START HERE",
    notes: "If you haven't watched our demo video, I'd urge you to watch that first. It shows what Owarine does today. This short pitch is about why we built it and where we're taking it next.",
  },
  {
    id: "problem",
    label: "THE PROBLEM",
    notes: "On a public market, a trader's position can be visible as soon as they place it. That makes it easier to track or copy them. We think people should be able to make a call without publishing their entire trading history.",
  },
  {
    id: "today",
    label: "BUILT TODAY",
    notes: "Owarine is running on Canton DevNet with test funds. You can take an Up or Down position at a firm quote, follow the result, and inspect the settlement proof. Canton lets us keep a position visible to the trader and the venue while enforcing the market rules through Daml.",
  },
  {
    id: "users",
    label: "WHO COMES FIRST",
    notes: "We're starting with people who care about privacy, clear execution, and being able to verify an outcome. Our next step is to put Owarine in their hands, watch where the experience falls short, and improve it with their feedback.",
  },
  {
    id: "next",
    label: "AFTER THE HACKATHON",
    notes: "We're building Owarine to last beyond this hackathon. The native mobile app is already in development, and TestNet is our next network milestone. We'll keep working on the trading experience, wallet access, and reliability as we move toward a wider launch. The demo is our starting point, not the end of the project. We'd love the chance to keep building Owarine with the Canton ecosystem.",
  },
] as const;

function SlideContent({ id }: { id: (typeof SLIDES)[number]["id"] }) {
  switch (id) {
    case "watch":
      return (
        <div className="pitch-layout pitch-layout--media">
          <div className="pitch-copy">
            <span className="pitch-kicker">OWARINE · THE NEXT CHAPTER</span>
            <h1 className="pitch-title">Watch the demo first.</h1>
            <p className="pitch-lede">Then let me show you where we take Owarine next.</p>
            <Link className="pitch-cta" href="/demo">Open the demo <ExternalLink aria-hidden size={20} /></Link>
          </div>
          <div className="pitch-visual pitch-visual--cover">
            <Image src="/demo/cover.png" alt="Owarine product walkthrough cover with the trading screen" width={1672} height={941} priority />
          </div>
        </div>
      );
    case "problem":
      return (
        <div className="pitch-layout pitch-layout--media">
          <div className="pitch-copy">
            <span className="pitch-kicker">THE PROBLEM</span>
            <h1 className="pitch-title">Your position should be yours.</h1>
            <p className="pitch-lede">Public positions can be tracked and copied. A prediction should not publish your trading history.</p>
          </div>
          <div className="pitch-visual pitch-visual--privacy">
            <Image src="/demo/outsider-canton.jpg" alt="Owarine privacy explainer showing positions visible to the trader and venue" width={1256} height={600} />
          </div>
        </div>
      );
    case "today":
      return (
        <div className="pitch-layout pitch-layout--media">
          <div className="pitch-copy">
            <span className="pitch-kicker">BUILT TODAY</span>
            <h1 className="pitch-title">Running on Canton DevNet.</h1>
            <ul className="pitch-list">
              <li>Firm Up / Down quotes</li>
              <li>Private position contracts</li>
              <li>Oracle results and settlement proof</li>
            </ul>
            <p className="pitch-small">DevNet prototype · test funds</p>
          </div>
          <div className="pitch-visual pitch-visual--proof">
            <Image src="/pitch/proof-timeline-devnet-2026-10-08.png" alt="Owarine DevNet print and resolution proof, captured 8 October 2026" width={3200} height={2000} />
          </div>
        </div>
      );
    case "users":
      return (
        <div className="pitch-layout pitch-layout--stack">
          <div className="pitch-copy pitch-copy--wide">
            <span className="pitch-kicker">WHO COMES FIRST</span>
            <h1 className="pitch-title">Start with traders who care about privacy.</h1>
            <p className="pitch-lede">Meet them through direct demos, hands-on trials, and the Canton community.</p>
          </div>
          <div className="pitch-audience" aria-label="First audiences and route to feedback">
            <div><span>01 / USERS</span><strong>Traders</strong><p>Private positions and clear execution.</p></div>
            <div><span>02 / PEERS</span><strong>Canton builders</strong><p>Challenge the privacy and trust model.</p></div>
            <div><span>03 / LEARNING</span><strong>Hands-on trials</strong><p>Improve the product from real use.</p></div>
          </div>
        </div>
      );
    case "next":
      return (
        <div className="pitch-layout pitch-layout--roadmap">
          <div className="pitch-copy pitch-copy--wide">
            <span className="pitch-kicker">AFTER THE HACKATHON</span>
            <h1 className="pitch-title">DevNet today.<br />TestNet next.</h1>
            <p className="pitch-lede">The native mobile app is in development. Next: user testing, wallet access, and a more reliable trading experience.</p>
            <strong className="pitch-closing">We are building beyond the hackathon.</strong>
          </div>
          <OwarineMark className="pitch-giant-seal" />
        </div>
      );
  }
}

/** A five-slide folio for the recorded pitch; the demo remains its own product walkthrough. */
export function PitchDeck() {
  const [index, setIndex] = useState(0);
  const [notesOpen, setNotesOpen] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const total = SLIDES.length;
  const go = useCallback((next: number) => setIndex(Math.max(0, Math.min(total - 1, next))), [total]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && target.closest("input, textarea, select, [contenteditable]")) return;
      if (["ArrowRight", "ArrowDown", " ", "PageDown"].includes(event.key)) {
        event.preventDefault();
        setIndex((current) => Math.min(total - 1, current + 1));
      } else if (["ArrowLeft", "ArrowUp", "PageUp"].includes(event.key)) {
        event.preventDefault();
        setIndex((current) => Math.max(0, current - 1));
      } else if (event.key === "Home") go(0);
      else if (event.key === "End") go(total - 1);
      else if (event.key.toLowerCase() === "n") setNotesOpen((open) => !open);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, total]);

  useEffect(() => {
    stageRef.current?.scrollTo({ top: 0 });
  }, [index]);
  const slide = SLIDES[index]!;

  return (
    <main className="pitch-deck" aria-label="Owarine pitch">
      <div className="pitch-frame">
        <header className="pitch-head">
          <Link href="/" className="pitch-brand" aria-label="Owarine home"><OwarineMark /><span>OWARINE</span></Link>
          <span className="pitch-folio">[ {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")} ] · {slide.label}</span>
        </header>

        <div ref={stageRef} className="pitch-stage" aria-live="polite" aria-atomic="true">
          <article key={slide.id} className="pitch-slide" aria-label={`Slide ${index + 1} of ${total}: ${slide.label}`}>
            <SlideContent id={slide.id} />
          </article>
        </div>

        {notesOpen ? <aside id="pitch-notes" className="pitch-notes" aria-label="Recording notes"><strong>RECORDING NOTES</strong><p>{slide.notes}</p></aside> : null}

        <footer className="pitch-foot">
          <button type="button" className="pitch-notes-toggle" onClick={() => setNotesOpen((open) => !open)} aria-expanded={notesOpen} aria-controls="pitch-notes" title="Toggle recording notes (N)"><NotebookPen size={18} aria-hidden /> <span>Notes</span></button>
          <nav className="pitch-dots" aria-label="Slides">
            {SLIDES.map((item, dot) => <button type="button" key={item.id} onClick={() => go(dot)} className="pitch-dot" aria-label={`Go to slide ${dot + 1}: ${item.label}`} aria-current={dot === index ? "step" : undefined} />)}
          </nav>
          <div className="pitch-arrows">
            <button type="button" onClick={() => go(index - 1)} disabled={index === 0} aria-label="Previous slide"><ArrowLeft size={20} aria-hidden /></button>
            <button type="button" onClick={() => go(index + 1)} disabled={index === total - 1} aria-label="Next slide"><ArrowRight size={20} aria-hidden /></button>
          </div>
        </footer>
      </div>
    </main>
  );
}
