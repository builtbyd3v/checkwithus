/** The brand mark: yellow for the older adult, purple for the family. */
export function Logo({ className }: { className?: string }) {
  return <svg viewBox="0 0 100 100" aria-hidden="true" className={className}>
    <circle cx="20" cy="44" r="9.5" fill="#FBC02D" /><path d="M18 63 L42 93" stroke="#FBC02D" strokeWidth="17" />
    <circle cx="18" cy="63" r="8.5" fill="#FBC02D" /><circle cx="78" cy="14" r="10.5" fill="#A62FEA" />
    <path d="M84 37 L52 81" stroke="#A62FEA" strokeWidth="21" /><circle cx="84" cy="37" r="10.5" fill="#A62FEA" />
  </svg>;
}
