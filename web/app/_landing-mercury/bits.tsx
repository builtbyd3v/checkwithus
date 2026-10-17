type ClassProps = { className?: string };

export function Dot({ className = '' }: ClassProps) {
  return <span aria-hidden className={`inline-block size-2 shrink-0 rounded-full ${className}`} />;
}

/** The app's icon in notifications: the wordmark's first letters on the action colour. */
export function AppMark() {
  return (
    <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-[11px] bg-m-indigo text-[15px] font-[560] tracking-[-0.02em] text-white">
      cw
    </span>
  );
}

export function Wordmark({ className = '' }: ClassProps) {
  return (
    <span className={`font-[520] tracking-[-0.015em] ${className}`}>
      checkwith<span className="text-m-periwinkle">.us</span>
    </span>
  );
}
