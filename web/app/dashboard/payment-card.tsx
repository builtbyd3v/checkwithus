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
  expired: { label: 'Expired, blocked', className: 'bg-background text-foreground' },
  failed: { label: 'Bank error', className: 'bg-background text-foreground' },
};
const stateOf = (status: string) => STATES[status] ?? { label: status, className: 'bg-background text-foreground' };

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
    <rect width="100" height="1" className="fill-surface" />
    <rect width={Math.max(2, Math.min(100, percent))} height="1" className={className} />
  </svg>;
}

export function PaymentCard({ payment, deadline, usual, sequence, children }: {
  payment: ReviewPayment; deadline?: ReactNode; usual?: Usual | null; sequence?: SequenceEvidence; children?: ReactNode;
}) {
  const state = stateOf(payment.status);
  const held = payment.status === 'held';
  const usualCents = usual ? toCents(Math.round(payment.amountCents / usual.times)) : null;
  return <article className="@container min-w-0 overflow-hidden rounded-3xl bg-surface">
    <div className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-3.5 font-semibold sm:px-7 ${state.className}`}>
      <span>{held ? `Paused. ${state.label}` : state.label}</span>
      {deadline && <span className="tabular-nums">{deadline}</span>}
    </div>
    <div className="px-5 pb-6 sm:px-7">
      <div className="mt-5 flex flex-wrap items-end justify-between gap-x-5 gap-y-2">
        <div className="min-w-0 flex-1 basis-48 [overflow-wrap:anywhere]">
          <p className="text-muted">{payment.protectedName} is paying</p>
          <h3 className="mt-0.5 text-[length:min(1.875rem,9cqi)] font-semibold leading-tight">{payment.payee.name}</h3>
          <p className="mt-1 text-muted">{payment.category.label}{payment.createdAt && <>, <time dateTime={payment.createdAt}>{clock.format(new Date(payment.createdAt))}</time></>}</p>
        </div>
        <strong className="shrink-0 font-heading text-[length:min(3.5rem,16cqi)] font-semibold leading-none tracking-[-.035em] tabular-nums">{formatCents(payment.amountCents)}</strong>
      </div>

      {usual && usualCents !== null && <div className="mt-5 rounded-2xl bg-background px-5 py-4">
        <p className="text-lg font-semibold">{usual.line}</p>
        <dl className="mt-2 grid gap-2">
          <div><div className="flex flex-wrap justify-between gap-x-3"><dt className="text-muted">{usual.kind === 'payee' ? 'Usual payment' : 'Usual day'}</dt>
            <dd className="font-semibold tabular-nums">about {formatCents(usualCents)}</dd></div>
            <dd className="mt-1"><Bar percent={100 / usual.times} className="fill-muted" /></dd></div>
          <div><div className="flex flex-wrap justify-between gap-x-3"><dt className="text-muted">This payment</dt>
            <dd className="font-semibold tabular-nums">{formatCents(payment.amountCents)}</dd></div>
            <dd className="mt-1"><Bar percent={100} className="fill-pause" /></dd></div>
        </dl>
      </div>}

      <p className="mt-5 max-w-[65ch] leading-7">{payment.explanation || 'This payment triggered a safety rule and needs a family decision.'}</p>
      {payment.holdReasons.length > 0 && <>
        <h4 className="mt-5 font-heading text-lg font-semibold">Why we paused it</h4>
        <ul className="mt-2 grid gap-2 @md:grid-cols-2" aria-label="Reasons for hold">{payment.holdReasons.map((reason) =>
          <li key={reason.code} className="max-w-full rounded-2xl bg-background px-4 py-3 font-semibold [overflow-wrap:anywhere]">{reason.label}</li>)}</ul>
      </>}
      {sequence && <section aria-label="Cash then gift card sequence" className="mt-4 rounded-2xl bg-pause-field px-5 py-4">
        <h4 className="font-heading text-lg font-semibold text-pause">Cash, then a gift card</h4>
        <ol className="mt-2 list-decimal space-y-2 pl-5">
          <li><strong>{formatCents(sequence.cashCents)} cash</strong> at <span className="[overflow-wrap:anywhere]">{sequence.atmName}</span><br />
            <time dateTime={sequence.cashAt} className="text-muted">{clock.format(new Date(sequence.cashAt))}</time></li>
          <li><strong>{formatCents(payment.amountCents)} gift card request</strong><br />
            <time dateTime={sequence.paymentAt} className="text-muted">{clock.format(new Date(sequence.paymentAt))}</time></li>
        </ol>
        <p className="mt-3">These happened within two hours. Call {payment.protectedName} before deciding.</p>
      </section>}
      {held && payment.approvalsRequired > 1 && <p className="mt-4 font-semibold">This payment needs {payment.approvalsRequired} different family approvers.</p>}
      {children}
      {held && <p className="mt-4 text-muted">If nobody answers in time, the payment is blocked and {payment.protectedName} keeps the money.</p>}
    </div>
  </article>;
}
