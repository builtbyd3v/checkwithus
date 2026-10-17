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
import { PaymentCard, StateBadge } from './payment-card';
import { scamSequences, type SequenceEvidence } from '@/lib/scam-sequence';
import recordedBenchmark from '@/lib/perf-benchmark.json';
import { OverviewSummary } from './overview-summary';
import DashboardLoading from './loading';
import { benchmarkSummary, perfReportSchema } from '@/lib/perf-report';

const benchmark = perfReportSchema.parse(recordedBenchmark);

type SpendRow = { day: Date; category: Category; total_cents: string };
type CircleRow = { hold_over_cents: string; protected_name: string; frozen: boolean; vault_cents: number };
type MemberRow = { id: string; display_name: string };
type PayeeRow = { id: string; name: string; kind: string; category: Category };
const money = (cents: bigint | number | string) => formatCents(toCents(Number(cents)));
/** What the bill-pay agent did, in the family's words; nothing for a no, a lapse or a failure. */
function agentLabel(payment: { status: string; allowanceId: string | null; category: { label: string } }) {
  if (payment.status === 'paid') {
    return payment.allowanceId ? `Paid by the bill agent under your ${payment.category.label} allowance` : 'Paid by the bill agent';
  }
  return ['held', 'approved', 'paying'].includes(payment.status) ? 'Asked by the bill agent' : null;
}

const ms = (value: number) => value < 10 ? value.toFixed(2) : value.toFixed(0);

export default function Dashboard(props: { searchParams: Promise<{ circle?: string }> }) {
  return <Suspense fallback={<DashboardLoading />}>
    <DashboardContent {...props} />
  </Suspense>;
}

