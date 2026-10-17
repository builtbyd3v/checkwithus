/**
 * Family approval through Auth0 CIBA (APPROVAL_MODE=ciba).
 *
 *   onHeld       a payment was held: push it to every family member's Auth0
 *                Guardian app ("Rosa: 500.00 USD to QuickGift Cards")
 *   pollPayment  ask Auth0 whether anyone answered; the first answer becomes
 *                the payment's decision through decidePayment, exactly as
 *                an answer from the family app would
 *
 * Serverless functions cannot run a background loop, so polling happens when
 * a request arrives: the older adult's phone polls its own payment while it
 * shows "Waiting for family", and family list reads poll too. Each request
 * is first claimed by moving its poll_after forward in one UPDATE, so
 * however many callers arrive at once, Auth0 hears from us at most once per
 * interval (docs/RULES.md rule 8).
 *
 * If nobody polls (every app closed), answers wait at Auth0 and the payment
 * reaches its deadline and is blocked. Failing closed is the safe direction.
 */
import 'server-only';
import type pg from 'pg';
import { bindingMessage, CibaError, type CibaClient, type CibaPoll } from '@/lib/auth0/ciba';
import { PaymentError, type Payment, type PaymentService } from '@/lib/payments';

/**
 * Auth0 answers `access_denied` both for "Deny" and for an expired push.
 * One arriving this close to the push's own expiry is treated as an expiry,
 * so a timeout is not recorded as a family "no" (which would also become a
 * "scam" training label). Either way, the money does not move.
 */
const EXPIRY_MARGIN_SECONDS = 5;

const clampInterval = (seconds: number) =>
  Math.max(1, Math.min(60, Number.isFinite(seconds) ? Math.round(seconds) : 5));

export type CibaApprovalsDeps = {
  pool: pg.Pool;
  ciba: CibaClient;
  /** A getter, because the payment service in turn calls onHeld. */
  payments: () => PaymentService;
};

