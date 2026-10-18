'use client';

import { useActionState, useState } from 'react';
import { parseDollars } from '@/lib/money';
import { isPolicyOff } from '@/lib/rules';
import { canonicalCode } from '@/lib/short-code';
import { addPayeeAction, decideAction, freezeAction, inviteAction, joinAction, pairingAction, saveSettingsAction, unfreezeAction, unpairAction, type FormState } from './actions';

import { CodeInput } from './code-input';
import { DecisionForm } from './decision-ui';

const initial: FormState = { message: '' };
const inputClass = 'h-13 w-full rounded-[14px] border-2 border-[#e4e0eb] bg-card px-4 text-lg font-semibold text-foreground outline-none hover:border-action/40 focus:border-action focus:ring-3 focus:ring-action/25 dark:border-[#302a39]';
const labelClass = 'mb-2 block font-semibold';
const buttonClass = 'inline-flex min-h-13 items-center justify-center rounded-full bg-action px-[22px] font-semibold text-white hover:bg-action-hover disabled:opacity-60';
const quietButton = 'inline-flex min-h-13 items-center justify-center gap-2 rounded-full bg-surface px-6 font-semibold text-foreground hover:bg-action/10 disabled:opacity-60 dark:bg-white/[.06] dark:hover:bg-action/20';

export { Countdown } from './deadline';

function Feedback({ state }: { state: FormState }) {
  if (!state.message) return null;
  return <p role="status" className="mt-3">{state.message}</p>;
}

export function JoinForm() {
  const [state, action, pending] = useActionState(joinAction, initial);
  const [code, setCode] = useState('');
  // Join stays disabled until all 8 are in, so Return in either field does nothing before that.
  return <form action={action} className="mt-8 space-y-4">
    <div><label htmlFor="inviteCode" className={labelClass}>Family invite code</label>
      <CodeInput id="inviteCode" name="inviteCode" value={code} onChange={setCode} /></div>
    <div><label htmlFor="displayName" className={labelClass}>Your name</label>
      <input id="displayName" name="displayName" autoComplete="name" required maxLength={80} className={inputClass} /></div>
    <button disabled={pending || !canonicalCode(code)} className={buttonClass}>{pending ? 'Joining…' : 'Join family circle'}</button>
    <Feedback state={state} />
  </form>;
}

export { DecisionStatus } from './decision-ui';

export function DecisionButtons({ paymentId, canApproveHere, expiresAt }: { paymentId: string; canApproveHere: boolean; expiresAt?: string | null }) {
  return <DecisionForm paymentId={paymentId} canApproveHere={canApproveHere} decideAction={decideAction} expiresAt={expiresAt} />;
}

/** One tap during a live scam: the spending money goes to the vault and every payment waits. A calm secondary action. */
export function FreezeControl({ circleId, frozen, firstName, vaultLabel, vaultDollars }: {
  circleId: string; frozen: boolean; firstName: string; vaultLabel: string; vaultDollars: string;
}) {
  const [frozeState, freezeNow, freezing] = useActionState(freezeAction, initial);
  const [unfrozeState, unfreezeNow, unfreezing] = useActionState(unfreezeAction, initial);
  if (!frozen) return <div>
    <p className="mb-4">During a scam, move {firstName}’s spending money to the vault. Every payment waits for the family until you unfreeze.</p>
    <form action={freezeNow}><input type="hidden" name="circleId" value={circleId} />
      <button disabled={freezing} className={`${quietButton} w-full`}>
        <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4.5"><rect x="4" y="9" width="12" height="8.5" rx="2" fill="currentColor" /><path d="M6.8 9V6.6a3.2 3.2 0 016.4 0V9" fill="none" stroke="currentColor" strokeWidth="2" /></svg>
        {freezing ? 'Freezing…' : 'Freeze money now'}</button></form>
    <Feedback state={frozeState} />
  </div>;
  return <div className="rounded-2xl bg-pause-field px-5 py-4">
    <p className="font-heading text-lg font-extrabold tracking-[-.02em] text-pause">Spending is frozen</p>
    <p className="mt-1">{vaultLabel} is safe in the vault. Every payment waits for the family.</p>
    <Feedback state={frozeState} />
    <form action={unfreezeNow} className="mt-4 flex flex-wrap items-end gap-3">
      <input type="hidden" name="circleId" value={circleId} />
      <div className="min-w-[min(10rem,100%)] flex-1"><label htmlFor="unfreezeDollars" className={labelClass}>Dollars to move back</label>
        <input id="unfreezeDollars" name="dollars" inputMode="numeric" defaultValue={vaultDollars} required className={inputClass} /></div>
      <button disabled={unfreezing} className={buttonClass}>{unfreezing ? 'Unfreezing…' : 'Unfreeze'}</button>
    </form><Feedback state={unfrozeState} />
  </div>;
}

