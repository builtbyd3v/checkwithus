import type { ReactNode } from 'react';
import { formatCents } from '@/lib/money';
import type { familyPaymentView } from '@/lib/views';
import type { SequenceEvidence } from '@/lib/scam-sequence';

/** Words accompany every colour so a decision is understandable without colour. */
const STATES: Record<string, { label: string; className: string }> = {
  held: { label: 'Waiting for family', className: 'bg-amber-100 text-amber-950 ring-amber-900/20' },
  approved: { label: 'Approved', className: 'bg-teal-100 text-family-ink ring-teal-900/20' },
  paying: { label: 'Approved, sending', className: 'bg-teal-100 text-family-ink ring-teal-900/20' },
  paid: { label: 'Paid', className: 'bg-teal-100 text-family-ink ring-teal-900/20' },
  denied: { label: 'Denied', className: 'bg-rose-100 text-rose-950 ring-rose-900/20' },
  expired: { label: 'Expired, blocked', className: 'bg-stone-200 text-family-ink ring-stone-900/20' },
  failed: { label: 'Bank error', className: 'bg-stone-200 text-family-ink ring-stone-900/20' },
};

export function StateBadge({ status }: { status: string }) {
  const state = STATES[status] ?? { label: status, className: 'bg-family-canvas text-family-ink ring-stone-900/10' };
  return <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${state.className}`}>{state.label}</span>;
}

export type ReviewPayment = Pick<ReturnType<typeof familyPaymentView>,
  'status' | 'protectedName' | 'payee' | 'amountCents' | 'explanation' | 'holdReasons' | 'approvalsRequired'>;

/** Shared with the local gallery so screenshots exercise the production layout. */
// ponytail: the demo family is in Gainesville; use the circle's time_zone if families span zones.
const clock = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' });

export function PaymentCard({ payment, deadline, usualLine, sequence, children }: {
  payment: ReviewPayment; deadline?: ReactNode; usualLine?: string | null; sequence?: SequenceEvidence; children?: ReactNode;
}) {
  return <article className="@container min-w-0 rounded-[18px] border border-family-line bg-white p-6 sm:p-7">
    <div className="flex flex-wrap items-center justify-between gap-2"><StateBadge status={payment.status} />
      {deadline && <p className="text-sm font-semibold text-amber-950">{deadline}</p>}</div>
    <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 flex-1 basis-40 [overflow-wrap:anywhere]"><p className="text-sm text-family-muted">{payment.protectedName} is paying</p><h3 className="mt-1 text-xl font-semibold">{payment.payee.name}</h3></div>
      <strong className="shrink-0 text-[length:min(1.875rem,16cqi)] tracking-tight tabular-nums">{formatCents(payment.amountCents)}</strong>
    </div>
    {usualLine && <p className="mt-3 text-base font-semibold text-rose-900">{usualLine}</p>}
    <p className="mt-3 text-sm leading-6 text-family-body">{payment.explanation || 'This payment triggered a safety rule and needs a family decision.'}</p>
    <ul className="mt-4 space-y-2 border-l-2 border-family-line pl-3" aria-label="Reasons for hold">{payment.holdReasons.map((reason) => <li key={reason.code} className="max-w-full text-sm font-medium text-family-body [overflow-wrap:anywhere]">{reason.label}</li>)}</ul>
    {sequence && <section aria-label="Cash then gift card sequence" className="mt-4 rounded-lg border border-amber-900/20 bg-amber-50 p-4 text-sm text-amber-950">
      <h4 className="font-semibold">Cash, then a gift card</h4>
      <ol className="mt-2 list-decimal space-y-2 pl-5">
        <li><strong>{formatCents(sequence.cashCents)} cash</strong> at <span className="[overflow-wrap:anywhere]">{sequence.atmName}</span><br />
          <time dateTime={sequence.cashAt}>{clock.format(new Date(sequence.cashAt))}</time></li>
        <li><strong>{formatCents(payment.amountCents)} gift card request</strong><br />
          <time dateTime={sequence.paymentAt}>{clock.format(new Date(sequence.paymentAt))}</time></li>
      </ol>
      <p className="mt-3">These happened within two hours. Call {payment.protectedName} before deciding.</p>
    </section>}
    {payment.status === 'held' && payment.approvalsRequired > 1 && <p className="mt-4 text-sm font-semibold text-family-body">This payment needs {payment.approvalsRequired} different family approvers.</p>}
    {children}
  </article>;
}
