// The 終値 hanko: Owarine's mark (8 Oct). Until today this component drew Agari's "Window Cut" logo, carried over by
// the rename; every surface that shows the brand mark (the Sensei dock, /download, the pitch, the claim receipt) now
// shows the seal, the same one the kit's `Seal` draws, flat (no ink filter) so it stays crisp at small sizes.

export default function OwarineMark({
  className,
  figure = "currentColor",
  accent,
  title,
}: {
  className?: string;
  /** Colour of the seal. Defaults to currentColor so it follows the theme. */
  figure?: string;
  /** Kept for callers of the old two-colour mark; the seal is one colour, so `accent` (when given) wins. */
  accent?: string;
  /** Accessible name; when omitted the mark is decorative. */
  title?: string;
}) {
  const colour = accent ?? figure;
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      xmlns="http://www.w3.org/2000/svg"
      style={{ color: colour }}
    >
      {title ? <title>{title}</title> : null}
      <rect x="6" y="6" width="88" height="88" rx="16" fill="none" stroke="currentColor" strokeWidth="7" />
      <text x="50" y="47" textAnchor="middle" fill="currentColor" fontSize="38" fontWeight={900} style={{ fontFamily: "var(--font-noto-sans-jp), 'Noto Sans JP', sans-serif" }}>
        終
      </text>
      <text x="50" y="84" textAnchor="middle" fill="currentColor" fontSize="38" fontWeight={900} style={{ fontFamily: "var(--font-noto-sans-jp), 'Noto Sans JP', sans-serif" }}>
        値
      </text>
    </svg>
  );
}
