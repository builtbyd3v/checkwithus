import type { ReactNode } from 'react';
import { formatCents, toCents } from '@/lib/money';
import type { familyPaymentView } from '@/lib/views';
import type { SequenceEvidence } from '@/lib/scam-sequence';

/** Words accompany every colour so a decision is understandable without colour. */
const STATES: Record<string, { label: string; className: string }> = {
  held: { label: 'Waiting for family', className: 'bg-pause-field text-pause' },
  approved: { label: 'Approved', className: 'bg-safe-field text-foreground' },
  paying: { label: 'Approved, sending', className: 'bg-safe-field text-foreground' },
  paid: { label: 'Paid', className: 'bg-safe-field text-foreground' },
  denied: { label: 'Denied', className: 'bg-stop-field text-stop' },
  expired: { label: 'Expired, blocked', className: 'bg-surface text-foreground dark:bg-white/[.06]' },
  failed: { label: 'Bank error', className: 'bg-surface text-foreground dark:bg-white/[.06]' },
};
const stateOf = (status: string) => STATES[status] ?? { label: status, className: 'bg-surface text-foreground dark:bg-white/[.06]' };

export function StateBadge({ status }: { status: string }) {
  const state = stateOf(status);
  return <span className={`inline-flex items-center rounded-full px-3 py-0.5 font-semibold ${state.className}`}>{state.label}</span>;
}

export type ReviewPayment = Pick<ReturnType<typeof familyPaymentView>,
  'status' | 'protectedName' | 'payee' | 'amountCents' | 'explanation' | 'holdReasons' | 'approvalsRequired' | 'category' | 'createdAt'>;

/** "About 8x their usual", with the numbers behind it. Display only. */
export type Usual = { line: string; times: number; kind: 'payee' | 'daily' };

/** Shared with the local gallery so screenshots exercise the production layout. */
// ponytail: the demo family is in Gainesville; use the circle's time_zone if families span zones.
const clock = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' });

/** A filled bar, scaled with SVG so widths need no inline style. */
function Bar({ percent, className }: { percent: number; className: string }) {
  return <svg viewBox="0 0 100 1" preserveAspectRatio="none" aria-hidden="true" className="h-3 w-full rounded-full">
    <rect width="100" height="1" className="fill-[#e4e0eb] dark:fill-white/[.12]" />
    <rect width={Math.max(2, Math.min(100, percent))} height="1" className={className} />
  </svg>;
}

const pauseIcon = <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4.5 shrink-0"><path d="M7 5v10M13 5v10" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" /></svg>;

