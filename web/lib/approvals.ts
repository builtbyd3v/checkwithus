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
        where p.id = $1 and p.status = 'held'`,
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
   * Asks Auth0 about every due request for one payment, and applies any
   * answer. Scoped to `circleId`, so a caller can only cause polling for its
   * own circle's payments.
   */
  async function pollPayment(paymentId: string, circleId: string): Promise<void> {
    // Answers that arrived but whose decision did not land (e.g. a transient
    // database error) come first. Auth0 hands an answer out only once, so a
    // recorded answer is retried here until the payment is decided.
    await applyRecordedAnswers(paymentId, circleId);

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
    if (claimed.length === 0) return;

    // Already decided some other way: nothing left to ask Auth0 about.
    if (!claimed[0]!.payment_held) {
      await supersede(paymentId);
      return;
    }

    for (const request of claimed) {
      const result = await ciba.poll(request.auth_req_id);
      await apply(paymentId, request, result);
    }
    await supersedeIfDecided(paymentId);
  }

  /**
   * Re-applies recorded Guardian answers to a payment that is still held, in
   * the order they arrived, so the first answer still wins. Once the payment
   * is decided, decidePayment answers already_decided and these are no-ops.
   */
  async function applyRecordedAnswers(paymentId: string, circleId: string): Promise<void> {
    const { rows } = await pool.query<{ member_id: string; state: 'approved' | 'denied' }>(
      `select r.member_id, r.state
         from ciba_requests r join payments p on p.id = r.payment_id
        where r.payment_id = $1 and p.circle_id = $2 and p.status = 'held'
          and r.state in ('approved', 'denied')
        order by r.answered_at, r.id`,
      [paymentId, circleId],
    );
    for (const answer of rows) {
      await decide(paymentId, answer.member_id, answer.state === 'approved' ? 'approve' : 'deny');
    }
  }

  async function apply(
    paymentId: string,
    request: { id: string; member_id: string; sub: string },
    result: CibaPoll,
  ): Promise<void> {
    const setState = (state: string, lastError: string | null = null) =>
      pool.query(`update ciba_requests set state = $2, last_error = $3 where id = $1`, [
        request.id,
        state,
        lastError?.slice(0, 500) ?? null,
      ]);
    // A member's answer is recorded, with when it arrived, BEFORE it is applied:
    // if applying fails, applyRecordedAnswers retries it on the next poll.
    const recordAnswer = (state: 'approved' | 'denied') =>
      pool.query(`update ciba_requests set state = $2, answered_at = now(), last_error = null where id = $1`, [
        request.id,
        state,
      ]);

    switch (result.kind) {
      case 'pending':
        return;
      case 'unavailable':
        await pool.query(`update ciba_requests set last_error = $2 where id = $1`, [request.id, result.message]);
        return;
      case 'slow_down':
        await pool.query(
          // Explicit casts: $2 is both an integer column and make_interval's
          // floating-point `secs`, and Postgres will not guess between them.
          `update ciba_requests
              set interval_seconds = $2::int, poll_after = now() + make_interval(secs => $2::int)
            where id = $1`,
          [request.id, clampInterval(result.intervalSeconds)],
        );
        return;
      case 'invalid':
        await setState('failed', result.message);
        return;
      case 'approved':
        // The verified token must be the member this push went to.
        if (result.sub !== request.sub) {
          await setState('failed', 'Auth0 returned a token for a different user');
          return;
        }
        await recordAnswer('approved');
        await decide(paymentId, request.member_id, 'approve');
        return;
      case 'expired':
        await setState('expired');
        return;
      case 'denied_or_expired': {
        // Judge by when the answer ARRIVED, not when the poll started: the
        // request can take seconds. If it came back well before expiry, Auth0
        // evaluated it earlier still, so it was a real "Deny".
        const { rows } = await pool.query<{ clearly_before_expiry: boolean }>(
          `select expires_at - now() > make_interval(secs => $2) as clearly_before_expiry
             from ciba_requests where id = $1`,
          [request.id, EXPIRY_MARGIN_SECONDS],
        );
        if (!rows[0]?.clearly_before_expiry) {
          await setState('expired');
          return;
        }
        await recordAnswer('denied');
        await decide(paymentId, request.member_id, 'deny');
        return;
      }
    }
  }

  async function decide(paymentId: string, memberId: string, decision: 'approve' | 'deny') {
    try {
      await deps.payments().decidePayment({ paymentId, member: { memberId }, decision, via: 'ciba' });
    } catch (error) {
      // Someone else answered first, or the deadline passed: their outcome stands.
      if (error instanceof PaymentError && (error.code === 'already_decided' || error.code === 'expired')) {
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
