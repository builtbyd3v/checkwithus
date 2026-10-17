'use client';

import { useState } from 'react';
import { Avatar, type AvatarName } from './art';

type Vote = 'yes' | 'no' | null;

const MEMBERS: { id: AvatarName; name: string; role: string }[] = [
  { id: 'dani', name: 'Dani', role: 'Daughter' },
  { id: 'sam', name: 'Sam', role: 'Son' },
  { id: 'ana', name: 'Ana', role: 'Granddaughter' },
];

const YES_NEEDED = 2;

/**
 * A pretend held payment over $1,000 that the visitor answers as the family.
 * ponytail: mirrors the "two yeses, one no stops it" rule in copy only; the
 * real decision lives on the server.
 */
export function FamilyVote({ reasons }: { reasons: string[] }) {
  const [votes, setVotes] = useState<Record<AvatarName, Vote>>({ dani: null, sam: null, ana: null });
  const values = Object.values(votes);
  const yes = values.filter((v) => v === 'yes').length;
  const stopped = values.includes('no');
  const outcome = stopped ? 'stopped' : yes >= YES_NEEDED ? 'paid' : 'waiting';
  const done = outcome !== 'waiting';

  const status = {
    waiting: `Waiting. ${yes} of ${YES_NEEDED} yeses so far.`,
    stopped: 'Stopped. One no is enough. Mom’s screen says she is safe.',
    paid: 'Paid. Two of the family said yes.',
  }[outcome];

  return (
    <div data-ui className="rounded-[24px] bg-white p-6 sm:p-8">
      <p className="text-[48px] font-semibold leading-none tracking-[-0.02em] tabular-nums text-cw-ink">$1,250.00</p>
      <p className="mt-2 text-lg text-cw-body">From Mom to a roofing company, waiting for the family.</p>
      <ul className="mt-5 flex flex-wrap gap-2">
        {reasons.map((r) => (
          <li key={r} className="rounded-full bg-cw-blush px-4 py-2 text-base font-semibold text-cw-ink">
            {r}
          </li>
        ))}
      </ul>

      <ul className="mt-7 space-y-3">
        {MEMBERS.map((m) => {
          const v = votes[m.id];
          return (
            <li key={m.id} className="flex flex-wrap items-center gap-4 rounded-2xl bg-cw-soft p-3 pr-4">
              <Avatar name={m.id} className="h-14 w-14 shrink-0" />
              <div className="min-w-0 grow basis-[8rem]">
                <p className="text-lg font-semibold text-cw-ink">{m.name}</p>
                <p className="text-base text-cw-muted">{v === null ? m.role : v === 'yes' ? 'Said yes' : 'Said no'}</p>
              </div>
              <div className="ml-auto flex gap-2" role="group" aria-label={`${m.name}'s answer`}>
                {(['no', 'yes'] as const).map((choice) => (
                  <button
                    key={choice}
                    type="button"
                    disabled={done && v === null}
                    aria-pressed={v === choice}
                    onClick={() => setVotes((prev) => ({ ...prev, [m.id]: prev[m.id] === choice ? null : choice }))}
                    className={`min-h-12 min-w-16 rounded-full px-5 text-lg font-semibold transition-[transform,background-color,color] duration-150 active:scale-95 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-cw-ink disabled:cursor-not-allowed disabled:opacity-40 ${
                      v === choice
                        ? choice === 'no'
                          ? 'bg-cw-coral text-white'
                          : 'bg-cw-safe text-white'
                        : 'bg-white text-cw-ink hover:bg-cw-blush'
                    }`}
                  >
                    {choice === 'no' ? 'No' : 'Yes'}
                  </button>
                ))}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <p
          role="status"
          aria-live="polite"
          className={`text-lg font-semibold ${outcome === 'stopped' ? 'text-cw-coral-deep' : outcome === 'paid' ? 'text-cw-safe' : 'text-cw-ink'}`}
        >
          {status}
        </p>
        {values.some((v) => v !== null) && (
          <button
            type="button"
            onClick={() => setVotes({ dani: null, sam: null, ana: null })}
            className="min-h-12 rounded-full px-4 text-lg font-semibold text-cw-ink underline underline-offset-4 hover:text-cw-coral-deep focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-cw-ink"
          >
            Start over
          </button>
        )}
      </div>
    </div>
  );
}
