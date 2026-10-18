import type { ReactNode } from 'react';
import { Icon } from './screens';

// A paper check, the money ritual older adults trust. It fills its container: 1em = 1/48 of the width.
// It is a physical object, so it keeps its paper colours in dark mode.

/** The wavy security print on a check. Plain geometry: rows of the same sine wave. */
function Guilloche() {
  const rows = Array.from({ length: 12 }, (_, i) => 20 + i * 22);
  const wave = (y: number, shift: number) =>
    `M${-shift},${y} ` + Array.from({ length: 14 }, (_, k) => `${k === 0 ? `Q${25 - shift},${y - 52} ${50 - shift},${y}` : `T${50 * (k + 1) - shift},${y}`}`).join(' ');
  return (
    <svg viewBox="0 0 600 280" preserveAspectRatio="none" aria-hidden="true" className="pointer-events-none absolute inset-0 size-full fill-none stroke-action/10 [stroke-width:0.7]">
      {rows.map((y, i) => <path key={y} d={wave(y, (i % 4) * 9)} />)}
    </svg>
  );
}

const label = 'block text-[0.8em] leading-tight text-paper-muted';
const pen = 'text-pen italic';

function Line({ name, children, after }: { name?: string; children?: ReactNode; after?: ReactNode }) {
  return (
    <div className="flex items-end gap-[0.8em]">
      {name && <span className={`${label} pb-[0.5em] whitespace-nowrap`}>{name}</span>}
      <span className={`min-h-[1.6em] flex-1 border-b-[0.09em] border-paper-line px-[0.3em] text-[1.35em] leading-[1.45] ${pen}`}>{children}</span>
      {after}
    </div>
  );
}

/** A hand signature: one pen stroke that writes itself on load. */
function Scribble() {
  return (
    <svg viewBox="0 0 140 44" aria-hidden="true" className="h-[2.4em] w-auto overflow-visible fill-none stroke-pen [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:2.2]">
      <path
        pathLength={1}
        strokeDasharray="1"
        className="motion-safe:animate-sign motion-safe:[animation-delay:700ms]"
        d="M4 32c6-14 12-24 16-22s-4 26 0 26 8-20 13-19-2 15 2 15 7-12 11-11 0 9 4 9 6-14 10-13-3 13 1 13c5 0 9-15 14-24s6-10 4 2-4 28 0 22 9-14 13-12 2 9 6 8 10-5 16-6 12 2 20-1"
      />
    </svg>
  );
}

/** The hero: a $500 gift card check, signed by the older adult, stamped Paused until the family signs too. */
export function PausedCheck({ className = '' }: { className?: string }) {
  return (
    <div
      data-ui
      role="img"
      aria-label="A $500.00 check to Gift card store, memo: paid on a call. Your parent signed it. The family line is empty, with a Sign here flag. Stamped: Paused, waiting for family."
      className={`@container w-full ${className}`}
    >
      <div className="relative h-[26em] text-[2.08cqi] text-paper-ink">
        {/* The next check in the book, peeking out behind. */}
        <div className="absolute top-[1.4em] left-[1.6em] h-[20.5em] w-[45.5em] rotate-[1.6deg] rounded-paper bg-paper-back bg-(image:--paper-grain) shadow-object" />

        <div className="absolute top-[2.6em] left-[0.8em] grid h-[20.5em] w-[45.5em] -rotate-2 grid-cols-[9.5em_0.9em_1fr] overflow-hidden rounded-paper bg-paper bg-(image:--paper-grain) shadow-object motion-safe:animate-settle">
          {/* The stub: the family's own record of the payment. */}
          <div className="flex flex-col gap-[0.9em] bg-paper-back/60 px-[1.2em] py-[1.4em] text-[0.95em]">
            <span><b className="block tabular-nums">No. 0412</b><span className={`${label} tabular-nums`}>Oct 17, 2026</span></span>
            <span><span className={label}>To</span><span className={pen}>Gift card store</span></span>
            <span><span className={label}>For</span><span className={pen}>Paid on a call</span></span>
            <span className="mt-auto"><span className={label}>Amount</span><b className="text-[1.5em] tabular-nums">$500.00</b></span>
          </div>

          {/* Perforation: the line the check tears along. */}
          <svg aria-hidden="true" className="h-full w-full fill-paper-line/70">
            <defs>
              <pattern id="perforation" width="100%" height="12" patternUnits="userSpaceOnUse">
                <circle cx="50%" cy="6" r="2" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#perforation)" />
          </svg>

          <div className="relative flex flex-col px-[1.8em] py-[1.4em]">
            <Guilloche />
            <div className="relative flex items-start justify-between">
              <div>
                <b className="text-[1.3em]">Your parent</b>
                <span className={label}>Spending account</span>
              </div>
              <div className="text-right">
                <span className={label}>No. 0412</span>
                <span className="text-[0.95em] tabular-nums">Oct 17, 2026</span>
              </div>
            </div>
            <div className="relative mt-[1.6em]">
              <Line
                name="Pay to the order of"
                after={<span className="rounded-paper bg-paper px-[0.6em] py-[0.15em] text-[1.5em] leading-[1.3] font-extrabold tabular-nums ring-[0.09em] ring-paper-line">$500.00</span>}
              >
                Gift card store
              </Line>
              <div className="mt-[0.8em]">
                <Line after={<span className={`${label} pb-[0.5em]`}>Dollars</span>}>Five hundred and 00/100</Line>
              </div>
            </div>
            <div className="relative mt-auto grid grid-cols-[1.3fr_1fr_1fr] items-end gap-[1.4em]">
              <Line name="Memo"><span className="text-[0.8em] whitespace-nowrap">Paid on a call</span></Line>
              <div>
                <div className="flex h-[2.6em] items-end border-b-[0.09em] border-paper-line"><Scribble /></div>
                <span className={`${label} pt-[0.3em]`}>Your parent</span>
              </div>
              <div className="relative">
                <div className="h-[2.6em] border-b-[0.09em] border-paper-line" />
                <span className={`${label} pt-[0.3em]`}>Family</span>
                {/* The sign-here flag, as on a contract. */}
                <span className="absolute -top-[1.7em] -right-[0.6em] flex items-center bg-action py-[0.3em] pr-[0.7em] pl-[1.1em] text-[0.85em] font-bold whitespace-nowrap text-white [clip-path:polygon(0.7em_0,100%_0,100%_100%,0.7em_100%,0_50%)] motion-safe:animate-rise motion-safe:[animation-delay:1900ms]">
                  Sign here
                </span>
              </div>
            </div>

            <div className="absolute top-[11em] left-[22%] flex -rotate-[7deg] items-center gap-[0.55em] rounded-[0.5em] border-[0.3em] border-double border-stamp px-[0.9em] py-[0.45em] leading-[1.05] font-extrabold tracking-[0.05em] text-stamp uppercase [mask-image:var(--stamp-wear)] motion-safe:animate-stamp motion-safe:[animation-delay:1500ms]">
              <Icon name="pause" className="size-[2em] [stroke-width:2.6]" />
              <span className="text-[1.2em]">Paused<br /><span className="text-[0.8em] tracking-[0.08em]">waiting for family</span></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
