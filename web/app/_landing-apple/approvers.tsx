'use client';

import { useState } from 'react';

type Vote = 'yes' | 'no' | null;
const PEOPLE = ['Sam', 'Priya'] as const;

/**
 * The one thing a visitor can try: the over-$1,000 rule. Two approvers must
 * say yes; one no stops the payment. ponytail: mirrors the rule for show, the
 * real tally lives in lib/payments.ts.
 */
export function Approvers() {
  const [votes, setVotes] = useState<Record<(typeof PEOPLE)[number], Vote>>({ Sam: null, Priya: null });
  const all = Object.values(votes);
  const yeses = all.filter((v) => v === 'yes').length;
  const result = all.includes('no')
    ? { text: 'Stopped. One no is enough. The money stays put.', tone: 'text-ap-stop' }
    : yeses === PEOPLE.length
      ? { text: 'Paid. Two yeses, as the rule asks.', tone: 'text-ap-ok' }
      : { text: `Waiting. ${yeses} of 2 yeses so far.`, tone: 'text-ap-ink' };

  return (
    <div data-ui className="w-full max-w-[28rem] rounded-[1.5rem] bg-ap-parch p-6 text-ap-ink sm:p-8">
      <p className="text-[1.125rem] text-ap-mute">Rosa wants to pay</p>
      <p className="mt-1 text-[2.5rem] leading-none font-semibold tracking-[-0.03em]">$1,250.00</p>
      <p className="mt-2 text-[1.1875rem]">to Bright Roof Co.</p>
      <ul className="mt-6 space-y-3">
        {PEOPLE.map((p) => (
          <li key={p} className="flex items-center justify-between gap-3">
            <span className="text-[1.1875rem] font-semibold">{p}</span>
            <span className="flex gap-2" role="group" aria-label={`${p}'s answer`}>
              {(['no', 'yes'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={votes[p] === v}
                  onClick={() => setVotes((s) => ({ ...s, [p]: s[p] === v ? null : v }))}
                  className={`min-h-12 min-w-20 rounded-full px-5 text-[1.125rem] font-semibold transition-[transform,background-color,color] duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ap-blue active:scale-95 ${
                    votes[p] === v
                      ? v === 'yes' ? 'bg-ap-blue text-white' : 'bg-ap-ink text-white'
                      : 'bg-white text-ap-ink hover:bg-[#e8e8ed]'
                  }`}
                >
                  {v === 'yes' ? 'Yes' : 'No'}
                </button>
              ))}
            </span>
          </li>
        ))}
      </ul>
      <p aria-live="polite" className={`mt-6 min-h-[3.2em] text-[1.1875rem] leading-snug font-semibold ${result.tone}`}>{result.text}</p>
    </div>
  );
}
