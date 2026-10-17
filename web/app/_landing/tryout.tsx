'use client';

import { useState, type ReactNode } from 'react';
import type { Category, PayeeKind } from '@/lib/categories';
import { formatCents, toCents } from '@/lib/money';
import { DEFAULT_HOLD_OVER_CENTS, HOLD_REASON_LABELS, decideHold } from '@/lib/rules';
import { PaymentScreen } from './screens';

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

function Choice({ name, checked, onChange, children }: ChoiceProps) {
  return (
    <label className="flex min-h-12 cursor-pointer items-center rounded-full bg-paper/10 px-5 text-lg transition-colors duration-200 hover:bg-paper/20 active:scale-[0.97] has-checked:bg-paper has-checked:text-ink has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-paper">
      <input type="radio" name={name} checked={checked} onChange={onChange} className="sr-only" />
      {children}
    </label>
  );
}

type ToggleProps = { checked: boolean; onChange: (v: boolean) => void; children: ReactNode };

function Toggle({ checked, onChange, children }: ToggleProps) {
  return (
    <label className="flex min-h-12 cursor-pointer items-center justify-between gap-4 text-lg has-focus-visible:outline-3 has-focus-visible:outline-offset-4 has-focus-visible:outline-paper">
      {children}
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only" />
      <span aria-hidden="true" className={`flex h-8 w-14 shrink-0 items-center rounded-full p-1 transition-colors duration-200 ${checked ? 'bg-sage' : 'bg-paper/25'}`}>
        <span className={`size-6 rounded-full bg-paper transition-transform duration-200 ${checked ? 'translate-x-6' : ''}`} />
      </span>
    </label>
  );
}

export function Tryout({ heading }: { heading: [string, string] }) {
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
    <section id="try" aria-labelledby="try-heading" className="grid scroll-mt-4 lg:grid-cols-2">
      <div className="flex flex-col bg-ink px-5 pt-16 pb-8 text-paper sm:px-12 lg:min-h-[90svh] lg:pt-[12svh]">
        <div className="max-w-[34rem]">
          <p className="rise text-[clamp(1.375rem,1.1rem+0.8vw,1.75rem)] leading-snug">
            Build a payment. The rules the app runs decide what happens. AI can add a reason to pause, and nothing lets it remove one.
          </p>
          <fieldset className="rise-late mt-10">
            <legend className="text-[15px] text-paper/80">What is it for?</legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {KINDS.map((k) => (
                <Choice key={k.id} name="kind" checked={k.id === kindId} onChange={() => setKindId(k.id)}>{k.label}</Choice>
              ))}
            </div>
          </fieldset>
          <fieldset className="rise-late mt-7">
            <legend className="text-[15px] text-paper/80">How much?</legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {AMOUNTS.map((a) => (
                <Choice key={a} name="amount" checked={a === amount} onChange={() => setAmount(a)}>{formatCents(toCents(a))}</Choice>
              ))}
            </div>
          </fieldset>
          <div className="rise-late mt-7 max-w-[26rem] space-y-1">
            <Toggle checked={onCall} onChange={setOnCall}>On a phone call right now</Toggle>
            <Toggle checked={known} onChange={setKnown}>Paid this payee before</Toggle>
          </div>
        </div>
        <h2 id="try-heading" className="mt-16 font-display text-[clamp(2.75rem,1.6rem+4vw,5.5rem)] leading-none tracking-[-0.02em] lg:mt-auto">
          {heading[0]}
        </h2>
      </div>

      <div className="flex flex-col bg-paper px-5 pt-10 pb-16 sm:px-12 lg:min-h-[90svh] lg:px-8 lg:pt-[12svh] lg:pb-8">
        <p aria-hidden="true" className="font-display text-[clamp(2.75rem,1.6rem+4vw,5.5rem)] leading-none tracking-[-0.02em] lg:order-last lg:mt-auto lg:text-right">
          {heading[1]}
        </p>
        <div className="mt-10 flex flex-wrap items-start gap-5 lg:mt-0">
          <PaymentScreen held={held} amount={money} payee={kind.payee} reasons={reasons} className="h-[460px] max-w-full lg:h-[540px]" />
          <div data-ui className="w-[340px] max-w-full rounded-[28px] bg-panel p-6 xl:w-[296px]">
            <p className="text-[15px] text-soft">What the family gets</p>
            <div aria-live="polite">
              {held ? (
                <>
                  <p className="mt-3 text-[22px] leading-snug font-semibold">Approve {money} to {kind.payee}?</p>
                  <ul className="mt-4 space-y-2 text-lg leading-snug">
                    {reasons.map((r) => (
                      <li key={r} className="flex gap-3"><span aria-hidden="true" className="mt-2.5 size-2 shrink-0 rounded-full bg-sage" />{r}</li>
                    ))}
                  </ul>
                  <p className="mt-5 text-[17px] text-soft">{amount > TWO_APPROVALS_OVER ? 'Over $1,000, so two of three approvers must say yes.' : 'One approver can decide.'} No answer means no payment.</p>
                </>
              ) : (
                <>
                  <p className="mt-3 text-[22px] leading-snug font-semibold">Nothing. It paid.</p>
                  <p className="mt-4 text-lg leading-snug">No rule fired, so nobody gets a push. It shows in the family&rsquo;s spending history.</p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