/** A real on/off switch: a button with role="switch", named by its visible label. */
function Switch({ id, labelId, on, onChange }: { id: string; labelId: string; on: boolean; onChange: (on: boolean) => void }) {
  return <button id={id} type="button" role="switch" aria-checked={on} aria-labelledby={labelId} onClick={() => onChange(!on)}
    className="group inline-flex min-h-11 shrink-0 items-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-action/25">
    <span className={`flex h-8 w-14 items-center rounded-full p-1 transition-colors ${on ? 'bg-action' : 'bg-[#e4e0eb] dark:bg-[#302a39]'}`}>
      <span className={`size-6 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-6' : ''}`} /></span>
    <span className="sr-only">{on ? 'On' : 'Off'}</span>
  </button>;
}

function AmountField({ id, name, label, defaultValue }: { id: string; name: string; label: string; defaultValue: string }) {
  return <div className="mt-3"><label htmlFor={id} className={labelClass}>{label}</label>
    <div className="relative"><span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-lg text-muted">$</span>
      <input id={id} name={name} inputMode="decimal" defaultValue={defaultValue} required maxLength={20} className={`${inputClass} pl-9`} /></div></div>;
}

const isOff = (dollars: string) => { try { return isPolicyOff(parseDollars(dollars)); } catch { return false; } };

/**
 * Hold limit and two-approver rule. The two-approver part shows only when the page passes its amount;
 * without it the form leaves that rule as it is.
 */
export function HoldLimitForm({ circleId, holdDollars, twoApprovalsDollars, approverCount }: {
  circleId: string; holdDollars: string; twoApprovalsDollars?: string; approverCount?: number;
}) {
  const [settings, saveSettings, settingsPending] = useActionState(saveSettingsAction, initial);
  const [holdOn, setHoldOn] = useState(!isOff(holdDollars));
  const [twoOn, setTwoOn] = useState(twoApprovalsDollars === undefined || !isOff(twoApprovalsDollars));
  // Off is stored as a sentinel, so turning a rule back on starts from the default amount.
  const holdStart = isOff(holdDollars) ? '300.00' : holdDollars;
  const twoStart = twoApprovalsDollars === undefined || isOff(twoApprovalsDollars) ? '1000.00' : twoApprovalsDollars;
  return <div>
    <form action={saveSettings}>
      <input type="hidden" name="circleId" value={circleId} />
      <input type="hidden" name="holdLimit" value={holdOn ? 'on' : 'off'} />
      <div className="flex items-center justify-between gap-4">
        <span id="holdLimitLabel" className="font-semibold">Hold big payments</span>
        <Switch id="holdLimitSwitch" labelId="holdLimitLabel" on={holdOn} onChange={setHoldOn} />
      </div>
      {holdOn
        ? <AmountField id="holdDollars" name="holdDollars" label="Hold payments over, in dollars" defaultValue={holdStart} />
        : <p className="mt-1 text-sm text-muted">Off. Gift cards, crypto, wires, new payees and calls still wait for you.</p>}

      {twoApprovalsDollars !== undefined && <div className="mt-6">
        <input type="hidden" name="twoApprovals" value={twoOn ? 'on' : 'off'} />
        <div className="flex items-center justify-between gap-4">
          <span id="twoApprovalsLabel" className="font-semibold">Two approvers for large payments</span>
          <Switch id="twoApprovalsSwitch" labelId="twoApprovalsLabel" on={twoOn} onChange={setTwoOn} />
        </div>
        {twoOn
          ? <AmountField id="twoDollars" name="twoDollars" label="Two people must say yes over, in dollars" defaultValue={twoStart} />
          : <p className="mt-1 text-sm text-muted">Off. One approver decides every payment.</p>}
        {twoOn && approverCount !== undefined && approverCount < 2 && <p role="note" className="mt-3 rounded-2xl bg-pause-field px-4 py-3">
          <span className="font-semibold text-pause">You have one approver.</span> Payments over this amount cannot be approved. Add an approver or turn this off.</p>}
      </div>}

      <p className="mt-4 text-sm text-muted">Changes apply to new payments.</p>
      <button disabled={settingsPending} className={`${buttonClass} mt-3`}>{settingsPending ? 'Saving…' : 'Save rules'}</button>
    </form>
    <Feedback state={settings} />
    {settings.signInUrl && <a href={settings.signInUrl} className={`${quietButton} mt-3`}>Sign in again</a>}
  </div>;
}

