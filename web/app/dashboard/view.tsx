import Link from 'next/link';
import type { ReactNode } from 'react';
import { formatCents, toCents } from '@/lib/money';
import type { SequenceEvidence } from '@/lib/scam-sequence';
import type { Speed } from '@/lib/speed';
import type { familyPaymentView } from '@/lib/views';
import type { FormState } from './actions';
import { Countdown, DecisionButtons, DecisionStatus, FreezeControl, HoldLimitForm, InviteForm, PairingForm, PayeeForm } from './controls';
import { DecisionForm } from './decision-ui';
import { alertHeadline, dayHeading, localDay, moneyProtected, monthOf, speedHeadline, timeAgo, timeOfDay, usualWeekCents } from './format';
import { OverviewSummary, type Stat } from './overview-summary';
import { PaymentCard, type Usual } from './payment-card';

export type ViewPayment = ReturnType<typeof familyPaymentView>;
export type ViewAlert = { id: string; kind: string; detail: string | null; createdAt: string };

/** Everything the page already loads, shaped for display. Shared with the local preview so screenshots show the real layout. */
export type DashboardData = {
  now: Date;
  firstName: string;
  circles: { circleId: string; protectedName: string }[];
  activeCircleId: string;
  role: 'approver' | 'viewer';
  canApproveHere: boolean;
  frozen: boolean;
  vaultCents: number;
  holdDollars: string;
  twoApprovalsDollars: string;
  approverCount: number;
  held: ViewPayment[];
  recent: ViewPayment[];
  alerts: ViewAlert[];
  /** 13 weekly totals in cents, oldest first; the last is this week. */
  weeks: number[];
  /** Largest first. */
  categories: { label: string; cents: number }[];
  usual: Map<string, Usual>;
  sequences: Map<string, SequenceEvidence>;
  speed: Speed | null;
  benchmarkLine: string;
  members: { id: string; display_name: string }[];
  payees: { id: string; name: string; categoryLabel: string }[];
  /** Local preview only: a synthetic decision instead of the real server action. */
  decide?: (state: FormState, form: FormData) => Promise<FormState>;
};

const money = (cents: number) => formatCents(toCents(cents));
const ms = (value: number) => value < 10 ? value.toFixed(2) : value.toFixed(0);
const panel = 'min-w-0 rounded-3xl bg-card p-5 sm:p-7';
/** An inset tile inside a panel. */
const tile = 'bg-surface dark:bg-white/[.06]';
const panelTitle = 'text-[1.375rem] font-extrabold leading-tight';
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

/** What the bill-pay agent did, in the family's words; nothing for a no, a lapse or a failure. */
function agentLabel(payment: ViewPayment) {
  if (payment.status === 'paid') {
    return payment.allowanceId ? `Paid by the bill agent under your ${payment.category.label} allowance` : 'Paid by the bill agent';
  }
  return ['held', 'approved', 'paying'].includes(payment.status) ? 'Asked by the bill agent' : null;
}

