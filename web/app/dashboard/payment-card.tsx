import type { ReactNode } from 'react';
import { formatCents } from '@/lib/money';
import type { familyPaymentView } from '@/lib/views';

/** Words accompany every colour so a decision is understandable without colour. */
const STATES: Record<string, { label: string; className: string }> = {
  held: { label: 'Waiting for family', className: 'bg-amber-100 text-amber-950 ring-amber-900/20' },
  approved: { label: 'Approved', className: 'bg-teal-100 text-teal-950 ring-teal-900/20' },
  paying: { label: 'Approved, sending', className: 'bg-teal-100 text-teal-950 ring-teal-900/20' },
  paid: { label: 'Paid', className: 'bg-teal-100 text-teal-950 ring-teal-900/20' },
  denied: { label: 'Denied', className: 'bg-rose-100 text-rose-950 ring-rose-900/20' },
  expired: { label: 'Expired, blocked', className: 'bg-stone-200 text-stone-900 ring-stone-900/20' },
  failed: { label: 'Bank error', className: 'bg-stone-200 text-stone-900 ring-stone-900/20' },
};

export function StateBadge({ status }: { status: string }) {
  const state = STATES[status] ?? { label: status, className: 'bg-stone-100 text-stone-800 ring-stone-900/10' };
  return <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${state.className}`}>{state.label}</span>;
}

export type ReviewPayment = Pick<ReturnType<typeof familyPaymentView>,
  'status' | 'protectedName' | 'payee' | 'amountCents' | 'explanation' | 'holdReasons' | 'approvalsRequired'>;

/** Shared with the local gallery so screenshots exercise the production layout. */
export function PaymentCard({ payment, deadline, usualLine, children }: {
  payment: ReviewPayment; deadline?: ReactNode; usualLine?: string | null; children?: ReactNode;
}) {
  return <article className="min-w-0 rounded-xl border border-teal-900/10 bg-white p-5">
    <div className="flex flex-wrap items-center justify-between gap-2"><StateBadge status={payment.status} />
      {deadline && <p className="text-sm font-semibold text-amber-950">{deadline}</p>}</div>
    <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 flex-1 basis-40 [overflow-wrap:anywhere]"><p className="text-sm text-stone-600">{payment.protectedName} is paying</p><h3 className="mt-1 text-xl font-semibold">{payment.payee.name}</h3></div>
      <strong className="shrink-0 text-xl tabular-nums">{formatCents(payment.amountCents)}</strong>
    </div>
    {usualLine && <p className="mt-3 text-base font-semibold text-rose-900">{usualLine}</p>}
    <p className="mt-3 text-sm leading-6 text-stone-700">{payment.explanation || 'This payment triggered a safety rule and needs a family decision.'}</p>
    <ul className="mt-4 flex flex-wrap gap-2" aria-label="Reasons for hold">{payment.holdReasons.map((reason) => <li key={reason.code} className="max-w-full rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-700 [overflow-wrap:anywhere]">{reason.label}</li>)}</ul>
    {payment.status === 'held' && payment.approvalsRequired > 1 && <p className="mt-4 text-sm font-semibold text-stone-700">This payment needs {payment.approvalsRequired} different family approvers.</p>}
    {children}
  </article>;
}
