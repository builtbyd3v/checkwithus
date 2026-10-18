'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import type { FormState } from './actions';
import { useRemainingSeconds } from './deadline';

const DECIDED_EVENT = 'checkwith:decided';

/**
 * Always mounted above the held payments. A decided card leaves the list, so
 * its own message would vanish unread: this live region says it instead and
 * moves focus to the persistent result after React commits it. The decided
 * heading may not exist yet while a server action's route update is arriving.
 */
export function DecisionStatus() {
  const [notice, setNotice] = useState<{ message: string } | null>(null);
  const result = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    const show = (event: Event) => {
      setNotice({ message: (event as CustomEvent<string>).detail });
    };
    window.addEventListener(DECIDED_EVENT, show);
    return () => window.removeEventListener(DECIDED_EVENT, show);
  }, []);
  useEffect(() => {
    if (notice) result.current?.focus();
  }, [notice]);
  return <p ref={result} id="decision-status" role="status" tabIndex={-1} className={notice ? 'mb-4 rounded-2xl bg-card px-5 py-4 font-semibold' : 'sr-only'}>{notice?.message}</p>;
}

/** Approve or deny one held payment. Under CIBA, approving happens in the Guardian push only. */
export function DecisionForm({ paymentId, canApproveHere, decideAction, expiresAt }: { paymentId: string; canApproveHere: boolean; decideAction: (state: FormState, form: FormData) => Promise<FormState>; expiresAt?: string | null }) {
  const seconds = useRemainingSeconds(expiresAt);
  const deadlinePassed = seconds === 0;
  const initial: FormState = { message: '' };
  const [state, decide, pending] = useActionState(async (previous: FormState, form: FormData) => {
    if (expiresAt && Date.parse(expiresAt) <= Date.now()) {
      return { message: 'Time is up. Refresh to see the latest payment status.' };
    }
    const result = await decideAction(previous, form);
    if (result.decided) window.dispatchEvent(new CustomEvent(DECIDED_EVENT, { detail: result.message }));
    return result;
  }, initial);
  const base = 'inline-flex min-h-14 items-center justify-center gap-2 rounded-full px-[26px] text-base font-semibold disabled:opacity-60 sm:min-h-13';
  return <form action={decide} className="mt-4 @md:mt-6">
    <input type="hidden" name="paymentId" value={paymentId} />
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(8rem,100%),1fr))] gap-2.5 sm:flex sm:flex-wrap sm:gap-3">
      {canApproveHere && <button name="decision" value="approve" disabled={pending || deadlinePassed}
        className={`${base} bg-action text-white hover:bg-action-hover sm:min-w-40`}>
        <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4.5"><path d="M4.5 10.5l3.5 3.5 7.5-8" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>Approve</button>}
      <button name="decision" value="deny" disabled={pending || deadlinePassed}
        className={`${base} bg-[#b42318] text-white hover:bg-[#9a1d14] sm:min-w-40 dark:bg-[#c9302a] dark:hover:bg-[#b02822]`}>
        <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4.5"><circle cx="10" cy="10" r="6.6" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M5.4 14.6l9.2-9.2" stroke="currentColor" strokeWidth="2" /></svg>{pending ? 'Sending…' : 'Deny'}</button>
    </div>
    {!canApproveHere && <p className="mt-3">To approve, use the Guardian notification on your phone.</p>}
    {deadlinePassed && <p role="status" className="mt-3 font-semibold">Time is up. Refresh to see the latest payment status.</p>}
    {!state.decided && <p role="status" className="mt-3">{state.message}</p>}
  </form>;
}
