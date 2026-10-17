'use client';

import { useEffect, useRef, useState } from 'react';
import { formatCents, toCents, type Cents } from '@/lib/money';

// ponytail: sample balances in the browser, no Nessie call. The real Freeze is a Nessie transfer from the dashboard.
const SPENDING = toCents(248_000);
const VAULT = toCents(1_820_000);
const TOTAL = toCents(SPENDING + VAULT);

/** Counts a cent amount toward its target on animation frames. Whole cents only. */
function useCountTo(target: Cents): Cents {
  const [shown, setShown] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const start = from.current;
    if (start === target) return;
    // Reduced motion: a zero duration lands on the target in the first frame.
    const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1100;
    const began = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = duration === 0 ? 1 : Math.min(1, (now - began) / duration);
      const eased = 1 - (1 - t) ** 4;
      const next = toCents(Math.round(start + (target - start) * eased));
      from.current = next;
      setShown(next);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);
  return shown;
}

export function FreezeCard() {
  const [frozen, setFrozen] = useState(false);
  const spending = useCountTo(frozen ? toCents(0) : SPENDING);
  const vault = useCountTo(frozen ? TOTAL : VAULT);

  return (
    <div data-ui className="rounded-[24px] bg-m-surface p-6 text-m-ink sm:p-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[17px] font-[500]">Rosa&rsquo;s accounts</p>
        <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[15px] transition-colors duration-300 ${frozen ? 'bg-m-lavender text-m-indigo-press' : 'bg-m-safe-bg text-m-safe'}`}>
          <span aria-hidden className={`size-2 rounded-full ${frozen ? 'bg-m-indigo' : 'bg-m-safe'}`} />
          {frozen ? 'Frozen' : 'Open for spending'}
        </span>
      </div>

      <dl className="mt-8 grid gap-3">
        {/* Two fixed states, so the bars use class scales: 12% and 88% of the total, then 0% and 100%. */}
        <Balance label="Spending" amount={spending} bar={`bg-m-ink ${frozen ? 'scale-x-0' : 'scale-x-[0.12]'}`} />
        <Balance label="Vault" amount={vault} bar={`bg-m-indigo ${frozen ? 'scale-x-100' : 'scale-x-[0.88]'}`} />
      </dl>

      <p aria-live="polite" className="mt-8 min-h-[3.4em] text-[18px] leading-snug text-m-ink-2">
        {frozen
          ? `${formatCents(SPENDING)} moved to the vault. Any new payment now waits for the family.`
          : 'Payments follow the family’s rules. Risky ones pause.'}
      </p>

      <button
        type="button"
        aria-pressed={frozen}
        onClick={() => setFrozen((f) => !f)}
        className={`mt-6 inline-flex min-h-14 w-full items-center justify-center rounded-full px-8 text-[18px] font-[480] transition-[scale,background-color] duration-200 ease-[var(--ease-m)] outline-offset-4 focus-visible:outline-3 focus-visible:outline-m-indigo active:scale-[0.97] sm:w-auto ${frozen ? 'bg-m-indigo/10 text-m-ink hover:bg-m-indigo/15' : 'bg-m-indigo text-white hover:bg-m-indigo-press'}`}
      >
        {frozen ? 'Unfreeze' : 'Freeze spending'}
      </button>
    </div>
  );
}

type BalanceProps = { label: string; amount: Cents; bar: string };

function Balance({ label, amount, bar }: BalanceProps) {
  return (
    <div className="rounded-2xl bg-m-canvas p-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
        <dt className="text-[17px] text-m-ink-2">{label}</dt>
        <dd className="text-[40px] leading-none font-[480] tracking-[-0.01em] tabular-nums">{formatCents(amount)}</dd>
      </div>
      <div aria-hidden className="mt-5 h-2 overflow-hidden rounded-full bg-m-lavender">
        <div className={`h-full w-full origin-left rounded-full transition-transform duration-[1100ms] ease-[var(--ease-m)] motion-reduce:transition-none ${bar}`} />
      </div>
    </div>
  );
}
