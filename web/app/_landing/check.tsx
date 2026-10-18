import type { ReactNode } from 'react';
import { Icon } from './screens';

// A paper check, the money ritual older adults trust. Sized in em: set the font size with `className`.

/** The wavy security print on a check. Plain geometry: rows of the same sine wave. */
export function Guilloche({ className = '' }: { className?: string }) {
  const rows = Array.from({ length: 12 }, (_, i) => 20 + i * 22);
  const wave = (y: number, shift: number) =>
    `M${-shift},${y} ` + Array.from({ length: 14 }, (_, k) => `${k === 0 ? `Q${25 - shift},${y - 52} ${50 - shift},${y}` : `T${50 * (k + 1) - shift},${y}`}`).join(' ');
  return (
    <svg viewBox="0 0 600 280" preserveAspectRatio="none" aria-hidden="true" className={`pointer-events-none absolute inset-0 size-full fill-none stroke-action/15 [stroke-width:0.7] ${className}`}>
      {rows.map((y, i) => <path key={y} d={wave(y, (i % 4) * 9)} />)}
    </svg>
  );
}

const label = 'block text-[0.75em] font-bold tracking-[0.07em] text-muted uppercase';

function Field({ name, children, after }: { name?: string; children: ReactNode; after?: ReactNode }) {
  return (
    <div className="mt-[1.1em] flex items-end gap-[0.8em]">
      {name && <span className={`${label} pb-[0.45em] whitespace-nowrap`}>{name}</span>}
      <span className="flex-1 border-b-[1.5px] border-rule px-[0.3em] text-[1.35em] leading-[1.45]">{children}</span>
      {after}
    </div>
  );
}

function Signature({ who, signed }: { who: string; signed?: string }) {
  return (
    <div className="border-t-[1.5px] border-rule pt-[0.35em]">
      <i className="mb-[0.15em] block min-h-[1em] text-[1.9em] leading-none text-link">{signed}</i>
      <span className={label}>{who}</span>
    </div>
  );
}

/** The hero: a $500 gift card check, signed by the older adult, stamped Paused until the family signs too. */
export function PausedCheck({ className = 'text-[8px]' }: { className?: string }) {
  return (
    <div
      role="img"
      aria-label="A $500.00 check to Gift card store, memo: paid on a call. Your parent signed it. The family line is empty. Stamped: Paused, waiting for family."
      className={`relative h-[29em] w-[40em] max-w-full ${className}`}
    >
      <div className="absolute top-[2.6em] left-[1.5em] h-[21.5em] w-[38.5em] rotate-2 overflow-hidden rounded-[0.5em] bg-card shadow-[0_0.2em_0.4em_rgb(30_10_50/0.06)]">
        <Guilloche />
      </div>
      <div className="absolute top-[4.5em] left-0 h-[21.5em] w-[38.5em] -rotate-3 overflow-hidden rounded-[0.5em] bg-card px-[2.2em] py-[1.6em] text-foreground shadow-[0_0.2em_0.4em_rgb(30_10_50/0.08),0_2.6em_4em_-1.6em_rgb(60_20_100/0.4)]">
        <Guilloche />
        <div className="relative">
          <div className="flex items-start justify-between">
            <div>
              <b className="text-[1.25em]">Your parent</b>
              <span className={label}>Spending account</span>
            </div>
            <div className="text-right">
              <span className={label}>No. 0412</span>
              <span className={`${label} tabular-nums`}>Oct 17, 2026</span>
            </div>
          </div>
          <Field name="Pay to the order of" after={<span className="rounded-[0.3em] border-[1.5px] border-rule bg-card px-[0.6em] py-[0.15em] text-[1.5em] leading-[1.3] font-extrabold tabular-nums">$500.00</span>}>
            Gift card store
          </Field>
          <Field after={<span className={`${label} pb-[0.45em]`}>Dollars</span>}>Five hundred and 00/100</Field>
          <div className="mt-[1.4em] grid grid-cols-[1.3fr_1fr_1fr] items-end gap-[1.6em]">
            <Field name="Memo"><span className="text-[0.8em]">Paid on a call</span></Field>
            <Signature who="Your parent" signed="Yes, pay" />
            <Signature who="Family" />
          </div>
        </div>
        <div className="absolute right-[1.6em] bottom-[1.1em] flex -rotate-6 items-center gap-[0.55em] rounded-[0.6em] border-[0.2em] border-current bg-card/80 px-[0.9em] py-[0.5em] text-[1em] leading-[1.15] font-extrabold tracking-[0.04em] text-pause uppercase">
          <Icon name="pause" className="size-[1.8em]" />
          <span className="text-[1.15em]">Paused<br />waiting for family</span>
        </div>
      </div>
    </div>
  );
}
