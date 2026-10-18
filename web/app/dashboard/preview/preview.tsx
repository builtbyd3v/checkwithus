'use client';

import { useState } from 'react';
import { toCents } from '@/lib/money';
import { PaymentCard, type ReviewPayment } from '../payment-card';
import { DecisionForm, DecisionStatus } from '../decision-ui';
import { Countdown } from '../deadline';
import { JoinForm } from '../controls';
import type { FormState } from '../actions';
import Link from 'next/link';
import { PROTECTED_NAME } from './fixtures';

const firstName = PROTECTED_NAME.split(' ')[0]!;
const fixture: ReviewPayment = {
  status: 'held', protectedName: firstName, amountCents: toCents(50000),
  payee: { name: 'Neighborhood Gift Cards', kind: 'merchant', known: false },
  category: { code: 'shopping', label: 'Shopping' }, createdAt: '2026-10-17T19:02:00Z',
  explanation: `${firstName} is buying gift cards during a phone call. Check with them before approving.`,
  holdReasons: [{ code: 'gift_card', label: 'Gift card purchase' }, { code: 'during_call', label: 'Paid while on a phone call' }],
  approvalsRequired: 1,
};
const option = 'inline-flex min-h-11 items-center gap-2 rounded-full bg-background px-4 font-semibold';
const states = ['held', 'approved', 'denied', 'expired'] as const;

export function DashboardPreview() {
  const [status, setStatus] = useState<ReviewPayment['status']>('held');
  const [guardian, setGuardian] = useState(false);
  const [viewer, setViewer] = useState(false);
  const [longName, setLongName] = useState(false);
  const [twoApprovers, setTwoApprovers] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [sequence, setSequence] = useState(false);
  async function simulateDecision(_state: FormState, form: FormData): Promise<FormState> {
    if (twoApprovers && form.get('decision') === 'approve') return { message: 'Your approval is in. It still needs another approver.' };
    const denied = form.get('decision') === 'deny';
    setStatus(denied ? 'denied' : 'approved');
    return { message: denied ? 'Denied. The payment will not go through.' : 'Approved. The payment is on its way.', decided: true };
  }
  return <main className="mx-auto w-full max-w-5xl px-4 pb-16 sm:px-10">
    <header><h1 className="text-4xl font-semibold sm:text-5xl">Looking out for {firstName}</h1>
      <p className="mt-2 text-muted">Local gallery preview. Synthetic family; decisions here never send money. <Link href="/dashboard/preview/full" className="font-semibold text-link underline underline-offset-4">See the whole dashboard</Link></p></header>
    <section aria-label="Preview controls" className="my-6 flex flex-wrap gap-2 rounded-3xl bg-surface p-4">
      {states.map((state) => <button key={state} onClick={() => setStatus(state)} className={option}>Show {state}</button>)}
      <label className={option}><input type="checkbox" checked={guardian} onChange={(event) => setGuardian(event.target.checked)} />Guardian required</label>
      <label className={option}><input type="checkbox" checked={viewer} onChange={(event) => setViewer(event.target.checked)} />Viewer</label>
      <label className={option}><input type="checkbox" checked={longName} onChange={(event) => setLongName(event.target.checked)} />Long payee name</label>
      <label className={option}><input type="checkbox" checked={twoApprovers} onChange={(event) => setTwoApprovers(event.target.checked)} />Two approvers</label>
      <label className={option}><input type="checkbox" checked={sequence} onChange={(event) => setSequence(event.target.checked)} />ATM sequence</label>
      <button onClick={() => setExpiresAt(new Date(Date.now() + 2000).toISOString())} className={option}>Expire in two seconds</button>
    </section>
    <section aria-labelledby="preview-title" className="rounded-[28px] bg-action/10 p-4 sm:p-7">
      <h2 id="preview-title" className="text-2xl font-semibold">{status === 'held' ? '1 payment waiting' : 'All clear right now'}</h2>
      <DecisionStatus />
      {status !== 'held' && <h3 id="decided-title" tabIndex={-1} className="mt-5 font-semibold">Recently decided</h3>}
      <div className="mt-5 max-w-2xl"><PaymentCard payment={{ ...fixture, status, approvalsRequired: twoApprovers ? 2 : 1,
        payee: { ...fixture.payee, name: longName ? 'NeighborhoodGiftCardsAndEverydayShoppingWithAnExtraordinarilyLongUnbrokenName' : fixture.payee.name } }}
        usual={{ line: `About 8x ${firstName}’s usual daily spending`, times: 8, kind: 'daily' }}
        sequence={sequence ? { cashAt: '2026-10-17T14:30:00Z', paymentAt: '2026-10-17T15:00:00Z', cashCents: toCents(20000), atmName: 'Demo ATM (synthetic)' } : undefined}
        deadline={status === 'held' ? expiresAt ? <Countdown expiresAt={expiresAt} /> : '4:59 left' : undefined}>
        {status === 'held' && !viewer && <DecisionForm paymentId="11111111-1111-4111-8111-111111111111" canApproveHere={!guardian} decideAction={simulateDecision} expiresAt={expiresAt} />}
        {status === 'held' && viewer && <p className="mt-6 font-semibold">An approver in your family decides this.</p>}
        {status === 'expired' && <p className="mt-4">Nobody answered in time, so it was blocked.</p>}
      </PaymentCard></div>
    </section>
    <section aria-labelledby="join-preview-title" className="mt-10 max-w-xl">
      <h2 id="join-preview-title" className="text-2xl font-semibold">Join form</h2>
      <p className="mt-1 text-muted">What a signed-in member with no circle sees. Joining here needs a real sign-in.</p>
      <JoinForm />
    </section>
  </main>;
}
