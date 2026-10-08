// Existing Sandbee website vector, adapted for the Store's monochrome UI.
// Source: sandbee.in/website/src/components/site/brand-mark.tsx.
export function BrandMark({ className = "" }) {
  return (
    <svg
      className={`brand-mark ${className}`}
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
      fill="currentColor"
    >
      <path
        className="brand-wings"
        d="M4 7L25 21L28 30L25 32L4 17ZM4 22L23 35L18 38L4 29ZM60 7L39 21L36 30L39 32L60 17ZM60 22L41 35L46 38L60 29ZM32 27L34 30H30Z"
      />
      <path
        className="brand-body"
        d="M20 41L32 33L44 41V47L32 39L20 47ZM20 50L32 42L44 50V56L32 48L20 56ZM24 57L32 51L40 57L32 64Z"
      />
    </svg>
  );
}
export function BrandLoader({
  label = "Opening your workspace",
  compact = false,
}) {
  return (
    <div
      className={`brand-loader ${compact ? "compact" : ""}`}
      role="status"
      aria-live="polite"
    >
      <div className="brand-loader-mark">
        <BrandMark />
      </div>
      <span>{label}</span>
      <span className="brand-loader-track" aria-hidden="true">
        <i />
      </span>
    </div>
  );
}
