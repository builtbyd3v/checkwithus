import Link from 'next/link';
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { auth0 } from '@/lib/auth0/web';
import { CATEGORY_LABELS, type Category } from '@/lib/categories';
import { db } from '@/lib/db';
import { familyAlerts, familyPayments, memberships } from '@/lib/family';
import { VAULT_CENTS_SQL } from '@/lib/vault';
import { formatCents, toCents } from '@/lib/money';
import { weeklySpending } from '@/lib/spending';
import { cibaApprovals, approvalsUseCiba, payments } from '@/lib/services';
import { cachedSpeed } from '@/lib/speed';
import { herUsual, usualLabel, type UsualRow } from '@/lib/usual';
import { Countdown, DecisionButtons, DecisionStatus, FreezeControl, JoinForm, SettingsForms } from './controls';
import { alertHeadline, timeAgo } from './format';

type SpendRow = { day: Date; category: Category; total_cents: string };
type CircleRow = { hold_over_cents: string; protected_name: string; frozen: boolean; vault_cents: number };
type MemberRow = { id: string; display_name: string };
type PayeeRow = { id: string; name: string; kind: string; category: Category };
const money = (cents: bigint | number | string) => formatCents(toCents(Number(cents)));

/** One look per payment state: colour plus words, never colour alone. */
const STATES: Record<string, { label: string; className: string }> = {
  held: { label: 'Waiting for family', className: 'bg-amber-100 text-amber-950 ring-amber-900/20' },
  approved: { label: 'Approved', className: 'bg-teal-100 text-teal-950 ring-teal-900/20' },
  paying: { label: 'Approved, sending', className: 'bg-teal-100 text-teal-950 ring-teal-900/20' },
  paid: { label: 'Paid', className: 'bg-teal-100 text-teal-950 ring-teal-900/20' },
  denied: { label: 'Denied', className: 'bg-rose-100 text-rose-950 ring-rose-900/20' },
  expired: { label: 'Expired, blocked', className: 'bg-stone-200 text-stone-900 ring-stone-900/20' },
  failed: { label: 'Bank error', className: 'bg-stone-200 text-stone-900 ring-stone-900/20' },
};
function StateBadge({ status }: { status: string }) {
  const state = STATES[status] ?? { label: status, className: 'bg-stone-100 text-stone-800 ring-stone-900/10' };
  return <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${state.className}`}>{state.label}</span>;
}
const ms = (value: number) => value < 10 ? value.toFixed(2) : value.toFixed(0);

export default function Dashboard(props: { searchParams: Promise<{ circle?: string }> }) {
  return <Suspense fallback={<main className="mx-auto max-w-7xl px-6 py-12" aria-busy="true"><p className="text-stone-600">Loading your family dashboard…</p></main>}>
    <DashboardContent {...props} />
  </Suspense>;
}

async function DashboardContent({ searchParams }: { searchParams: Promise<{ circle?: string }> }) {
  await connection();
  const session = await auth0.getSession();
  if (!session?.user.sub) redirect('/auth/login?returnTo=/dashboard');
  const circles = await memberships(db(), session.user.sub);
  if (!circles.length) return <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-16">
    <Link href="/" className="text-xl font-bold text-teal-950">checkwith.us</Link>
    <h1 className="mt-10 text-4xl font-semibold tracking-tight">Join your family circle</h1>
    <p className="mt-3 text-stone-600">Ask a family member for the invite code. Your account will then show the payments you can help review.</p>
    <JoinForm />
    <a href="/auth/logout" className="mt-8 text-sm font-medium text-teal-800 underline">Sign out</a>
  </main>;

  const requested = (await searchParams).circle;
  const active = circles.find((circle) => circle.circleId === requested) ?? circles[0]!;
  await cibaApprovals()?.pollCircles([active.circleId]);
  // Query holds independently: newer completed payments must not hide them.
  const heldQuery = familyPayments(db(), payments(), session.user.sub, { heldOnly: true, circleId: active.circleId });
  const [recent, held, spendResult, weekResult, circleResult, memberResult, payeeResult, alerts, speed, usualRows] = await Promise.all([
    familyPayments(db(), payments(), session.user.sub, { heldOnly: false, circleId: active.circleId }),
    heldQuery,
    db().query<SpendRow>(
      `select day, category, total_cents::text
         from spending_daily where circle_id = $1 and day >= now() - interval '90 days'
        order by day`, [active.circleId],
    ),
    weeklySpending(db(), active.circleId),
    db().query<CircleRow>(`select protected_name, hold_over_cents::text, frozen, ${VAULT_CENTS_SQL} as vault_cents
      from circles c where c.id = $1`, [active.circleId]),
    db().query<MemberRow>('select id, display_name from circle_members where circle_id = $1 order by created_at', [active.circleId]),
    db().query<PayeeRow>('select id, name, kind, category from payees where circle_id = $1 order by name', [active.circleId]),
    familyAlerts(db(), session.user.sub, active.circleId),
    // The card is a bonus: if timing fails, the dashboard still loads.
    cachedSpeed(db(), active.circleId),
    // Display only, so a failure just hides the line.
    heldQuery.then((rows) => herUsual(db(), active.circleId, rows.map((payment) => payment.id))).catch((): UsualRow[] => []),
  ]);
  const usual = new Map(usualRows.map((row) => [row.payment_id, row]));
  const circle = circleResult.rows[0]!;
  const firstName = circle.protected_name.split(' ')[0]!;
  const now = new Date();
  const alertRows = alerts.flatMap((alert) => {
    const headline = alertHeadline(alert, firstName);
    return headline ? [{ ...alert, headline }] : [];
  }).slice(0, 5);
  const decided = recent.filter((payment) => payment.holdReasons.length > 0 && payment.status !== 'held').slice(0, 4);
  const canApproveHere = !approvalsUseCiba();
  const categories = new Map<Category, bigint>();
  const weeks = Array<bigint>(13).fill(0n);
  for (const row of spendResult.rows) {
    categories.set(row.category, (categories.get(row.category) ?? 0n) + BigInt(row.total_cents));
  }
  for (const row of weekResult) {
    if (row.weeks_ago >= 0 && row.weeks_ago < weeks.length) weeks[12 - row.weeks_ago] = BigInt(row.total_cents);
  }
  const total = [...categories.values()].reduce((sum, cents) => sum + cents, 0n);
  const categoryRows = [...categories].sort((a, b) => a[1] > b[1] ? -1 : a[1] < b[1] ? 1 : 0);
  const largestCategory = categoryRows[0]?.[1] ?? 1n;
  const largestWeek = weeks.reduce((max, week) => week > max ? week : max, 1n);

  return <main className="min-h-screen bg-[#f7f5f0] text-stone-900">
    <div className="mx-auto max-w-7xl px-5 pb-20 pt-7 sm:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-200 pb-6">
        <Link href="/" className="text-xl font-bold tracking-tight text-teal-950">checkwith<span className="text-teal-700">.us</span></Link>
        <nav aria-label="Dashboard" className="flex items-center gap-5 text-sm font-semibold text-stone-600">
          <a href="#activity" className="hover:text-teal-800">Activity</a><a href="#setup" className="hover:text-teal-800">Setup</a>
          <a href="/auth/logout" className="hover:text-teal-800">Sign out</a>
        </nav>
      </header>
      <section className="flex flex-wrap items-end justify-between gap-6 py-9">
        <div><p className="text-sm font-bold uppercase tracking-[0.16em] text-teal-800">Family overview</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">Looking out for {firstName}</h1>
          <p className="mt-3 max-w-2xl text-stone-600">See what needs attention and how everyday spending is changing.</p></div>
        {circles.length > 1 && <div className="flex flex-wrap gap-2" aria-label="Family circles">{circles.map((item) =>
          <Link key={item.circleId} href={`/dashboard?circle=${item.circleId}`} aria-current={item.circleId === active.circleId ? 'page' : undefined}
            className={`rounded-full border px-4 py-2 text-sm font-medium ${item.circleId === active.circleId ? 'border-teal-800 bg-teal-800 text-white' : 'border-stone-300 bg-white text-stone-700'}`}>{item.protectedName}</Link>)}</div>}
      </section>

      {active.role === 'approver' && <FreezeControl circleId={active.circleId} frozen={circle.frozen} firstName={firstName}
        vaultLabel={money(circle.vault_cents)} vaultDollars={String(Math.floor(circle.vault_cents / 100))} />}
      <section aria-labelledby="attention-title" className="rounded-2xl border border-teal-900/15 bg-[#e6f0eb] p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-bold uppercase tracking-widest text-teal-800">Needs attention</p>
          <h2 id="attention-title" className="mt-1 text-2xl font-semibold">{held.length ? `${held.length} payment${held.length === 1 ? '' : 's'} waiting` : 'All clear right now'}</h2></div>
          <p className="max-w-md text-sm text-teal-950">{!held.length ? 'New held payments will appear here.'
            : active.role !== 'approver' ? 'An approver in your family decides these.'
            : canApproveHere ? 'Approve or deny here, or from the family app.' : 'Deny here. Approve from the Guardian notification on your phone.'}</p></div>
        <DecisionStatus />
        {held.length > 0 && <ul role="list" className="mt-6 grid gap-4 lg:grid-cols-2">{held.map((payment) => { const usualLine = usualLabel(usual.get(payment.id), payment.payee.name, firstName); return <li key={payment.id} className="rounded-xl border border-teal-900/10 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-2"><StateBadge status={payment.status} />
            <p className="text-sm font-semibold text-amber-950">{payment.expiresAt && <Countdown expiresAt={payment.expiresAt} />}</p></div>
          <div className="mt-3 flex flex-wrap items-start justify-between gap-4"><div className="min-w-0 flex-1 basis-40 [overflow-wrap:anywhere]"><p className="text-sm text-stone-600">{payment.protectedName} is paying</p><h3 className="mt-1 text-xl font-semibold">{payment.payee.name}</h3></div>
            <strong className="shrink-0 text-xl tabular-nums">{money(payment.amountCents)}</strong></div>
          {usualLine && <p className="mt-3 text-base font-semibold text-rose-900">{usualLine}</p>}
          <p className="mt-3 text-sm leading-6 text-stone-700">{payment.explanation || 'This payment triggered a safety rule and needs a family decision.'}</p>
          <ul className="mt-4 flex flex-wrap gap-2" aria-label="Reasons for hold">{payment.holdReasons.map((reason) => <li key={reason.code} className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-700">{reason.label}</li>)}</ul>
          {active.role === 'approver' && <DecisionButtons paymentId={payment.id} canApproveHere={canApproveHere} />}
        </li>; })}</ul>}
        {decided.length > 0 && <div className="mt-6"><h3 id="decided-title" tabIndex={-1} className="text-sm font-bold uppercase tracking-widest text-teal-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-800">Recently decided</h3>
          <ul role="list" className="mt-3 grid gap-3 lg:grid-cols-2">{decided.map((payment) => <li key={payment.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-teal-900/10 bg-white/70 px-5 py-4">
            <div><p className="font-semibold">{payment.payee.name} <span className="ml-1 font-normal tabular-nums text-stone-700">{money(payment.amountCents)}</span></p>
              <p className="mt-1 text-sm text-stone-700">{payment.status === 'expired' ? 'Nobody answered in time, so it was blocked'
                : payment.decidedByName ? `${payment.status === 'denied' ? 'Denied' : 'Approved'} by ${payment.decidedByName}` : 'Decided by the family'}
                {payment.decidedAt && `, ${timeAgo(new Date(payment.decidedAt), now)}`}</p></div>
            <StateBadge status={payment.status} /></li>)}</ul></div>}
      </section>

      <section aria-labelledby="alerts-title" className="mt-6 rounded-2xl border border-stone-200 bg-white p-5 sm:p-7">
        <h2 id="alerts-title" className="text-2xl font-semibold">Alerts from {firstName}’s phone</h2>
        {alertRows.length ? <ul role="list" className="mt-4 divide-y divide-stone-100">{alertRows.map((alert) => <li key={alert.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3">
          <p className="font-medium"><span aria-hidden="true" className={`mr-2 inline-block size-2.5 rounded-full ${alert.kind === 'bank_during_call' ? 'bg-rose-700' : 'bg-amber-600'}`} />{alert.headline}</p>
          <time dateTime={alert.createdAt} className="text-sm text-stone-600">{timeAgo(new Date(alert.createdAt), now)}</time></li>)}</ul>
          : <p className="mt-2 text-stone-700">No alerts. If {firstName} taps “Ask my family” or visits a bank during a phone call, it shows here.</p>}
      </section>

      <section id="activity" aria-labelledby="spending-title" className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-bold uppercase tracking-widest text-teal-800">Last 90 days</p>
          <h2 id="spending-title" className="mt-1 text-2xl font-semibold">Spending at a glance</h2></div>
          <p className="text-3xl font-semibold tabular-nums">{money(total)}</p></div>
        <div className="mt-5 grid gap-5 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="rounded-xl border border-stone-200 bg-white p-5"><h3 className="font-semibold">Weekly spending</h3>
            <div aria-hidden="true" className="mt-6 flex h-44 items-end gap-2 border-b border-stone-200 pb-1">{weeks.map((week, index) => <div key={index} className="group relative flex h-full flex-1 items-end">
              <div className="w-full rounded-t bg-teal-700/80" style={{ height: `${Math.max(week > 0n ? 5 : 0, Number(week * 100n / largestWeek))}%` }} />
              </div>)}</div>
            <div className="mt-2 flex justify-between text-xs text-stone-500"><span>12 weeks ago</span><span>This week</span></div>
            <details className="mt-4">
              <summary className="min-h-11 cursor-pointer rounded px-2 py-3 text-sm font-semibold text-teal-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800">View weekly amounts</summary>
              <table className="mt-2 w-full text-left text-sm">
                <caption className="sr-only">Weekly spending, oldest to newest</caption>
                <thead><tr><th scope="col" className="py-2 font-semibold">Week</th><th scope="col" className="py-2 text-right font-semibold">Amount</th></tr></thead>
                <tbody>{weeks.map((week, index) => <tr key={index} className="border-t border-stone-100">
                  <th scope="row" className="py-2 font-normal">{index === 12 ? 'This week' : index === 11 ? '1 week ago' : `${12 - index} weeks ago`}</th>
                  <td className="py-2 text-right tabular-nums">{money(week)}</td>
                </tr>)}</tbody>
              </table>
            </details>
          </div>
          <div className="rounded-xl border border-stone-200 bg-white p-5"><h3 className="font-semibold">By category</h3>
            {categoryRows.length ? <ul role="list" className="mt-5 space-y-4">{categoryRows.slice(0, 5).map(([category, cents]) => <li key={category}>
              <div className="flex justify-between gap-3 text-sm"><span>{CATEGORY_LABELS[category] ?? category}</span><span className="font-semibold tabular-nums">{money(cents)}</span></div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-100"><div className="h-full rounded-full bg-teal-700" style={{ width: `${Number(cents * 100n / largestCategory)}%` }} /></div>
            </li>)}</ul> : <p className="mt-5 text-sm text-stone-600">Spending history will appear after the first payment.</p>}
          </div>
        </div>
        <div className="mt-5 rounded-xl border border-stone-200 bg-white p-5"><h3 className="font-semibold">Recent payments</h3>
          {recent.length ? <ul role="list" className="mt-3 divide-y divide-stone-100">{recent.slice(0, 8).map((payment) => <li key={payment.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
            <span><strong className="font-semibold">{payment.payee.name}</strong><span className="ml-2 text-stone-500">{payment.category.label}</span></span>
            <span className="flex items-center gap-4"><StateBadge status={payment.status} /><strong className="tabular-nums">{money(payment.amountCents)}</strong></span>
          </li>)}</ul> : <p className="mt-3 text-sm text-stone-600">Payments from the phone will appear here.</p>}
        </div>
        {speed && <div className="mt-5 rounded-xl border border-stone-200 bg-white p-5"><h3 className="font-semibold">How fast this page is</h3>
          <p className="mt-1 text-sm text-stone-600">The weekly chart above, timed on the Tiger Data server for {firstName}’s data, {timeAgo(speed.measuredAt, now)}. One run each, at most once a minute.</p>
          <dl className="mt-4 grid gap-4 sm:grid-cols-3">
            <div><dt className="text-sm text-stone-600">From the weekly continuous aggregate</dt><dd className="mt-1 text-2xl font-semibold tabular-nums">{ms(speed.aggregateMs)} ms</dd></div>
            <div><dt className="text-sm text-stone-600">Same answer from raw payments</dt><dd className="mt-1 text-2xl font-semibold tabular-nums">{ms(speed.rawMs)} ms</dd></div>
            <div><dt className="text-sm text-stone-600">Compressed history, all families</dt><dd className="mt-1 text-2xl font-semibold tabular-nums">{speed.compression
              ? `${(speed.compression.beforeBytes / speed.compression.afterBytes).toFixed(1)}x smaller` : <span className="text-base font-medium text-stone-700">Nothing compressed yet</span>}</dd></div>
          </dl>
          {/* ponytail: copied from docs/perf.md (npm run bench:perf, Oct 17); update by hand if the benchmark is rerun. */}
          <p className="mt-4 text-sm text-stone-600">Benchmark on 1,000,000 synthetic payments: weekly totals for all circles 13.8x faster from the aggregate (150 ms vs 2,077 ms), history 3.2x smaller compressed.</p>
        </div>}
      </section>

      <section id="setup" aria-labelledby="setup-title" className="mt-12"><p className="text-sm font-bold uppercase tracking-widest text-teal-800">Family circle</p>
        <h2 id="setup-title" className="mt-1 text-2xl font-semibold">Settings and people</h2>
        <div className="mt-5 rounded-xl border border-stone-200 bg-white p-5"><h3 className="font-semibold">Members</h3>
          <ul role="list" className="mt-3 flex flex-wrap gap-2">{memberResult.rows.map((member) => <li key={member.id} className="rounded-full bg-stone-100 px-4 py-2 text-sm">{member.display_name}</li>)}</ul>
          <h3 className="mt-6 font-semibold">Known payees</h3>
          <p className="mt-2 text-sm text-stone-600">{payeeResult.rows.length ? payeeResult.rows.map((payee) => payee.name).join(' · ') : 'None yet'}</p></div>
        <div className="mt-5"><SettingsForms circleId={active.circleId} holdDollars={(BigInt(circle.hold_over_cents) / 100n).toString() + '.' + (BigInt(circle.hold_over_cents) % 100n).toString().padStart(2, '0')} /></div>
      </section>
      <footer className="mt-12 border-t border-stone-200 pt-6 text-xs text-stone-500">Scam analysis stays on the older adult’s iPhone. Family decisions move payments through fixed rules.</footer>
    </div>
  </main>;
}
