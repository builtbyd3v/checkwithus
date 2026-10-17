'use client';

import { useState } from 'react';
import { toCents } from '@/lib/money';
import { PaymentCard, type ReviewPayment } from '../payment-card';
import { DecisionForm, DecisionStatus } from '../decision-ui';
import { Countdown } from '../deadline';
import type { FormState } from '../actions';

const fixture: ReviewPayment = {
  status: 'held', protectedName: 'Rosa', amountCents: toCents(50000),
  payee: { name: 'Neighborhood Gift Cards', kind: 'merchant', known: false },
  explanation: 'Rosa is buying gift cards during a phone call. Check with her before approving.',
  holdReasons: [{ code: 'gift_card', label: 'Gift card purchase' }, { code: 'during_call', label: 'Paid while on a phone call' }],
  approvalsRequired: 1,
};
const states = ['held', 'approved', 'denied', 'expired'] as const;

export function DashboardPreview() {
  const [status, setStatus] = useState<ReviewPayment['status']>('held');
  const [guardian, setGuardian] = useState(false);
  const [viewer, setViewer] = useState(false);
  const [longName, setLongName] = useState(false);
  const [twoApprovers, setTwoApprovers] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  async function simulateDecision(_state: FormState, form: FormData): Promise<FormState> {
    if (twoApprovers && form.get('decision') === 'approve') return { message: 'Your approval is in. It still needs another approver.' };
    const denied = form.get('decision') === 'deny';
    setStatus(denied ? 'denied' : 'approved');
    return { message: denied ? 'Denied. The payment will not go through.' : 'Approved. The payment is on its way.', decided: true };
  }
  return <main className="mx-auto w-full max-w-5xl px-5 py-8 text-stone-900">
    <header><p className="text-xl font-bold text-teal-950">checkwith.us</p>
      <h1 className="mt-6 text-3xl font-semibold">Looking out for Rosa</h1>
      <p className="mt-2 text-stone-700">Local gallery preview. Synthetic family; decisions here never send money.</p></header>
    <section aria-label="Preview controls" className="my-6 flex flex-wrap gap-3 rounded-xl border border-stone-300 p-4">
      {states.map((state) => <button key={state} onClick={() => setStatus(state)} className="min-h-11 rounded border border-stone-400 px-3 focus-visible:outline-2 focus-visible:outline-teal-800">Show {state}</button>)}
      <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={guardian} onChange={(event) => setGuardian(event.target.checked)} />Guardian required</label>
      <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={viewer} onChange={(event) => setViewer(event.target.checked)} />Viewer</label>
      <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={longName} onChange={(event) => setLongName(event.target.checked)} />Long payee name</label>
      <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={twoApprovers} onChange={(event) => setTwoApprovers(event.target.checked)} />Two approvers</label>
      <button onClick={() => setExpiresAt(new Date(Date.now() + 2000).toISOString())} className="min-h-11 rounded border border-stone-400 px-3 focus-visible:outline-2 focus-visible:outline-teal-800">Expire in two seconds</button>
    </section>
    <section aria-labelledby="preview-title" className="rounded-2xl border border-teal-900/15 bg-[#e6f0eb] p-5 sm:p-7">
      <h2 id="preview-title" className="text-2xl font-semibold">{status === 'held' ? '1 payment waiting' : 'All clear right now'}</h2>
      <DecisionStatus />
      {status !== 'held' && <h3 id="decided-title" tabIndex={-1} className="mt-5 font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-800">Recently decided</h3>}
      <div className="mt-5 max-w-xl"><PaymentCard payment={{ ...fixture, status, approvalsRequired: twoApprovers ? 2 : 1,
        payee: { ...fixture.payee, name: longName ? 'NeighborhoodGiftCardsAndEverydayShoppingWithAnExtraordinarilyLongUnbrokenName' : fixture.payee.name } }}
        deadline={status === 'held' ? expiresAt ? <Countdown expiresAt={expiresAt} /> : '4:59 left' : undefined}>
        {status === 'held' && !viewer && <DecisionForm paymentId="11111111-1111-4111-8111-111111111111" canApproveHere={!guardian} decideAction={simulateDecision} expiresAt={expiresAt} />}
        {status === 'held' && viewer && <p className="mt-4 text-stone-700">An approver in your family decides these.</p>}
        {status === 'expired' && <p className="mt-4 text-stone-700">Nobody answered in time, so it was blocked.</p>}
      </PaymentCard></div>
    </section>
  </main>;
}