async function DashboardContent({ searchParams }: { searchParams: Promise<{ circle?: string }> }) {
  await connection();
  const session = await auth0.getSession();
  if (!session?.user.sub) redirect('/auth/login?returnTo=/dashboard');
  const circles = await memberships(db(), session.user.sub);
  if (!circles.length) return <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-16">
    <Link href="/" className="text-xl font-bold text-family-ink">checkwith.us</Link>
    <h1 className="mt-10 text-4xl font-semibold tracking-tight">Join your family circle</h1>
    <p className="mt-3 text-family-muted">Ask a family member for the invite code. Your account will then show the payments you can help review.</p>
    <JoinForm />
    <a href="/auth/logout" className="mt-8 text-sm font-medium text-family-blue-deep underline">Sign out</a>
  </main>;

  const requested = (await searchParams).circle;
  const active = circles.find((circle) => circle.circleId === requested) ?? circles[0]!;
  await cibaApprovals()?.pollCircles([active.circleId]);
  // Query holds independently: newer completed payments must not hide them.
  const heldQuery = familyPayments(db(), payments(), session.user.sub, { heldOnly: true, circleId: active.circleId });
  const [recent, held, spendResult, weekResult, circleResult, memberResult, payeeResult, alerts, speed, usualRows, sequences] = await Promise.all([
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
    // Reconstruct supporting ATM history; the stored hold reason remains authoritative.
    heldQuery.then((rows) => scamSequences(db(), active.circleId,
      rows.filter((payment) => payment.holdReasons.some((reason) => reason.code === 'cash_then_gift_card')).map((payment) => payment.id)))
      .catch(() => new Map<string, SequenceEvidence>()),
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

  return <main className="min-h-screen bg-family-canvas text-family-ink">
    <div className="mx-auto max-w-7xl px-5 pb-20 pt-7 sm:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-family-line pb-6">
        <Link href="/" className="text-xl font-bold tracking-tight text-family-ink min-[1100px]:hidden">checkwith<span className="text-family-blue">.us</span></Link>
        <nav aria-label="Dashboard" className="ml-auto flex items-center gap-5 text-sm font-semibold text-family-muted">
          <a href="#activity" className="hover:text-family-blue-deep min-[1100px]:hidden">Activity</a><a href="#setup" className="hover:text-family-blue-deep min-[1100px]:hidden">Setup</a>
          <a href="/auth/logout" className="hover:text-family-blue-deep">Sign out</a>
        </nav>
      </header>
      <section className="flex flex-wrap items-end justify-between gap-6 py-9">
        <div><p className="text-sm font-bold uppercase tracking-[0.16em] text-family-blue-deep">Family overview</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">Looking out for {firstName}</h1>
          <p className="mt-3 max-w-2xl text-family-muted">See what needs attention and how everyday spending is changing.</p></div>
        {circles.length > 1 && <div className="flex flex-wrap gap-2" aria-label="Family circles">{circles.map((item) =>
          <Link key={item.circleId} href={`/dashboard?circle=${item.circleId}`} aria-current={item.circleId === active.circleId ? 'page' : undefined}
            className={`rounded-full border px-4 py-2 text-sm font-medium ${item.circleId === active.circleId ? 'border-family-blue bg-family-blue text-white' : 'border-family-line bg-white text-family-body'}`}>{item.protectedName}</Link>)}</div>}
      </section>

      <OverviewSummary waiting={held.length} spending={money(total)} categories={categories.size} />
      {active.role === 'approver' && <FreezeControl circleId={active.circleId} frozen={circle.frozen} firstName={firstName}
        vaultLabel={money(circle.vault_cents)} vaultDollars={String(Math.floor(circle.vault_cents / 100))} />}
      <section aria-labelledby="attention-title" className="rounded-2xl border border-family-ink/15 bg-family-blue-soft p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-bold uppercase tracking-widest text-family-blue-deep">Needs attention</p>
          <h2 id="attention-title" className="mt-1 text-2xl font-semibold">{held.length ? `${held.length} payment${held.length === 1 ? '' : 's'} waiting` : 'All clear right now'}</h2></div>
          <p className="max-w-md text-sm text-family-ink">{!held.length ? 'New held payments will appear here.'
            : active.role !== 'approver' ? 'An approver in your family decides these.'
            : canApproveHere ? 'Approve or deny here, or from the family app.' : 'Deny here. Approve from the Guardian notification on your phone.'}</p></div>
        <DecisionStatus key={active.circleId} />
        {held.length > 0 && <ul role="list" className="mt-6 grid gap-4 lg:grid-cols-2">{held.map((payment) => { const usualLine = usualLabel(usual.get(payment.id), payment.payee.name, firstName); return <li key={payment.id} className="min-w-0"><PaymentCard payment={payment} usualLine={usualLine} sequence={sequences.get(payment.id)} deadline={payment.expiresAt ? <Countdown expiresAt={payment.expiresAt} /> : null}>
          {active.role === 'approver' && <DecisionButtons paymentId={payment.id} canApproveHere={canApproveHere} expiresAt={payment.expiresAt} />}
        </PaymentCard></li>; })}</ul>}
        {decided.length > 0 && <div className="mt-6"><h3 id="decided-title" tabIndex={-1} className="text-sm font-bold uppercase tracking-widest text-family-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-family-blue">Recently decided</h3>
          <ul role="list" className="mt-3 grid gap-3 lg:grid-cols-2">{decided.map((payment) => <li key={payment.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-family-ink/10 bg-white/70 px-5 py-4">
            <div><p className="font-semibold">{payment.payee.name} <span className="ml-1 font-normal tabular-nums text-family-body">{money(payment.amountCents)}</span></p>
              <p className="mt-1 text-sm text-family-body">{payment.status === 'expired' ? 'Nobody answered in time, so it was blocked'
                : payment.decidedByName ? `${payment.status === 'denied' ? 'Denied' : 'Approved'} by ${payment.decidedByName}` : 'Decided by the family'}
                {payment.decidedAt && `, ${timeAgo(new Date(payment.decidedAt), now)}`}</p></div>
            <StateBadge status={payment.status} /></li>)}</ul></div>}
      </section>

      <section aria-labelledby="alerts-title" className="mt-6 rounded-2xl border border-family-line bg-white p-5 sm:p-7">
        <h2 id="alerts-title" className="text-2xl font-semibold">Alerts from {firstName}’s phone</h2>
        {alertRows.length ? <ul role="list" className="mt-4 divide-y divide-family-line">{alertRows.map((alert) => <li key={alert.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3">
          <p className="font-medium"><span aria-hidden="true" className={`mr-2 inline-block size-2.5 rounded-full ${alert.kind === 'bank_during_call' ? 'bg-rose-700' : 'bg-amber-600'}`} />{alert.headline}</p>
          <time dateTime={alert.createdAt} className="text-sm text-family-muted">{timeAgo(new Date(alert.createdAt), now)}</time></li>)}</ul>
          : <p className="mt-2 text-family-body">No alerts. If {firstName} taps “Ask my family” or visits a bank during a phone call, it shows here.</p>}
      </section>

      <section id="activity" aria-labelledby="spending-title" className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-bold uppercase tracking-widest text-family-blue-deep">Last 90 days</p>
          <h2 id="spending-title" className="mt-1 text-2xl font-semibold">Spending at a glance</h2></div>
          <p className="text-3xl font-semibold tabular-nums">{money(total)}</p></div>
        <div className="mt-5 grid gap-5 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="rounded-xl border border-family-line bg-white p-5"><h3 className="font-semibold">Weekly spending</h3>
            <div aria-hidden="true" className="mt-6 flex h-44 items-end gap-2 border-b border-family-line pb-1">{weeks.map((week, index) => <div key={index} className="group relative flex h-full flex-1 items-end">
              <div className="w-full rounded-t bg-family-blue/80" style={{ height: `${Math.max(week > 0n ? 5 : 0, Number(week * 100n / largestWeek))}%` }} />
              </div>)}</div>
            <div className="mt-2 flex justify-between text-xs text-family-muted"><span>12 weeks ago</span><span>This week</span></div>
            <details className="mt-4">
              <summary className="min-h-11 cursor-pointer rounded px-2 py-3 text-sm font-semibold text-family-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-family-blue">View weekly amounts</summary>
              <table className="mt-2 w-full text-left text-sm">
                <caption className="sr-only">Weekly spending, oldest to newest</caption>
                <thead><tr><th scope="col" className="py-2 font-semibold">Week</th><th scope="col" className="py-2 text-right font-semibold">Amount</th></tr></thead>
                <tbody>{weeks.map((week, index) => <tr key={index} className="border-t border-family-line">
                  <th scope="row" className="py-2 font-normal">{index === 12 ? 'This week' : index === 11 ? '1 week ago' : `${12 - index} weeks ago`}</th>
                  <td className="py-2 text-right tabular-nums">{money(week)}</td>
                </tr>)}</tbody>
              </table>
            </details>
          </div>
          <div className="rounded-xl border border-family-line bg-white p-5"><h3 className="font-semibold">By category</h3>
            {categoryRows.length ? <ul role="list" className="mt-5 space-y-4">{categoryRows.slice(0, 5).map(([category, cents]) => <li key={category}>
              <div className="flex justify-between gap-3 text-sm"><span>{CATEGORY_LABELS[category] ?? category}</span><span className="font-semibold tabular-nums">{money(cents)}</span></div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-family-canvas"><div className="h-full rounded-full bg-family-blue" style={{ width: `${Number(cents * 100n / largestCategory)}%` }} /></div>
            </li>)}</ul> : <p className="mt-5 text-sm text-family-muted">Spending history will appear after the first payment.</p>}
          </div>
        </div>
        <div className="mt-5 rounded-xl border border-family-line bg-white p-5"><h3 className="font-semibold">Recent payments</h3>
          {recent.length ? <ul role="list" className="mt-3 divide-y divide-family-line">{recent.slice(0, 8).map((payment) => <li key={payment.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
            <span><strong className="font-semibold">{payment.payee.name}</strong><span className="ml-2 text-family-muted">{payment.category.label}</span>
              {payment.initiatedBy === 'agent' && agentLabel(payment) && <span className="block text-family-muted">{agentLabel(payment)}</span>}</span>
            <span className="flex items-center gap-4"><StateBadge status={payment.status} /><strong className="tabular-nums">{money(payment.amountCents)}</strong></span>
          </li>)}</ul> : <p className="mt-3 text-sm text-family-muted">Payments from the phone will appear here.</p>}
        </div>
        {speed && <div className="mt-5 rounded-xl border border-family-line bg-white p-5"><h3 className="font-semibold">How fast this page is</h3>
          <p className="mt-1 text-sm text-family-muted">The weekly chart above, timed on the Tiger Data server for {firstName}’s data, {timeAgo(speed.measuredAt, now)}. One run each, at most once a minute.</p>
          <dl className="mt-4 grid gap-4 sm:grid-cols-3">
            <div><dt className="text-sm text-family-muted">From the weekly continuous aggregate</dt><dd className="mt-1 text-2xl font-semibold tabular-nums">{ms(speed.aggregateMs)} ms</dd></div>
            <div><dt className="text-sm text-family-muted">Same answer from raw payments</dt><dd className="mt-1 text-2xl font-semibold tabular-nums">{ms(speed.rawMs)} ms</dd></div>
            <div><dt className="text-sm text-family-muted">Compressed history, all families</dt><dd className="mt-1 text-2xl font-semibold tabular-nums">{speed.compression
              ? `${(speed.compression.beforeBytes / speed.compression.afterBytes).toFixed(1)}x smaller` : <span className="text-base font-medium text-family-body">Nothing compressed yet</span>}</dd></div>
          </dl>
          <p className="mt-4 text-sm text-family-muted">{benchmarkSummary(benchmark)}</p>
        </div>}
      </section>

      <section id="setup" aria-labelledby="setup-title" className="mt-12"><p className="text-sm font-bold uppercase tracking-widest text-family-blue-deep">Family circle</p>
        <h2 id="setup-title" className="mt-1 text-2xl font-semibold">Settings and people</h2>
        <div className="mt-5 rounded-xl border border-family-line bg-white p-5"><h3 className="font-semibold">Members</h3>
          <ul role="list" className="mt-3 flex flex-wrap gap-2">{memberResult.rows.map((member) => <li key={member.id} className="rounded-full bg-family-canvas px-4 py-2 text-sm">{member.display_name}</li>)}</ul>
          <h3 className="mt-6 font-semibold">Known payees</h3>
          <p className="mt-2 text-sm text-family-muted">{payeeResult.rows.length ? payeeResult.rows.map((payee) => payee.name).join(' · ') : 'None yet'}</p></div>
        <div className="mt-5"><SettingsForms circleId={active.circleId} holdDollars={(BigInt(circle.hold_over_cents) / 100n).toString() + '.' + (BigInt(circle.hold_over_cents) % 100n).toString().padStart(2, '0')} /></div>
      </section>
      <footer className="mt-12 border-t border-family-line pt-6 text-xs text-family-muted">Scam analysis stays on the older adult’s iPhone. Family decisions move payments through fixed rules.</footer>
    </div>
  </main>;
}