export function createCibaApprovals(deps: CibaApprovalsDeps) {
  const { pool, ciba } = deps;

  /** Pushes a newly held payment to every member of its circle. */
  async function onHeld(payment: Payment): Promise<void> {
    const { rows: members } = await pool.query<{
      id: string;
      auth0_sub: string;
      protected_name: string;
      seconds_left: number;
    }>(
      `select m.id, m.auth0_sub, c.protected_name,
              greatest(0, floor(extract(epoch from p.expires_at - now())))::int as seconds_left
         from payments p
         join circles c on c.id = p.circle_id
         join circle_members m on m.circle_id = p.circle_id
        where p.id = $1 and p.status = 'held' and m.role = 'approver'`,
      [payment.id],
    );

    await Promise.all(
      members.map(async (member) => {
        if (member.seconds_left < 1) return;
        try {
          const started = await ciba.start({
            sub: member.auth0_sub,
            bindingMessage: bindingMessage({
              protectedName: member.protected_name,
              amountCents: payment.amountCents,
              payeeName: payment.payeeName,
            }),
            expirySeconds: member.seconds_left,
            payment: { amountCents: payment.amountCents, payee: payment.payeeName, reasons: payment.holdReasons },
          });
          await pool.query(
            `insert into ciba_requests
               (payment_id, member_id, auth_req_id, poll_after, interval_seconds, expires_at)
             values ($1, $2, $3, now() + make_interval(secs => $4::int), $4::int,
                     now() + make_interval(secs => $5::int))
             on conflict (payment_id, member_id) do nothing`,
            [payment.id, member.id, started.authReqId, clampInterval(started.intervalSeconds), started.expiresInSeconds],
          );
        } catch (error) {
          // Most often: this member has not enrolled Auth0 Guardian. The
          // others can still answer; record why this one cannot.
          const message = error instanceof CibaError ? error.message : String(error);
          console.error(`[ciba] could not push payment ${payment.id} to member ${member.id}: ${message}`);
          await pool.query(
            `insert into ciba_requests (payment_id, member_id, state, expires_at, last_error)
             values ($1, $2, 'failed', now() + make_interval(secs => $3), $4)
             on conflict (payment_id, member_id) do nothing`,
            [payment.id, member.id, member.seconds_left, message.slice(0, 500)],
          );
        }
      }),
    );
  }

  /**
   * Asks Auth0 about every due request for one payment, records what it
   * says, then applies any decision. Scoped to `circleId`, so a caller can
   * only cause polling for its own circle's payments.
   */
  async function pollPayment(paymentId: string, circleId: string): Promise<void> {
    await pool.query(
      `update ciba_requests r set state = 'superseded' from circle_members m, payments p
       where r.member_id = m.id and r.payment_id = p.id and p.id = $1 and p.circle_id = $2
         and m.role <> 'approver' and r.state in ('pending', 'approved', 'denied')`, [paymentId, circleId],
    );
    const { rows: claimed } = await pool.query<{
      id: string;
      auth_req_id: string;
      member_id: string;
      sub: string;
      payment_held: boolean;
    }>(
      `update ciba_requests r
          set poll_after = now() + make_interval(secs => r.interval_seconds)
         from payments p, circle_members m
        where r.payment_id = $1 and r.state = 'pending' and r.poll_after <= now()
          and p.id = r.payment_id and p.circle_id = $2 and m.id = r.member_id
       returning r.id, r.auth_req_id, r.member_id, m.auth0_sub as sub,
                 (p.status = 'held') as payment_held`,
      [paymentId, circleId],
    );

    if (claimed.length > 0) {
      // Already decided some other way: nothing left to ask Auth0 about.
      if (!claimed[0]!.payment_held) {
        await supersede(paymentId);
        return;
      }
      // Commit each result before asking Auth0 about the next request. Auth0
      // may hand out an answer only once, and a later failed write must not
      // roll back an earlier answer. Separate clock readings also preserve
      // the order in which the pending checks and answers reached us.
      for (const request of claimed.sort((a, b) => a.sub.localeCompare(b.sub))) {
        const result = await ciba.poll(request.auth_req_id);
        await record(request, result);
      }
    }

    // Also retries answers whose decision did not land last time (Auth0 hands
    // an answer out only once, so a recorded one must never be dropped).
    await applyRecordedAnswers(paymentId, circleId);
    await supersedeIfDecided(paymentId);
  }

  /**
   * Turns recorded Guardian answers into the payment's decision.
   *
   * Auth0 does not say when someone tapped Deny, so answers cannot be put in
   * true answer order. The rule instead:
   *  - a recorded Deny decides at once: it can only stop money;
   *  - an approval decides only once every other member's still-open push has
   *    been checked AFTER that approval arrived. If one of them had denied,
   *    even a moment earlier, that check found it and the Deny won.
   * That costs an approval at most one poll interval (~5s). Once the payment
   * is decided, decidePayment answers already_decided and these are no-ops.
   */
  async function applyRecordedAnswers(paymentId: string, circleId: string): Promise<void> {
    const { rows: denials } = await pool.query<{ member_id: string }>(
      `select r.member_id
         from ciba_requests r join payments p on p.id = r.payment_id
        where r.payment_id = $1 and p.circle_id = $2 and p.status = 'held'
          and r.state = 'denied'
        order by r.answered_at, r.id
        limit 1`,
      [paymentId, circleId],
    );
    if (denials[0]) {
      await decide(paymentId, denials[0].member_id, 'deny');
      return;
    }

    const { rows: approvals } = await pool.query<{ member_id: string }>(
      `select r.member_id
         from ciba_requests r join payments p on p.id = r.payment_id
        where r.payment_id = $1 and p.circle_id = $2 and p.status = 'held'
          and r.state = 'approved'
          and not exists (
            select 1 from ciba_requests other
             where other.payment_id = r.payment_id and other.id <> r.id
               and other.state = 'pending'
               and (other.last_polled_at is null or other.last_polled_at <= r.answered_at))
        order by r.answered_at, r.id
        `,
      [paymentId, circleId],
    );
    for (const approval of approvals) await decide(paymentId, approval.member_id, 'approve');
  }

  /**
   * Records what Auth0 said about one request. Never decides anything itself:
   * an answer is stored (with when it arrived) before it is applied, so a
   * failure while applying it cannot lose it.
   */
  async function record(
    request: { id: string; sub: string },
    result: CibaPoll,
  ): Promise<void> {
    const update = (sql: string, values: unknown[] = []) =>
      pool.query(`update ciba_requests set ${sql} where id = $1`, [request.id, ...values]);

    switch (result.kind) {
      case 'pending':
        // Auth0 confirmed "no answer yet" as of now.
        await update('last_polled_at = clock_timestamp(), last_error = null');
        return;
      case 'unavailable':
        // We learned nothing, so last_polled_at stays as it was.
        await update('last_error = $2', [result.message.slice(0, 500)]);
        return;
      case 'slow_down':
        // Explicit casts: $2 is both an integer column and make_interval's
        // floating-point `secs`, and Postgres will not guess between them.
        await update('interval_seconds = $2::int, poll_after = now() + make_interval(secs => $2::int)', [
          clampInterval(result.intervalSeconds),
        ]);
        return;
      case 'invalid':
        await update(`state = 'failed', last_error = $2`, [result.message.slice(0, 500)]);
        return;
      case 'expired':
        await update(`state = 'expired', last_polled_at = clock_timestamp()`);
        return;
      case 'approved':
        // The verified token must be the member this push went to.
        if (result.sub !== request.sub) {
          await update(`state = 'failed', last_error = $2`, ['Auth0 returned a token for a different user']);
          return;
        }
        await update(`state = 'approved', answered_at = clock_timestamp(), last_polled_at = clock_timestamp(), last_error = null`);
        return;
      case 'denied_or_expired':
        // Judged as of when the answer arrived: well before expiry,
        // Auth0 evaluated it earlier still, so it
        // was a real "Deny"; at the edge it may have been the timeout.
        await update(
          `state = case when expires_at - clock_timestamp() > make_interval(secs => $2) then 'denied' else 'expired' end,
           answered_at = case when expires_at - clock_timestamp() > make_interval(secs => $2) then clock_timestamp() end,
           last_polled_at = clock_timestamp(), last_error = null`,
          [EXPIRY_MARGIN_SECONDS],
        );
        return;
    }
  }

  async function decide(paymentId: string, memberId: string, decision: 'approve' | 'deny') {
    try {
      await deps.payments().decidePayment({ paymentId, member: { memberId }, decision, via: 'ciba' });
    } catch (error) {
      // Someone else answered first, or the deadline passed: their outcome stands.
      // A Guardian approval while frozen is refused; the hold runs out and blocks.
      if (error instanceof PaymentError && (error.code === 'already_decided' || error.code === 'expired' || error.code === 'frozen')) {
        return;
      }
      throw error;
    }
  }

  async function supersede(paymentId: string) {
    await pool.query(
      `update ciba_requests set state = 'superseded' where payment_id = $1 and state = 'pending'`,
      [paymentId],
    );
  }

  async function supersedeIfDecided(paymentId: string) {
    await pool.query(
      `update ciba_requests r set state = 'superseded'
         from payments p
        where r.payment_id = $1 and r.state = 'pending'
          and p.id = r.payment_id and p.status <> 'held'`,
      [paymentId],
    );
  }

  /** Polls every held payment in these circles. For family list reads. */
  async function pollCircles(circleIds: string[]): Promise<void> {
    if (circleIds.length === 0) return;
    const { rows } = await pool.query<{ id: string; circle_id: string }>(
      `select id, circle_id from payments where circle_id = any($1::uuid[]) and status = 'held'`,
      [circleIds],
    );
    await Promise.all(rows.map((r) => pollPayment(r.id, r.circle_id)));
  }

  return { onHeld, pollPayment, pollCircles };
}

export type CibaApprovals = ReturnType<typeof createCibaApprovals>;