export function PayeeForm({ circleId }: { circleId: string }) {
  const [payee, addPayee, payeePending] = useActionState(addPayeeAction, initial);
  return <div>
    <h4 className="font-extrabold">Add a known payee</h4>
    <p className="mt-1 text-sm text-muted">New payees are held until your family knows them.</p>
    <form action={addPayee} className="mt-4 grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="circleId" value={circleId} />
      <div className="sm:col-span-2"><label htmlFor="payeeName" className={labelClass}>Payee name</label>
        <input id="payeeName" name="name" maxLength={80} required className={inputClass} /></div>
      <div><label htmlFor="payeeKind" className={labelClass}>Type</label>
        <select id="payeeKind" name="kind" className={inputClass}><option value="merchant">Store</option><option value="biller">Bill</option><option value="person">Person</option></select></div>
      <div><label htmlFor="payeeCategory" className={labelClass}>Category</label>
        <select id="payeeCategory" name="category" className={inputClass}><option value="groceries">Groceries</option><option value="pharmacy">Pharmacy</option><option value="utilities">Utilities</option><option value="healthcare">Healthcare</option><option value="dining">Dining</option><option value="shopping">Shopping</option><option value="transport">Transport</option><option value="other">Other</option></select></div>
      <button disabled={payeePending} className={`${quietButton} sm:col-span-2`}>Save payee</button>
    </form><Feedback state={payee} />
  </div>;
}

function Code({ label, code, expiresAt }: { label: string; code?: string; expiresAt?: string }) {
  if (!code) return null;
  const until = expiresAt && new Date(expiresAt);
  return <p className="mt-3 flex min-h-14 flex-wrap items-center gap-x-3 gap-y-1 rounded-[14px] bg-surface py-2.5 pl-4 pr-4 dark:bg-white/[.06]">
    <span className="flex-1 text-sm text-muted">{label}</span><span className="text-xl font-semibold tracking-[.06em] tabular-nums">{canonicalCode(code) ?? code}</span>
    {until && !Number.isNaN(until.getTime()) && <span className="text-sm text-muted">Until {until.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>}</p>;
}

export function InviteForm({ circleId }: { circleId: string }) {
  const [invite, makeInvite, invitePending] = useActionState(inviteAction, initial);
  return <div>
    <p className="text-sm text-muted">Up to three family members can join this circle.</p>
    <form action={makeInvite} className="mt-3"><input type="hidden" name="circleId" value={circleId} />
      <button disabled={invitePending} className={`${quietButton} w-full`}>Create invite code</button></form>
    <Feedback state={invite} /><Code label="Invite code" code={invite.code} expiresAt={invite.expiresAt} />
  </div>;
}

export function PairingForm({ circleId, firstName }: { circleId: string; firstName: string }) {
  const [pairing, makePairing, pairingPending] = useActionState(pairingAction, initial);
  const [unpair, unpairNow, unpairPending] = useActionState(unpairAction, initial);
  return <div>
    <p className="text-sm text-muted">A one-time code connects {firstName}’s iPhone to the family circle.</p>
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <form action={makePairing}><input type="hidden" name="circleId" value={circleId} />
        <button disabled={pairingPending} className={`${quietButton} w-full`}>Create pairing code</button></form>
      <form action={unpairNow} onSubmit={(event) => { if (!confirm('Unpair their phone? It stops checking payments until you pair it again.')) event.preventDefault(); }}>
        <input type="hidden" name="circleId" value={circleId} />
        <button disabled={unpairPending} className={`${quietButton} w-full`}>Unpair their phone</button></form>
    </div>
    <Feedback state={pairing} /><Code label="Pairing code" code={pairing.code} expiresAt={pairing.expiresAt} />
    <Feedback state={unpair} />
  </div>;
}
