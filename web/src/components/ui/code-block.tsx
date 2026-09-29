"use client";

/**
 * Code Block — adapted from the 21st.dev catalogue: component #23586 "Code Block" (registry item kvnkld/code-block,
 * author kvnkld, 21st user user_registry_kvnkld_1785470431824), pulled with `21st get 23586` on 2026-09-29. The
 * registry payload declares no licence; it is a public 21st.dev registry item (isPublic: true).
 *
 * What changed from the source: its class strings became `code-block.css` in the reference tokens; the header names a
 * file (or endpoint) instead of a language; the icons are lucide (which the reference ships); the copy timer is
 * cleared on unmount; the body is a focusable, labelled scroll region so a keyboard can reach a long line; and any
 * value listed in `hashes` (party ids, update ids) renders through the reference's `Hash`, shortened with the full
 * value on hover, while Copy still copies the literal text.
 */
import { Check, Code2, Copy } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Hash } from "@/components/data/Hash";
import { cn } from "@/lib/utils";
import "./code-block.css";

const COPIED_MS = 1_200;

export interface CodeBlockHash {
  value: string;
  /** Characters kept at the front; a party id keeps its readable hint (`alice::1220`). */
  lead?: number;
  tail?: number;
}

interface CodeBlockProps {
  /** The header: a file name, or the request line (`POST /v2/state/active-contracts-page`). */
  filename: string;
  code: string;
  /** Long ids to shorten on screen; matched literally inside each line. */
  hashes?: readonly CodeBlockHash[];
  /** The scroll region's accessible name. */
  label: string;
  className?: string;
}

function renderLine(line: string, hashes: readonly CodeBlockHash[]): ReactNode {
  if (line.length === 0) return " ";
  const hit = hashes.find((h) => line.includes(h.value));
  if (!hit) return line;
  const at = line.indexOf(hit.value);
  return (
    <>
      {line.slice(0, at)}
      <Hash value={hit.value} lead={hit.lead} tail={hit.tail} className="cb-hash" />
      {renderLine(line.slice(at + hit.value.length), hashes)}
    </>
  );
}

export function CodeBlock({ filename, code, hashes = [], label, className }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const lines = code.split("\n");

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = () => {
    void navigator.clipboard?.writeText(code).then(() => setCopied(true), () => undefined);
  };

  return (
    <figure className={cn("cb", className)}>
      <figcaption className="cb-head">
        <span className="cb-file">
          <Code2 className="cb-icon" aria-hidden />
          <span className="cb-name">{filename}</span>
        </span>
        <button type="button" className="cb-copy" onClick={copy} aria-label={copied ? "Copied" : "Copy code"}>
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
          <span aria-hidden>{copied ? "Copied" : "Copy"}</span>
        </button>
        <span className="sr-only" aria-live="polite">
          {copied ? "Copied to the clipboard" : ""}
        </span>
      </figcaption>
      {/* A scroll region: focusable so a keyboard can scroll a long line into view. */}
      <div className="cb-body" role="region" aria-label={label} tabIndex={0}>
        {lines.map((line, i) => (
          <div className="cb-row" key={i}>
            <span className="cb-ln" aria-hidden>
              {i + 1}
            </span>
            <code className="cb-code">{renderLine(line, hashes)}</code>
          </div>
        ))}
      </div>
    </figure>
  );
}
