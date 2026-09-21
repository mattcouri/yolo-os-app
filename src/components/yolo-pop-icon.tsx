export function YoloPopIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 20" className={className} aria-hidden>
      <rect x="2.5" y="0.75" width="11" height="18.5" rx="2.2" fill="currentColor" />
      <text
        x="8"
        y="12.2"
        textAnchor="middle"
        fill="#fff"
        fontSize="4.2"
        fontWeight="800"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        letterSpacing="-0.15"
      >
        YOLO
      </text>
    </svg>
  );
}
