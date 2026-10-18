'use client';

import { useState, type ReactNode } from 'react';
import type { Category, PayeeKind } from '@/lib/categories';
import { formatCents, toCents } from '@/lib/money';
import { DEFAULT_HOLD_OVER_CENTS, HOLD_REASON_LABELS, decideHold } from '@/lib/rules';
import { Icon, PaymentScreen } from './screens';

// The live thing: the visitor builds a payment and the app's real rules (lib/rules.ts) decide it.
// ponytail: no spending baseline and no Guard score here, so "unusual spending" and "scam check" never fire in the demo.

type Kind = { id: string; label: string; payee: string; category: Category; payeeKind: PayeeKind };

const KINDS: Kind[] = [
  { id: 'electric', label: 'Electric bill', payee: 'City Electric', category: 'utilities', payeeKind: 'biller' },
  { id: 'groceries', label: 'Groceries', payee: 'Corner Market', category: 'groceries', payeeKind: 'merchant' },
  { id: 'gift', label: 'Gift cards', payee: 'Gift card rack', category: 'gift_cards', payeeKind: 'merchant' },
  { id: 'wire', label: 'Wire transfer', payee: 'A caller named Officer Reed', category: 'wire_transfer', payeeKind: 'person' },
];
const AMOUNTS = [8_400, 25_000, 50_000, 150_000];
// ponytail: mirrors the default of circles.two_approvals_over_cents (db/migrations/011); families can change it.
const TWO_APPROVALS_OVER = 100_000;

type ChoiceProps = { name: string; checked: boolean; onChange: () => void; children: ReactNode };

const ring = 'has-focus-visible:outline-3 has-focus-visible:outline-offset-3 has-focus-visible:outline-foreground';

function Choice({ name, checked, onChange, children }: ChoiceProps) {
  return (
    <label className={`flex min-h-14 cursor-pointer items-center rounded-xl px-5 text-xl font-bold ring-2 ring-foreground/55 ring-inset transition-colors duration-150 hover:bg-foreground/8 has-checked:bg-foreground has-checked:text-background has-checked:ring-foreground ${ring}`}>
      <input type="radio" name={name} checked={checked} onChange={onChange} className="sr-only" />
      {children}
    </label>
  );
}

type ToggleProps = { checked: boolean; onChange: (v: boolean) => void; children: ReactNode };

function Toggle({ checked, onChange, children }: ToggleProps) {
  return (
    <label className={`flex min-h-14 cursor-pointer items-center justify-between gap-4 rounded-xl text-xl ${ring}`}>
      {children}
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only" />
      {/* Both track colours keep 3:1 or more against the page. */}
      <span aria-hidden="true" className={`flex h-9 w-16 shrink-0 items-center rounded-full p-1 transition-colors duration-150 ${checked ? 'bg-action' : 'bg-foreground/55'}`}>
        <span className={`size-7 rounded-full bg-white transition-transform duration-150 motion-reduce:transition-none ${checked ? 'translate-x-7' : ''}`} />
      </span>
    </label>
  );
}

const legend = 'text-2xl font-extrabold';

export function Tryout() {
  const [kindId, setKindId] = useState('gift');
  const [amount, setAmount] = useState(50_000);
  const [onCall, setOnCall] = useState(true);
  const [known, setKnown] = useState(false);

  const kind = KINDS.find((k) => k.id === kindId) ?? KINDS[0]!;
  const decision = decideHold({
    payment: { amountCents: toCents(amount), category: kind.category, payeeKind: kind.payeeKind, payeeKnown: known, onCall },
    holdOverCents: DEFAULT_HOLD_OVER_CENTS,
    baseline: null,
    guard: null,
  });
  const reasons = decision.action === 'hold' ? decision.reasons.map((r) => HOLD_REASON_LABELS[r]) : [];
  const held = reasons.length > 0;
  const money = formatCents(toCents(amount));

  return (
    <section id="try" aria-labelledby="try-heading" className="scroll-mt-4 px-4 py-20 sm:px-10 lg:px-16 lg:py-28 xl:px-28">
      <h2 id="try-heading" className="text-[clamp(2.5rem,1.4rem+4.2vw,4.25rem)] leading-none font-extrabold tracking-[-0.03em] text-balance">Try a payment.</h2>
      <p className="mt-5 max-w-[38ch] text-[clamp(1.25rem,1.1rem+0.6vw,1.5rem)] leading-snug text-muted">
        The same rules the app runs decide what happens. AI can add a reason to pause, and nothing lets it remove one.
      </p>
      <div className="mt-12 grid gap-12 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-16">
        <div className="max-w-[36rem] space-y-9">
          <fieldset>
            <legend className={legend}>What is it for?</legend>
            <div className="mt-4 flex flex-wrap gap-3">
              {KINDS.map((k) => (
                <Choice key={k.id} name="kind" checked={k.id === kindId} onChange={() => setKindId(k.id)}>{k.label}</Choice>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className={legend}>How much?</legend>
            <div className="mt-4 flex flex-wrap gap-3 tabular-nums">
              {AMOUNTS.map((a) => (
                <Choice key={a} name="amount" checked={a === amount} onChange={() => setAmount(a)}>{formatCents(toCents(a))}</Choice>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className={legend}>Anything else?</legend>
            <div className="mt-3 max-w-[28rem]">
              <Toggle checked={onCall} onChange={setOnCall}>On a phone call right now</Toggle>
              <Toggle checked={known} onChange={setKnown}>Paid this payee before</Toggle>
            </div>
          </fieldset>
        </div>

        <div className="flex flex-col items-center gap-8 sm:flex-row sm:items-start lg:flex-col lg:items-stretch xl:flex-row xl:items-start">
          <PaymentScreen held={held} amount={money} payee={kind.payee} className="self-center text-[10px] sm:text-[11px] lg:self-auto" />
          <div className="w-full max-w-[24rem] rounded-2xl bg-band p-6 text-white sm:p-7">
            <p className="text-xl font-bold text-white/85">In your family app</p>
            <div aria-live="polite">
              {held ? (
                <>
                  <p className="mt-3 text-2xl leading-snug font-extrabold">Approve {money} to {kind.payee}?</p>
                  <ul className="mt-4 text-xl leading-snug">
                    {reasons.map((r) => (
                      <li key={r} className="flex gap-3 border-t-2 border-white/25 py-3"><Icon name="pause" className="mt-0.5 size-6" />{r}</li>
                    ))}
                  </ul>
                  <p className="mt-3 text-xl leading-snug text-white/85">{amount > TWO_APPROVALS_OVER ? 'Over $1,000, two people must say yes. One no stops it.' : 'One person in the family can decide.'} No answer means no payment.</p>
                </>
              ) : (
                <>
                  <p className="mt-3 text-2xl leading-snug font-extrabold">Nothing to approve. It paid.</p>
                  <p className="mt-4 text-xl leading-snug text-white/85">No rule fired, so nothing waits for you. It shows in their spending history.</p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
