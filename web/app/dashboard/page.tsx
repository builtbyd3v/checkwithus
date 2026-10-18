import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { auth0 } from '@/lib/auth0/web';
import { CATEGORY_LABELS, type Category } from '@/lib/categories';
import { db } from '@/lib/db';
import { familyAlerts, familyPayments, memberships } from '@/lib/family';
import { VAULT_CENTS_SQL } from '@/lib/vault';
import { weeklySpending } from '@/lib/spending';
import { cibaApprovals, approvalsUseCiba, payments } from '@/lib/services';
import { cachedSpeed } from '@/lib/speed';
import { herUsual, usualLabel, type UsualRow } from '@/lib/usual';
import { JoinForm } from './controls';
import { scamSequences, type SequenceEvidence } from '@/lib/scam-sequence';
import recordedBenchmark from '@/lib/perf-benchmark.json';
import DashboardLoading from './loading';
import { benchmarkSummary, perfReportSchema } from '@/lib/perf-report';
import type { Usual } from './payment-card';
import { DashboardView } from './view';

const benchmark = perfReportSchema.parse(recordedBenchmark);

type SpendRow = { day: Date; category: Category; total_cents: string };
type CircleRow = { hold_over_cents: string; protected_name: string; frozen: boolean; vault_cents: number };
type MemberRow = { id: string; display_name: string };
type PayeeRow = { id: string; name: string; kind: string; category: Category };

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
  if (!circles.length) return <main className="mx-auto flex max-w-xl flex-col px-4 pb-16 pt-6 sm:px-6">
    <h1 className="text-4xl font-semibold">Join your family circle</h1>
    <p className="mt-3 text-lg text-muted">Ask a family member for the invite code. Your account will then show the payments you can help review.</p>
    <JoinForm />
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
  const circle = circleResult.rows[0]!;
  const firstName = circle.protected_name.split(' ')[0]!;
  const usual = new Map<string, Usual>();
  for (const row of usualRows) {
    const payment = held.find((item) => item.id === row.payment_id);
    const line = payment && usualLabel(row, payment.payee.name, firstName);
    const times = row.payee_times ?? row.daily_times;
    if (line && times) usual.set(row.payment_id, { line, times, kind: row.payee_times !== null ? 'payee' : 'daily' });
  }
  const categories = new Map<Category, number>();
  const weeks = Array<number>(13).fill(0);
  for (const row of spendResult.rows) categories.set(row.category, (categories.get(row.category) ?? 0) + Number(row.total_cents));
  for (const row of weekResult) {
    if (row.weeks_ago >= 0 && row.weeks_ago < weeks.length) weeks[12 - row.weeks_ago] = Number(row.total_cents);
  }
  const holdCents = BigInt(circle.hold_over_cents);

  return <DashboardView now={new Date()} firstName={firstName} role={active.role} canApproveHere={!approvalsUseCiba()}
    circles={circles} activeCircleId={active.circleId} frozen={circle.frozen} vaultCents={Number(circle.vault_cents)}
    holdDollars={`${holdCents / 100n}.${(holdCents % 100n).toString().padStart(2, '0')}`}
    held={held} recent={recent} alerts={alerts} weeks={weeks}
    categories={[...categories].sort((x, y) => y[1] - x[1]).map(([category, cents]) => ({ label: CATEGORY_LABELS[category] ?? category, cents }))}
    usual={usual} sequences={sequences} speed={speed} benchmarkLine={benchmarkSummary(benchmark)}
    members={memberResult.rows} payees={payeeResult.rows.map((payee) => ({ id: payee.id, name: payee.name, categoryLabel: CATEGORY_LABELS[payee.category] ?? payee.category }))} />;
}