export function PaymentCard({ payment, deadline, usual, sequence, children }: {
  payment: ReviewPayment; deadline?: ReactNode; usual?: Usual | null; sequence?: SequenceEvidence; children?: ReactNode;
}) {
  const state = stateOf(payment.status);
  const held = payment.status === 'held';
  const usualCents = usual ? toCents(Math.round(payment.amountCents / usual.times)) : null;
  return <article className="@container min-w-0 overflow-hidden rounded-3xl bg-card">
    <div className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-3.5 font-semibold @md:px-7 ${state.className}`}>
      <span className="inline-flex items-center gap-2">{held && pauseIcon}{held ? `Paused, ${state.label.toLowerCase()}` : state.label}</span>
      {deadline && <span className="tabular-nums">{deadline}</span>}
    </div>
    <div className="px-5 pb-5 @md:px-7 @md:pb-[26px]">
      <div className="mt-4 flex flex-wrap items-end justify-between gap-x-5 gap-y-2 @md:mt-6">
        <div className="min-w-0 flex-1 basis-48 [overflow-wrap:anywhere]">
          <p className="text-sm text-muted">{payment.protectedName} is paying</p>
          <h3 className="my-0.5 text-[length:min(1.875rem,7.5cqi)] font-extrabold leading-tight">{payment.payee.name}</h3>
          <p className="text-sm text-muted">{payment.category.label}{payment.createdAt && <>, <time dateTime={payment.createdAt}>{clock.format(new Date(payment.createdAt))}</time></>}</p>
        </div>
        <strong className="shrink-0 text-[length:min(3.5rem,13cqi)] font-semibold leading-none tracking-[-.04em] tabular-nums">{formatCents(payment.amountCents)}</strong>
      </div>

      {usual && usualCents !== null && <div className="mt-4 rounded-[18px] bg-surface p-3.5 @md:mt-[22px] @md:px-5 @md:py-[18px] dark:bg-white/[.06]">
        <p className="mb-2.5 text-lg font-bold">{usual.line}</p>
        <dl className="grid gap-1.5 text-sm">
          <div className="grid grid-cols-[6rem_minmax(0,1fr)_auto] items-center gap-2 @md:grid-cols-[9.375rem_minmax(0,1fr)_minmax(5.5rem,auto)] @md:gap-3.5">
            <dt className="leading-tight text-muted">{usual.kind === 'payee' ? 'Their usual payment' : 'Their usual day'}</dt>
            <dd><Bar percent={100 / usual.times} className="fill-muted" /></dd>
            <dd className="text-right text-base font-semibold tabular-nums">about {formatCents(usualCents)}</dd></div>
          <div className="grid grid-cols-[6rem_minmax(0,1fr)_auto] items-center gap-2 @md:grid-cols-[9.375rem_minmax(0,1fr)_minmax(5.5rem,auto)] @md:gap-3.5">
            <dt className="leading-tight text-muted">This payment</dt>
            <dd><Bar percent={100} className="fill-[#e58a1f]" /></dd>
            <dd className="text-right text-base font-semibold tabular-nums">{formatCents(payment.amountCents)}</dd></div>
        </dl>
      </div>}

      <p className="mt-5 max-w-[65ch] leading-7">{payment.explanation || 'This payment triggered a safety rule and needs a family decision.'}</p>
      {payment.holdReasons.length > 0 && <>
        <h4 className="mb-3 mt-6 text-lg font-extrabold">Why we paused it</h4>
        <ul className="flex flex-wrap gap-1.5 @md:grid @md:grid-cols-2 @md:gap-2.5" aria-label="Reasons for hold">{payment.holdReasons.map((reason) =>
          <li key={reason.code} className="max-w-full rounded-[14px] bg-surface px-3 py-1.5 text-sm font-medium [overflow-wrap:anywhere] @md:rounded-2xl @md:px-4 @md:py-3.5 @md:text-base @md:font-semibold dark:bg-white/[.06]">{reason.label}</li>)}</ul>
      </>}
      {sequence && <section aria-label="Cash then gift card sequence" className="mt-2.5 rounded-2xl bg-pause-field px-4 py-3.5">
        <h4 className="text-lg font-extrabold text-pause">Cash, then a gift card</h4>
        <ol className="mt-2 list-decimal space-y-2 pl-5">
          <li><strong className="font-semibold">{formatCents(sequence.cashCents)} cash</strong> at <span className="[overflow-wrap:anywhere]">{sequence.atmName}</span><br />
            <time dateTime={sequence.cashAt} className="text-sm text-muted">{clock.format(new Date(sequence.cashAt))}</time></li>
          <li><strong className="font-semibold">{formatCents(payment.amountCents)} gift card request</strong><br />
            <time dateTime={sequence.paymentAt} className="text-sm text-muted">{clock.format(new Date(sequence.paymentAt))}</time></li>
        </ol>
        <p className="mt-3">These happened within two hours. Call {payment.protectedName} before deciding.</p>
      </section>}
      {held && payment.approvalsRequired > 1 && <p className="mt-4 font-semibold">This payment needs {payment.approvalsRequired} different family approvers.</p>}
      {children}
      {held && <p className="mt-3.5 text-sm text-muted">If nobody answers in time, the payment is blocked and {payment.protectedName} keeps the money.</p>}
    </div>
  </article>;
}
