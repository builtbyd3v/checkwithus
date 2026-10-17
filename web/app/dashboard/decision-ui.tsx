'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import type { FormState } from './actions';

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
  return <p ref={result} id="decision-status" role="status" tabIndex={-1} className={notice ? 'mt-4 rounded-lg bg-white px-4 py-3 font-semibold text-teal-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800' : 'sr-only'}>{notice?.message}</p>;
}

/** Approve or deny one held payment. Under CIBA, approving happens in the Guardian push only. */
export function DecisionForm({ paymentId, canApproveHere, decideAction }: { paymentId: string; canApproveHere: boolean; decideAction: (state: FormState, form: FormData) => Promise<FormState> }) {
  const initial: FormState = { message: '' };
  const [state, decide, pending] = useActionState(async (previous: FormState, form: FormData) => {
    const result = await decideAction(previous, form);
    if (result.decided) window.dispatchEvent(new CustomEvent(DECIDED_EVENT, { detail: result.message }));
    return result;
  }, initial);
  const base = 'inline-flex min-h-12 min-w-28 items-center justify-center rounded-lg px-5 text-base font-semibold text-white focus-visible:outline-3 focus-visible:outline-offset-2 disabled:opacity-60';
  return <form action={decide} className="mt-5 border-t border-stone-100 pt-4">
    <input type="hidden" name="paymentId" value={paymentId} />
    <div className="flex flex-wrap gap-3">
      {canApproveHere && <button name="decision" value="approve" disabled={pending}
        className={`${base} bg-teal-800 hover:bg-teal-900 focus-visible:outline-teal-800`}>Approve</button>}
      <button name="decision" value="deny" disabled={pending}
        className={`${base} bg-rose-800 hover:bg-rose-900 focus-visible:outline-rose-800`}>{pending ? 'Sending…' : 'Deny'}</button>
    </div>
    {!canApproveHere && <p className="mt-2 text-sm text-stone-700">To approve, use the Guardian notification on your phone.</p>}
    {!state.decided && <p role="status" className="mt-3 text-sm text-teal-900">{state.message}</p>}
  </form>;
}

