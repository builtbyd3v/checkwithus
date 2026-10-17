/** Data the older adult's phone reads and writes, scoped to its own circle. */
import 'server-only';
import type pg from 'pg';

export type LabelCursor = { decidedAt: string; paymentId: string };

/** What the phone needs to set itself up: who is in the family, what stays locked. */
export async function deviceConfig(pool: pg.Pool, circleId: string) {
  const { rows } = await pool.query<{
    protected_name: string;
    locked_app_groups: string[];
    approval_timeout_seconds: number;
    hold_over_cents: number;
  }>(
    `select protected_name, locked_app_groups, approval_timeout_seconds, hold_over_cents
       from circles where id = $1`,
    [circleId],
  );
  const circle = rows[0];
  if (!circle) throw new Error(`Circle ${circleId} vanished`);
  const family = await pool.query<{ display_name: string }>(
    `select display_name from circle_members where circle_id = $1 order by created_at`,
    [circleId],
  );
  return {
    protectedName: circle.protected_name,
    family: family.rows.map((r) => ({ displayName: r.display_name })),
    lockedAppGroups: circle.locked_app_groups,
    approvalTimeoutSeconds: circle.approval_timeout_seconds,
    holdOverCents: circle.hold_over_cents,
  };
}

export async function addAlert(
  pool: pg.Pool,
  circleId: string,
  alert: { kind: 'bank_during_call' | 'ask_family'; detail: string | null },
) {
  const { rows } = await pool.query<{ id: string; created_at: Date }>(
    `insert into alerts (circle_id, kind, detail) values ($1, $2, $3) returning id, created_at`,
    [circleId, alert.kind, alert.detail],
  );
  return { id: rows[0]!.id, createdAt: rows[0]!.created_at.toISOString() };
}

/**
 * The learning loop: family decisions on payments the Guard scored, as
 * labels for retraining it on the phone. Only ids and labels leave here. The
 * phone keeps its own copy of what it scored, keyed by payment id, so the
 * text the model read never has to be stored on or sent to a server
 * (hard rule #3).
 *
 * Continue with nextCursor, which preserves PostgreSQL timestamp precision
 * and uses payment id to break ties. `after` is a legacy starting filter.
 */
export async function learningLabels(pool: pg.Pool, circleId: string, after: Date | null, cursor: LabelCursor | null = null) {
  const { rows } = await pool.query<{ id: string; status: string; decided_at: Date; cursor_time: string }>(
    `select id, status, decided_at,
            to_char(decided_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as cursor_time
       from payments
      where circle_id = $1
        and guard_score is not null
        and decided_via in ('app', 'ciba', 'dashboard')
        and status in ('denied', 'approved', 'paying', 'paid', 'failed')
        and ($2::timestamptz is null or decided_at > $2)
        and ($3::timestamptz is null or (decided_at, id) > ($3::timestamptz, $4::uuid))
      order by decided_at, id
      limit 201`,
    [circleId, after, cursor?.decidedAt ?? null, cursor?.paymentId ?? null],
  );
  const page = rows.slice(0, 200);
  const last = page.at(-1);
  return {
    labels: page.map((r) => ({
      paymentId: r.id,
      // A family "no" is a scam label; a family "yes" is not, whatever happened at the bank after.
      label: r.status === 'denied' ? ('scam' as const) : ('not_scam' as const),
      decidedAt: r.decided_at.toISOString(),
    })),
    // Keep a checkpoint even on the last page, for the next incremental sync.
    nextCursor: last ? Buffer.from(JSON.stringify({ decidedAt: last.cursor_time, paymentId: last.id })).toString('base64url') : null,
    hasMore: rows.length > 200,
  };
}