type Who = 'side' | 'family' | 'agent';
type FeedEvent = { id: string; at: Date; who: Who; tag?: { label: string; className: string; icon?: ReactNode }; title: string; sub: string; cents?: number };
const DOTS: Record<Who, string> = { side: 'bg-sun', family: 'bg-action', agent: 'bg-muted' };
const TAGS = {
  paused: { label: 'Paused', className: 'bg-pause-field text-pause', icon: <svg viewBox="0 0 20 20" aria-hidden="true" className="size-3.5"><path d="M7 5v10M13 5v10" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" /></svg> },
  stopped: { label: 'Denied', className: 'bg-stop-field text-stop', icon: <svg viewBox="0 0 20 20" aria-hidden="true" className="size-3.5"><circle cx="10" cy="10" r="6.6" fill="none" stroke="currentColor" strokeWidth="2.2" /><path d="M5.4 14.6l9.2-9.2" stroke="currentColor" strokeWidth="2.2" /></svg> },
  blocked: { label: 'Blocked', className: `${tile} text-foreground` },
  alert: { label: 'Alert', className: 'bg-stop-field text-stop' },
};

function paymentEvent(payment: ViewPayment, now: Date): FeedEvent {
  const by = payment.decidedByName ?? 'the family';
  const base = {
    id: payment.id, title: payment.payee.name, cents: payment.amountCents,
    at: new Date(payment.decidedAt ?? payment.createdAt ?? now),
    who: (payment.initiatedBy === 'agent' ? 'agent' : 'side') as Who,
  };
  switch (payment.status) {
    case 'held': return { ...base, tag: TAGS.paused, sub: `${plural(payment.holdReasons.length, 'reason')}. Waiting for a family decision.` };
    case 'denied': return { ...base, who: 'family', tag: TAGS.stopped, sub: `Denied by ${by}.` };
    case 'expired': return { ...base, who: 'family', tag: TAGS.blocked, sub: 'Nobody answered in time, so it was blocked.' };
    case 'approved': case 'paying': return { ...base, who: 'family', sub: `Approved by ${by}.` };
    case 'failed': return { ...base, sub: 'Bank error. Not paid.' };
    default: {
      const agent = payment.initiatedBy === 'agent' ? agentLabel(payment) : null;
      return { ...base, sub: agent ? `${agent}.` : payment.decidedByName ? `Paid after ${by} approved.` : `Paid. ${payment.category.label}.` };
    }
  }
}

/** One self-scaling SVG so bar heights need no inline style. Text stays in HTML so it never scales. */
function WeeklyChart({ weeks, heldCents, usualCents }: { weeks: number[]; heldCents: number; usualCents: number }) {
  const thisWeek = weeks.at(-1) ?? 0;
  const top = Math.max(1, ...weeks, thisWeek + heldCents, usualCents) * 1.08;
  const y = (cents: number) => 100 - (cents / top) * 100;
  const last = weeks.length - 1;
  return <svg viewBox={`0 0 ${weeks.length * 10} 100`} preserveAspectRatio="none" aria-hidden="true" className="mt-6 h-48 w-full overflow-visible">
    {[25, 50, 75].map((line) => <line key={line} x1="0" x2={weeks.length * 10} y1={line} y2={line} strokeWidth="1" vectorEffect="non-scaling-stroke" className="stroke-[#e9e6ef] dark:stroke-[#2a2531]" />)}
    <line x1="0" x2={weeks.length * 10} y1="100" y2="100" strokeWidth="2" vectorEffect="non-scaling-stroke" className="stroke-[#e4e0eb] dark:stroke-[#302a39]" />
    {weeks.map((cents, index) => cents > 0 && <rect key={index} x={index * 10 + 2} width="6" y={y(cents)} height={100 - y(cents)} className="fill-action" />)}
    {heldCents > 0 && <rect x={last * 10 + 2.5} width="5" y={y(thisWeek + heldCents)} height={(heldCents / top) * 100 - 1.5}
      strokeWidth="2" strokeDasharray="5 4" vectorEffect="non-scaling-stroke" className="fill-pause-field stroke-[#e58a1f]" />}
    {usualCents > 0 && <line x1="0" x2={weeks.length * 10} y1={y(usualCents)} y2={y(usualCents)} strokeWidth="2" strokeDasharray="2 6" strokeLinecap="round"
      vectorEffect="non-scaling-stroke" className="stroke-foreground opacity-70" />}
  </svg>;
}

/** A filled bar, scaled with SVG so widths need no inline style. */
function Meter({ percent, className }: { percent: number; className: string }) {
  return <svg viewBox="0 0 100 1" preserveAspectRatio="none" aria-hidden="true" className="h-2.5 w-full rounded-full">
    <rect width="100" height="1" className="fill-surface dark:fill-white/[.06]" /><rect width={Math.max(2, Math.min(100, percent))} height="1" className={className} />
  </svg>;
}

function SafeChip({ label, tone }: { label: string; tone: 'safe' | 'pause' }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full py-1 pl-[9px] pr-3 font-semibold ${tone === 'safe' ? 'bg-safe-field text-[#1b7341] dark:text-safe' : 'bg-pause-field text-pause'}`}>
    <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4.5">
      {tone === 'safe' ? <path d="M4.5 10.5l3.5 3.5 7.5-8" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        : <path d="M7 5v10M13 5v10" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />}
    </svg>{label}</span>;
}

function Avatar({ name, side }: { name: string; side?: boolean }) {
  return <span aria-hidden="true" className={`inline-grid size-10 shrink-0 place-items-center rounded-full font-bold ${side ? 'bg-sun text-on-sun' : 'bg-action text-white'}`}>
    {name.trim().charAt(0).toUpperCase()}</span>;
}

export function DashboardView(data: DashboardData) {
  const { now, firstName, held, recent, role } = data;
  const today = localDay(now);
  const alertsToday = data.alerts.filter((alert) => localDay(new Date(alert.createdAt)) === today);
  const { deniedCents, heldCents } = moneyProtected(recent, held, now);
  const total = data.categories.reduce((sum, row) => sum + row.cents, 0);
  const usualWeek = usualWeekCents(data.weeks);
  const waitingLabel = role === 'approver' ? 'waiting for you' : 'waiting for the family';

  const status = data.frozen
    ? { chip: <SafeChip label="Frozen" tone="pause" />, title: `${firstName}’s money is frozen.`,
      lead: `${money(data.vaultCents)} is safe in the vault. Every payment waits for the family until you unfreeze.` }
    : held.length
      ? { chip: <SafeChip label={role === 'approver' ? 'Needs you' : 'Waiting'} tone="pause" />, title: role === 'approver'
        ? (held.length === 1 ? 'One payment needs your answer.' : `${held.length} payments need your answer.`)
        : (held.length === 1 ? 'One payment is waiting.' : `${held.length} payments are waiting.`),
        lead: `${held.length === 1 ? 'One payment is' : `${held.length} payments are`} paused and ${waitingLabel}. The money stays put until someone in the family decides.` }
      : alertsToday.length
        ? { chip: <SafeChip label="Check in" tone="pause" />, title: `${firstName} may need a call.`,
          lead: `${plural(alertsToday.length, 'alert')} from ${firstName}’s phone today. No payment is waiting for a decision.` }
        : { chip: <SafeChip label="Safe" tone="safe" />, title: `${firstName} is safe.`,
          lead: 'Nothing needs you right now. Held payments and alerts show up here first.' };

  const alertKinds = [...new Set(alertsToday.map((alert) => alert.kind === 'ask_family' ? 'Asked for a call' : 'Bank during a call'))];
  const stats: Stat[] = [
    { label: role === 'approver' ? 'Waiting for you' : 'Waiting for family', value: String(held.length), unit: held.length === 1 ? 'payment' : 'payments',
      note: held.length ? 'Review now' : 'Nothing to decide', href: held.length ? '#held' : undefined, tone: held.length ? 'pause' : undefined },
    { label: `Protected in ${monthOf(now)}`, value: money(deniedCents + heldCents), note: `${money(deniedCents)} denied, ${money(heldCents)} paused` },
    { label: 'Alerts today', value: String(alertsToday.length), note: alertKinds.length ? alertKinds.join(', ') : 'Nothing from the phone' },
    { label: 'Spending, 90 days', value: money(total), note: `${data.categories.length} ${data.categories.length === 1 ? 'category' : 'categories'}` },
  ];

  const events = [
    ...recent.slice(0, 12).map((payment) => paymentEvent(payment, now)),
    ...data.alerts.slice(0, 5).flatMap((alert): FeedEvent[] => {
      const headline = alertHeadline(alert, firstName);
      return headline ? [{ id: alert.id, at: new Date(alert.createdAt), who: 'side', tag: TAGS.alert, title: headline,
        sub: 'From their phone.' }] : [];
    }),
  ].sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, 10);
  const days: { day: string; events: FeedEvent[] }[] = [];
  for (const event of events) {
    const day = dayHeading(event.at, now);
    if (days.at(-1)?.day === day) days.at(-1)!.events.push(event); else days.push({ day, events: [event] });
  }
  const whoName: Record<Who, string> = { side: firstName, family: 'Family', agent: 'Bill agent' };

  const paidByPayee = new Map<string, { cents: number; count: number; last: Date }>();
  for (const payment of recent) {
    if (!['paid', 'approved', 'paying'].includes(payment.status)) continue;
    const at = new Date(payment.createdAt ?? now);
    const row = paidByPayee.get(payment.payee.name) ?? { cents: 0, count: 0, last: at };
    paidByPayee.set(payment.payee.name, { cents: row.cents + payment.amountCents, count: row.count + 1, last: at > row.last ? at : row.last });
  }

  const decision = (payment: ViewPayment): ReactNode => {
    if (role !== 'approver') return <p className="mt-6 font-semibold">An approver in your family decides this.</p>;
    return data.decide
      ? <DecisionForm paymentId={payment.id} canApproveHere={data.canApproveHere} decideAction={data.decide} expiresAt={payment.expiresAt} />
      : <DecisionButtons paymentId={payment.id} canApproveHere={data.canApproveHere} expiresAt={payment.expiresAt} />;
  };

  return <main className="mx-auto max-w-[1280px] px-4 pb-16 sm:px-10">
    <section aria-labelledby="status-title" className="grid gap-8 rounded-3xl bg-[#f1e4fc] px-5 py-[18px] sm:rounded-[28px] sm:p-11 lg:grid-cols-[1.15fr_1fr] lg:gap-12 dark:bg-[#221632]">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-x-3.5 gap-y-2">{status.chip}<span className="text-sm text-muted">Updated {timeOfDay(now)}</span></p>
        <h1 id="status-title" className="mb-1.5 mt-3.5 text-[2.5rem] font-extrabold leading-none sm:mb-4 sm:mt-5 sm:text-[4rem]">{status.title}</h1>
        <p className="max-w-[30ch] text-lg leading-snug tracking-[-.01em] sm:text-[1.375rem] sm:leading-[1.35]">{status.lead}</p>
        {data.circles.length > 1 && <nav aria-label="Family circles" className="mt-6 flex flex-wrap gap-2">{data.circles.map((item) =>
          <Link key={item.circleId} href={`/dashboard?circle=${item.circleId}`} aria-current={item.circleId === data.activeCircleId ? 'page' : undefined}
            className={`inline-flex min-h-11 items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3.5 font-semibold ${item.circleId === data.activeCircleId ? 'bg-action text-white' : 'bg-card hover:bg-card/70'}`}>
            <span aria-hidden="true" className="inline-grid size-[30px] place-items-center rounded-full bg-sun text-sm font-bold text-on-sun">{item.protectedName.trim().charAt(0).toUpperCase()}</span>{item.protectedName}</Link>)}</nav>}
      </div>
      <OverviewSummary stats={stats} className="hidden self-start sm:grid" />
    </section>

    <div className="mt-3 grid items-start gap-3 sm:mt-6 sm:gap-6 lg:grid-cols-12">
      <section id="held" aria-labelledby="held-title" className="min-w-0 scroll-mt-6 lg:col-span-7">
        <h2 id="held-title" className={held.length ? 'sr-only' : `${panelTitle} mt-3 sm:mt-0`}>{held.length ? 'Needs a decision' : 'Nothing is waiting'}</h2>
        <DecisionStatus key={data.activeCircleId} />
        {held.length > 0 ? <ul role="list" className="grid gap-6">{held.map((payment) => <li key={payment.id} className="min-w-0">
          <PaymentCard payment={payment} usual={data.usual.get(payment.id)} sequence={data.sequences.get(payment.id)}
            deadline={payment.expiresAt ? <Countdown expiresAt={payment.expiresAt} /> : null}>{decision(payment)}</PaymentCard></li>)}</ul>
          : <p className={`${panel} mt-3`}>When a payment needs a family decision, it shows here with the reasons. Until then, {firstName}’s money moves as usual.</p>}
      </section>

      <OverviewSummary stats={stats} className="sm:hidden" />

      <aside id="activity" aria-labelledby="activity-title" className={`${panel} flex scroll-mt-6 flex-col lg:col-span-5`}>
        <h2 id="activity-title" className={panelTitle}>Activity</h2>
        {days.length ? days.map((group) => <div key={group.day}>
          <h3 className="mb-1.5 mt-4 text-base font-semibold text-muted">{group.day}</h3>
          <ol>{group.events.map((event) => <li key={event.id}
            className="grid grid-cols-[0.75rem_minmax(0,1fr)] items-start gap-x-3 py-2.5 sm:grid-cols-[4.375rem_0.875rem_minmax(0,1fr)_auto]">
            <time dateTime={event.at.toISOString()} className="pt-px text-sm text-muted tabular-nums max-sm:hidden">{timeOfDay(event.at)}</time>
            <span aria-hidden="true" className={`mt-1.5 size-3 rounded-full ${DOTS[event.who]}`} />
            <span className="min-w-0 [overflow-wrap:anywhere]">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold">{event.tag &&
                <span className={`inline-flex items-center gap-1 rounded-full py-px pl-[7px] pr-2.5 text-sm font-medium ${event.tag.className}`}>{event.tag.icon}{event.tag.label}</span>}{event.title}</span>
              <span className="block text-sm text-muted"><span className="font-semibold text-foreground">{whoName[event.who]}.</span> {event.sub}
                <span className="sm:hidden"> {timeOfDay(event.at)}.</span></span>
            </span>
            <span className="whitespace-nowrap font-semibold tabular-nums max-sm:col-start-2">{event.cents !== undefined ? money(event.cents) : ''}</span>
          </li>)}</ol>
        </div>) : <p className="mt-3 text-muted">Nothing yet. Payments and alerts from {firstName}’s phone show up here.</p>}
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-[18px] text-sm text-muted">
          {(['side', 'family', 'agent'] as const).map((who) => <span key={who} className="inline-flex items-center gap-2">
            <span aria-hidden="true" className={`size-3 rounded-full ${DOTS[who]}`} />{who === 'side' ? `${firstName}’s side` : whoName[who]}</span>)}
        </p>
      </aside>

      <section aria-labelledby="spending-title" className={`${panel} lg:col-span-7`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0"><h2 id="spending-title" className={panelTitle}>Spending, last 90 days</h2>
            <p className="text-sm text-muted">Paid by week.{usualWeek > 0 && ` ${firstName}’s usual week is ${money(usualWeek)}.`}</p></div>
          <p className="min-w-0 sm:text-right [overflow-wrap:anywhere]"><span className="block text-[1.875rem] font-semibold leading-[1.1] tracking-[-.025em] tabular-nums">{money(total)}</span>
            <span className="text-sm text-muted">paid in 90 days</span></p>
        </div>
        <WeeklyChart weeks={data.weeks} heldCents={heldCents} usualCents={usualWeek} />
        <div className="mt-2 flex justify-between text-sm text-muted"><span>12 weeks ago</span><span>This week</span></div>
        <ul className="mt-3.5 flex flex-wrap gap-x-[22px] gap-y-2 text-sm text-muted [&>li]:flex-wrap">
          <li className="inline-flex items-center gap-2"><span aria-hidden="true" className="size-3 rounded-[3px] bg-action" />Paid</li>
          {heldCents > 0 && <li className="inline-flex items-center gap-2"><span aria-hidden="true" className="size-3 rounded-[3px] border-2 border-dashed border-[#e58a1f] bg-pause-field" />
            Held, not paid <strong className="font-semibold text-foreground">{money(heldCents)}</strong></li>}
          {usualWeek > 0 && <li className="inline-flex items-center gap-2"><span aria-hidden="true" className="h-[3px] w-4 bg-foreground opacity-70" />
            Usual week <strong className="font-semibold text-foreground">{money(usualWeek)}</strong></li>}
        </ul>
        {data.categories.length > 0 && <ul aria-label="By category" className="mt-5 flex flex-wrap gap-2">{data.categories.slice(0, 6).map((row) =>
          <li key={row.label} className={`rounded-xl px-3.5 py-1.5 text-sm ${tile}`}>{row.label} <strong className="ml-1 text-base font-semibold tabular-nums">{money(row.cents)}</strong></li>)}</ul>}
        <details className="mt-4">
          <summary className="-mx-3 inline-flex min-h-11 cursor-pointer items-center rounded-full px-3 font-semibold text-link hover:bg-action/10">View weekly amounts</summary>
          <table className="mt-2 w-full text-left">
            <caption className="sr-only">Weekly spending, oldest to newest</caption>
            <thead><tr className="text-sm text-muted"><th scope="col" className="py-2 font-medium">Week</th><th scope="col" className="py-2 text-right font-medium">Amount</th></tr></thead>
            <tbody>{data.weeks.map((week, index) => <tr key={index}>
              <th scope="row" className="py-1.5 font-normal">{index === 12 ? 'This week' : index === 11 ? '1 week ago' : `${12 - index} weeks ago`}</th>
              <td className="py-1.5 text-right font-semibold tabular-nums">{money(week)}</td>
            </tr>)}</tbody>
          </table>
        </details>
      </section>

      <section id="payees" aria-labelledby="payees-title" className={`${panel} scroll-mt-6 ${data.speed ? 'lg:col-span-8' : 'lg:col-span-12'}`}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4"><h2 id="payees-title" className={panelTitle}>Known payees</h2>
          <p className="text-sm text-muted">Totals from recent payments</p></div>
        {data.payees.length ? <div className="overflow-x-auto"><table className="mt-3 w-full border-separate border-spacing-y-1.5 text-left">
          <thead><tr className="text-sm text-muted">
            <th scope="col" className="px-3 font-medium">Payee</th><th scope="col" className="px-3 font-medium max-sm:hidden">Last paid</th>
            <th scope="col" className="px-3 text-right font-medium">Total</th></tr></thead>
          <tbody>{data.payees.map((payee) => {
            const paid = paidByPayee.get(payee.name);
            return <tr key={payee.id}>
              <th scope="row" className={`rounded-l-[14px] px-3 py-3 font-normal [overflow-wrap:anywhere] ${tile}`}>
                <span className="block font-semibold">{payee.name}</span><span className="text-sm text-muted">{payee.categoryLabel}</span>
                <span className="block text-sm text-muted sm:hidden">{paid ? `Last paid ${timeAgo(paid.last, now)}` : 'Not paid recently'}</span></th>
              <td className={`px-3 py-3 max-sm:hidden ${tile}`}>{paid ? timeAgo(paid.last, now) : <span className="text-muted">Not recently</span>}</td>
              <td className={`rounded-r-[14px] px-3 py-3 text-right font-semibold tabular-nums ${tile}`}>{paid
                ? <>{money(paid.cents)}<span className="block text-sm font-normal text-muted">{plural(paid.count, 'payment')}</span></> : <span className="font-normal text-muted">None</span>}</td>
            </tr>;
          })}</tbody>
        </table></div> : <p className="mt-3 text-muted">None yet. Add one under Family and settings.</p>}
      </section>

      {data.speed && <section aria-labelledby="speed-title" className={`${panel} lg:col-span-4 lg:self-stretch`}>
        <h2 id="speed-title" className={panelTitle}>Tiger Data speed</h2>
        <p className="mt-1 text-sm text-muted">The weekly chart above, timed on the Tiger Data server for {firstName}’s data, {timeAgo(data.speed.measuredAt, now)}.</p>
        <p className="mb-[18px] mt-[22px] flex flex-wrap items-baseline text-[3.5rem] font-semibold leading-none tracking-[-.04em] tabular-nums">{ms(data.speed.aggregateMs)}<span className="ml-2 text-base font-medium tracking-normal text-muted">ms</span></p>
        <dl className="grid gap-3 text-sm">
          <div><dt className="text-muted">From the weekly continuous aggregate</dt><dd className="mt-1 grid gap-1">
            <Meter percent={(data.speed.aggregateMs / Math.max(data.speed.rawMs, data.speed.aggregateMs)) * 100} className="fill-safe" /><strong className="text-base font-semibold tabular-nums">{ms(data.speed.aggregateMs)} ms</strong></dd></div>
          <div><dt className="text-muted">Same answer from raw payments</dt><dd className="mt-1 grid gap-1">
            <Meter percent={(data.speed.rawMs / Math.max(data.speed.rawMs, data.speed.aggregateMs)) * 100} className="fill-muted" /><strong className="text-base font-semibold tabular-nums">{ms(data.speed.rawMs)} ms</strong></dd></div>
        </dl>
        <p className="mt-[18px]"><strong className="font-semibold">{speedHeadline(data.speed)}</strong>{' '}
          {data.speed.compression ? `Compressed history, all families: ${(data.speed.compression.beforeBytes / data.speed.compression.afterBytes).toFixed(1)}x smaller.` : 'Nothing compressed yet.'}</p>
        <p className="mt-3 text-sm text-muted">One run each, at most once a minute. {data.benchmarkLine}</p>
      </section>}
    </div>

    <section id="setup" aria-labelledby="setup-title" className="scroll-mt-6">
      <h2 id="setup-title" className="mb-[18px] mt-12 text-[1.875rem] font-extrabold">Family and settings</h2>
      <div className="grid items-stretch gap-3 sm:gap-6 lg:grid-cols-[1fr_1.15fr_1.15fr]">
        <section aria-labelledby="money-title" className={panel}>
          <h3 id="money-title" className={`${panelTitle} mb-4`}>{firstName}’s money</h3>
          <dl className="mb-4 grid grid-cols-2 gap-3"><div className={`rounded-2xl px-4 py-3.5 ${tile}`}><dt className="text-sm text-muted">In the vault</dt>
            <dd className="text-[1.375rem] font-semibold tracking-[-.02em] tabular-nums">{money(data.vaultCents)}</dd></div></dl>
          {role === 'approver'
            ? <FreezeControl circleId={data.activeCircleId} frozen={data.frozen} firstName={firstName}
              vaultLabel={money(data.vaultCents)} vaultDollars={String(Math.floor(data.vaultCents / 100))} />
            : <p>An approver in your family can freeze spending during a scam.</p>}
        </section>
        <section aria-labelledby="rules-title" className={panel}>
          <h3 id="rules-title" className={`${panelTitle} mb-4`}>Rules</h3>
          <HoldLimitForm key={data.activeCircleId} circleId={data.activeCircleId} holdDollars={data.holdDollars}
            twoApprovalsDollars={data.twoApprovalsDollars} approverCount={data.approverCount} />
          <div className="mt-6"><PayeeForm circleId={data.activeCircleId} /></div>
        </section>
        <section aria-labelledby="people-title" className={panel}>
          <h3 id="people-title" className={`${panelTitle} mb-4`}>People</h3>
          <ul role="list" className="grid min-w-0 gap-2.5">
            {data.members.map((member) => <li key={member.id} className="flex items-center gap-3"><Avatar name={member.display_name} />
              <span className="min-w-0 font-semibold [overflow-wrap:anywhere]">{member.display_name}</span></li>)}
            <li className="flex flex-wrap items-center gap-3"><Avatar name={firstName} side /><span className="min-w-0 flex-1 font-semibold [overflow-wrap:anywhere]">{firstName}</span>
              <span className="rounded-full bg-sun px-3 py-[3px] text-sm font-semibold text-on-sun">Protected</span></li>
          </ul>
          <p className="mt-4 text-sm text-muted">{role === 'approver' ? 'You can approve and deny payments.' : 'You can see payments. An approver decides them.'}</p>
          <h4 className="mt-6 font-extrabold">Invite family</h4>
          <div className="mt-1"><InviteForm circleId={data.activeCircleId} /></div>
          <h4 className="mt-6 font-extrabold">Pair {firstName}’s phone</h4>
          <div className="mt-1"><PairingForm circleId={data.activeCircleId} firstName={firstName} /></div>
        </section>
      </div>
    </section>
    <footer className="mt-8 text-sm text-muted">Scam checks run on {firstName}’s iPhone. Their texts never leave it. Family decisions move money through fixed rules.</footer>
  </main>;
}
