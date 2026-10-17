'use client';

import { useActionState, useEffect, useState } from 'react';
import { addPayeeAction, inviteAction, joinAction, pairingAction, saveSettingsAction, type FormState } from './actions';

const initial: FormState = { message: '' };
const inputClass = 'h-11 w-full rounded-lg border border-stone-300 bg-white px-3 text-stone-900 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/20';
const buttonClass = 'inline-flex min-h-11 items-center justify-center rounded-lg bg-teal-800 px-4 font-semibold text-white hover:bg-teal-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800 disabled:opacity-60';

export function Countdown({ expiresAt }: { expiresAt: string }) {
  const [remaining, setRemaining] = useState<string>('—');
  useEffect(() => {
    const update = () => {
      const seconds = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setRemaining(`${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`);
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);
  return <time dateTime={expiresAt} aria-label={`Decision deadline ${new Date(expiresAt).toLocaleString()}`}>{remaining} left</time>;
}

function Feedback({ state }: { state: FormState }) {
  if (!state.message) return null;
  return <p role="status" className="mt-3 text-sm text-teal-900">{state.message}</p>;
}

export function JoinForm() {
  const [state, action, pending] = useActionState(joinAction, initial);
  return <form action={action} className="mt-8 space-y-4">
    <div><label htmlFor="inviteCode" className="mb-1 block font-medium">Family invite code</label>
      <input id="inviteCode" name="inviteCode" autoComplete="off" required className={inputClass} placeholder="XXXX-XXXX" /></div>
    <div><label htmlFor="displayName" className="mb-1 block font-medium">Your name</label>
      <input id="displayName" name="displayName" autoComplete="name" required maxLength={80} className={inputClass} /></div>
    <button disabled={pending} className={buttonClass}>{pending ? 'Joining…' : 'Join family circle'}</button>
    <Feedback state={state} />
  </form>;
}

export function SettingsForms({ circleId, holdDollars }: { circleId: string; holdDollars: string }) {
  const [settings, saveSettings, settingsPending] = useActionState(saveSettingsAction, initial);
  const [payee, addPayee, payeePending] = useActionState(addPayeeAction, initial);
  const [invite, makeInvite, invitePending] = useActionState(inviteAction, initial);
  const [pairing, makePairing, pairingPending] = useActionState(pairingAction, initial);
  return <div className="grid gap-6 lg:grid-cols-2">
    <section className="rounded-xl border border-stone-200 bg-white p-5">
      <h3 className="text-lg font-semibold">Payment hold limit</h3>
      <p className="mt-1 text-sm text-stone-600">Payments above this amount wait for family review.</p>
      <form action={saveSettings} className="mt-4 flex flex-wrap items-end gap-3">
        <input type="hidden" name="circleId" value={circleId} />
        <div className="min-w-40 flex-1"><label htmlFor="holdDollars" className="mb-1 block text-sm font-medium">Amount in dollars</label>
          <input id="holdDollars" name="holdDollars" inputMode="decimal" defaultValue={holdDollars} required className={inputClass} /></div>
        <button disabled={settingsPending} className={buttonClass}>Save limit</button>
      </form><Feedback state={settings} />
    </section>
    <section className="rounded-xl border border-stone-200 bg-white p-5">
      <h3 className="text-lg font-semibold">Add a known payee</h3>
      <p className="mt-1 text-sm text-stone-600">New payees are held until your family knows them.</p>
      <form action={addPayee} className="mt-4 grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="circleId" value={circleId} />
        <div className="sm:col-span-2"><label htmlFor="payeeName" className="mb-1 block text-sm font-medium">Payee name</label>
          <input id="payeeName" name="name" maxLength={80} required className={inputClass} /></div>
        <div><label htmlFor="payeeKind" className="mb-1 block text-sm font-medium">Type</label>
          <select id="payeeKind" name="kind" className={inputClass}><option value="merchant">Store</option><option value="biller">Bill</option><option value="person">Person</option></select></div>
        <div><label htmlFor="payeeCategory" className="mb-1 block text-sm font-medium">Category</label>
          <select id="payeeCategory" name="category" className={inputClass}><option value="groceries">Groceries</option><option value="pharmacy">Pharmacy</option><option value="utilities">Utilities</option><option value="healthcare">Healthcare</option><option value="dining">Dining</option><option value="shopping">Shopping</option><option value="transport">Transport</option><option value="other">Other</option></select></div>
        <button disabled={payeePending} className={`${buttonClass} sm:col-span-2`}>Save payee</button>
      </form><Feedback state={payee} />
    </section>
    <section className="rounded-xl border border-stone-200 bg-white p-5">
      <h3 className="text-lg font-semibold">Invite family</h3>
      <p className="mt-1 text-sm text-stone-600">Up to three family members can join this circle.</p>
      <form action={makeInvite} className="mt-4"><input type="hidden" name="circleId" value={circleId} />
        <button disabled={invitePending} className={buttonClass}>Create invite code</button></form>
      <Feedback state={invite} />
      {invite.code && <p className="mt-3 rounded-lg bg-teal-50 p-3 font-mono text-xl tracking-wider text-teal-950">{invite.code}</p>}
    </section>
    <section className="rounded-xl border border-stone-200 bg-white p-5">
      <h3 className="text-lg font-semibold">Pair the older adult’s phone</h3>
      <p className="mt-1 text-sm text-stone-600">This one-time code connects their iPhone to the family circle.</p>
      <form action={makePairing} className="mt-4"><input type="hidden" name="circleId" value={circleId} />
        <button disabled={pairingPending} className={buttonClass}>Create pairing code</button></form>
      <Feedback state={pairing} />
      {pairing.code && <p className="mt-3 rounded-lg bg-teal-50 p-3 font-mono text-xl tracking-wider text-teal-950">{pairing.code}</p>}
    </section>
  </div>;
}
