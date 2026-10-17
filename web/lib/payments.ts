/**
 * Payments: from the phone's request to money moving (or not) at Nessie.
 *
 *   createPayment  rules decide: allowed -> sent to Nessie now; held -> family
 *   decidePayment  first family answer wins, before the deadline
 *   expireOverdue  no answer by the deadline -> blocked
 *   executePayment approved -> Nessie, exactly once
 *
 * Every state change is one conditional UPDATE, so the database, not this
 * process, decides races: two family members answering at the same instant
 * produce one winner, and an answer that arrives after the deadline cannot
 * win. Deadlines use the database clock (`now()`), never the server's.
 *
 * Money only moves in `executePayment`, and only from `approved`, which is
 * reachable only through the fixed rules or a family member's answer
 * (hard rule #1).
 */
import 'server-only';
import type pg from 'pg';
import { CATEGORY_LABELS, payeeKindNeedsWholeDollars, type Category, type PayeeKind } from '@/lib/categories';
import { transaction, type Queryable } from '@/lib/db';
import { toCents, type Cents } from '@/lib/money';
import { normalizeName } from '@/lib/names';
import { NessieError, type NessieClient } from '@/lib/nessie/client';
import {
  merchantBody,
  paidBillBody,
  purchaseBody,
  taggedDescription,
  withdrawalBody,
} from '@/lib/nessie/format';
import { CASH_THEN_GIFT_CARD_WINDOW_SECONDS, decideHold, type Baseline, type HoldReason } from '@/lib/rules';

export const PAYMENT_STATUSES = [
  'held',
  'approved',
  'denied',
  'expired',
  'paying',
  'paid',
  'failed',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export type DecisionChannel = 'app' | 'ciba' | 'dashboard';

export type Payment = {
  id: string;
  circleId: string;
  amountCents: Cents;
  payeeName: string;
  payeeKind: PayeeKind;
  category: Category;
  onCall: boolean;
  payeeKnown: boolean;
  guardScore: number | null;
  guardModelVersion: string | null;
  explanation: string | null;
  holdReasons: HoldReason[];
  status: PaymentStatus;
  expiresAt: Date | null;
  decidedBy: string | null;
  decidedVia: 'rules' | DecisionChannel | 'timeout' | null;
  decidedAt: Date | null;
  nessieKind: 'purchase' | 'withdrawal' | 'bill' | null;
  nessieId: string | null;
  failure: string | null;
  createdAt: Date;
  approvalsRequired?: number;
  allowanceId?: string | null;
  billDueDate?: string | null;
  initiatedBy?: PaymentInitiator;
};

/** Who asked: the older adult's phone, or the family's bill-pay agent. */
export type PaymentInitiator = 'device' | 'agent';

export type NewPayment = {
  billDueDate?: string | null;
  /** Chosen by the phone; a retry with the same key returns the same payment. */
  idempotencyKey: string;
  amountCents: Cents;
  payeeName: string;
  payeeKind: PayeeKind;
  category: Category;
  onCall: boolean;
  guard: { score: number; modelVersion: string | null } | null;
  explanation: string | null;
  /** Default `device`. The rules treat both the same. */
  initiatedBy?: PaymentInitiator;
};

/** What the payment service needs to know about a circle. */
export type CircleSettings = {
  id: string;
  nessieAccountId: string;
  timeZone: string;
  holdOverCents: Cents;
  approvalTimeoutSeconds: number;
};

export type PaymentErrorCode =
  | 'not_found'
  | 'expired'
  | 'already_decided'
  | 'idempotency_conflict'
  | 'whole_dollars_only'
  | 'frozen';

/** A request we refuse for a reason the caller should be told about. */
export class PaymentError extends Error {
  constructor(
    readonly code: PaymentErrorCode,
    message: string,
    readonly payment?: Payment,
  ) {
    super(message);
    this.name = 'PaymentError';
  }
}

const COLUMNS = `
  id, circle_id, amount_cents, payee_name, payee_kind, category, on_call,
  payee_known, guard_score, guard_model_version, explanation, hold_reasons,
  status, expires_at, decided_by, decided_via, decided_at, nessie_kind,
  nessie_id, failure, created_at, approvals_required, allowance_id, bill_due_date, initiated_by`;

type PaymentRow = {
  id: string;
  circle_id: string;
  amount_cents: number;
  payee_name: string;
  payee_kind: PayeeKind;
  category: Category;
  on_call: boolean;
  payee_known: boolean;
  guard_score: number | null;
  guard_model_version: string | null;
  explanation: string | null;
  hold_reasons: HoldReason[];
  status: PaymentStatus;
  expires_at: Date | null;
  decided_by: string | null;
  decided_via: Payment['decidedVia'];
  decided_at: Date | null;
  nessie_kind: Payment['nessieKind'];
  nessie_id: string | null;
  failure: string | null;
  created_at: Date;
  approvals_required: number;
  allowance_id: string | null;
  bill_due_date: Date | string | null;
  initiated_by: PaymentInitiator;
};

function toPayment(row: PaymentRow): Payment {
  return {
    id: row.id,
    circleId: row.circle_id,
    amountCents: toCents(row.amount_cents),
    payeeName: row.payee_name,
    payeeKind: row.payee_kind,
    category: row.category,
    onCall: row.on_call,
    payeeKnown: row.payee_known,
    guardScore: row.guard_score,
    guardModelVersion: row.guard_model_version,
    explanation: row.explanation,
    holdReasons: row.hold_reasons,
    status: row.status,
    expiresAt: row.expires_at,
    decidedBy: row.decided_by,
    decidedVia: row.decided_via,
    decidedAt: row.decided_at,
    nessieKind: row.nessie_kind,
    nessieId: row.nessie_id,
    failure: row.failure,
    createdAt: row.created_at,
    approvalsRequired: row.approvals_required,
    allowanceId: row.allowance_id,
    billDueDate: row.bill_due_date instanceof Date
      ? `${row.bill_due_date.getFullYear()}-${String(row.bill_due_date.getMonth()+1).padStart(2,'0')}-${String(row.bill_due_date.getDate()).padStart(2,'0')}`
      : row.bill_due_date,
    initiatedBy: row.initiated_by,
  };
}

/** Every Nessie merchant we create shares this fake address (rule 4: no real data). */
const DEMO_MERCHANT_LOCATION = {
  address: {
    street_number: '100',
    street_name: 'Demo Street',
    city: 'Gainesville',
    state: 'FL',
    zip: '32601',
  },
  geocode: { lat: 29.6516, lng: -82.3248 },
};

/**
 * A 'paying' payment untouched this long had its request cut off mid-flight.
 * Must stay well above the Nessie client's 10s request timeout, so that by
 * the time anyone may conclude a send failed, the send itself has resolved.
 */
const STUCK_PAYING_SECONDS = 30;
const LOOKUP_INTERVAL_SECONDS = 7;

/**
 * A payment whose bank outcome is unknown is only declared failed this long
 * after it was actually sent. Until then it is looked for at Nessie at most
 * once per lookup interval and shown as "sending". Nessie has no idempotency keys, so "failed"
 * followed by a retry (a new payment) while the first one commits late would
 * pay twice; ten minutes is far beyond any plausible late commit.
 */
const UNKNOWN_OUTCOME_MINUTES = 10;

export type PaymentServiceDeps = {
  pool: pg.Pool;
  nessie: NessieClient;
  /** Called once when a payment is held, to start asking the family (e.g. CIBA). */
  onHeld?: (payment: Payment) => Promise<void>;
};

export function createPaymentService(deps: PaymentServiceDeps) {
  const { pool, nessie } = deps;

  async function getPayment(id: string, q: Queryable = pool): Promise<Payment | null> {
    const { rows } = await q.query<PaymentRow>(`select ${COLUMNS} from payments where id = $1`, [
      id,
    ]);
    return rows[0] ? toPayment(rows[0]) : null;
  }

  async function circleSettings(circleId: string): Promise<CircleSettings> {
    const { rows } = await pool.query<{
      id: string;
      nessie_account_id: string;
      time_zone: string;
      hold_over_cents: number;
      approval_timeout_seconds: number;
    }>(
      `select id, nessie_account_id, time_zone, hold_over_cents, approval_timeout_seconds
         from circles where id = $1`,
      [circleId],
    );
    const row = rows[0];
    if (!row) throw new PaymentError('not_found', 'Circle not found');
    return {
      id: row.id,
      nessieAccountId: row.nessie_account_id,
      timeZone: row.time_zone,
      holdOverCents: toCents(row.hold_over_cents),
      approvalTimeoutSeconds: row.approval_timeout_seconds,
    };
  }

  async function isKnownPayee(circleId: string, kind: PayeeKind, name: string) {
    const { rowCount } = await pool.query(
      `select 1 from payees where circle_id = $1 and kind = $2 and normalized_name = $3`,
      [circleId, kind, normalizeName(name)],
    );
    return (rowCount ?? 0) > 0;
  }

  /**
   * What this person typically spends in a category on a day they spend in it,
   * over the last 90 days, from the `spending_daily` continuous aggregate.
   */
  async function baselineFor(circleId: string, category: Category): Promise<Baseline> {
    const { rows } = await pool.query<{ typical: number | null; active_days: number }>(
      `select round(avg(total_cents))::bigint as typical, count(*)::int as active_days
         from spending_daily
        where circle_id = $1 and category = $2 and day >= now() - interval '90 days'`,
      [circleId, category],
    );
    const row = rows[0];
    if (!row || row.typical === null || row.active_days === 0) return null;
    return { typicalDailyCents: toCents(row.typical), activeDays: row.active_days };
  }

  /**
   * The scam-sequence query over the spending hypertable: ATM cash in the
   * last two hours, exactly two hours included. Only recent chunks are scanned.
   */
  async function atmCashRecently(circleId: string): Promise<boolean> {
    const { rowCount } = await pool.query(
      `select 1 from spending
        where circle_id = $1 and atm_id is not null
          and occurred_at >= now() - make_interval(secs => $2) and occurred_at <= now()
        limit 1`,
      [circleId, CASH_THEN_GIFT_CARD_WINDOW_SECONDS],
    );
    return (rowCount ?? 0) > 0;
  }

  async function createPayment(circleId: string, input: NewPayment): Promise<Payment> {
    // Refuse up front what Nessie would silently truncate, so the phone hears
    // "no" now instead of a family approving an amount the bank then changes.
    if (payeeKindNeedsWholeDollars(input.payeeKind) && input.amountCents % 100 !== 0) {
      throw new PaymentError(
        'whole_dollars_only',
        'Payments to merchants and people must be whole dollars; only bills can include cents.',
      );
    }

    const circle = await circleSettings(circleId);
    const [payeeKnown, baseline, atmCash] = await Promise.all([
      isKnownPayee(circle.id, input.payeeKind, input.payeeName),
      baselineFor(circle.id, input.category),
      input.category === 'gift_cards' ? atmCashRecently(circle.id) : false,
    ]);

    const inserted = await transaction(pool, async q => {
    // The row lock also orders this payment against a Freeze tap.
    const policy = await q.query<{ two_approvals_over_cents: number; hold_over_cents: number; frozen: boolean }>(
      'select two_approvals_over_cents, hold_over_cents, frozen from circles where id = $1 for update', [circle.id],
    );
    const allowance = await q.query<{ id: string }>(
      `select a.id from allowances a join circle_members m on m.id = a.granted_by
       left join payees p on p.id = a.payee_id
       where a.circle_id = $1 and a.revoked_at is null and a.expires_at > clock_timestamp()
         and m.role = 'approver' and a.max_amount_cents >= $2
         and ((p.kind = $3 and p.normalized_name = $4) or a.category = $5)
       order by a.expires_at, a.id limit 1`,
      [circle.id, input.amountCents, input.payeeKind, normalizeName(input.payeeName), input.category],
    );
    let decision = decideHold({
      payment: {
        amountCents: input.amountCents,
        category: input.category,
        payeeKind: input.payeeKind,
        payeeKnown,
        onCall: input.onCall,
      },
      holdOverCents: toCents(policy.rows[0]!.hold_over_cents),
      baseline,
      guard: input.guard ? { score: input.guard.score } : null,
      circle: { frozen: policy.rows[0]!.frozen, atmCashRecently: atmCash },
    });
    // A family allowance only lifts routine amount/baseline limits for a known
    // payee. It never overrides scam categories, calls, Guard, or new payees.
    const allowanceId = payeeKnown ? allowance.rows[0]?.id ?? null : null;
    if (allowanceId && decision.action === 'hold') {
      const reasons = decision.reasons.filter(r => r !== 'over_limit' && r !== 'unusual_spending');
      decision = reasons.length ? { action: 'hold', reasons } : { action: 'allow' };
    }
    if (input.amountCents > policy.rows[0]!.two_approvals_over_cents) {
      const reasons = decision.action === 'hold' ? decision.reasons : [];
      decision = { action: 'hold', reasons: reasons.includes('over_limit') ? reasons : [...reasons, 'over_limit'] };
    }
    const held = decision.action === 'hold';

    return q.query<PaymentRow>(
      `insert into payments (
         circle_id, idempotency_key, amount_cents, payee_name, payee_kind, category,
         on_call, payee_known, guard_score, guard_model_version, explanation,
         hold_reasons, status, expires_at, decided_via, decided_at, approvals_required, allowance_id, bill_due_date, initiated_by)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
         case when $14 then now() + make_interval(secs => $15) end,
         case when $14 then null else 'rules' end,
         case when $14 then null else now() end, $16, $17, $18, $19)
       on conflict (circle_id, idempotency_key) do nothing
       returning ${COLUMNS}`,
      [
        circle.id,
        input.idempotencyKey,
        input.amountCents,
        input.payeeName,
        input.payeeKind,
        input.category,
        input.onCall,
        payeeKnown,
        input.guard?.score ?? null,
        input.guard?.modelVersion ?? null,
        input.explanation,
        decision.action === 'hold' ? decision.reasons : [],
        held ? 'held' : 'approved',
        held,
        circle.approvalTimeoutSeconds,
        input.amountCents > policy.rows[0]!.two_approvals_over_cents ? 2 : 1,
        !held ? allowanceId : null,
        input.billDueDate ?? null,
        input.initiatedBy ?? 'device',
      ],
    );
    });

    if (!inserted.rows[0]) return replay(circle.id, input);

    const payment = toPayment(inserted.rows[0]);
    if (payment.status === 'approved') return executePayment(payment.id);
    try {
      await deps.onHeld?.(payment);
    } catch (error) {
      // The hold is what protects the money, and it is already saved. A failed
      // push must not fail the request: the phone would retry, the retry would
      // replay this payment, and onHeld would never run again. The family app
      // still sees the hold when it next loads.
      console.error(`Could not notify family about payment ${payment.id}: ${messageOf(error)}`);
    }
    return payment;
  }

  /** Same idempotency key again: the original payment, never a second one. */
  async function replay(circleId: string, input: NewPayment): Promise<Payment> {
    const { rows } = await pool.query<PaymentRow>(
      `select ${COLUMNS} from payments where circle_id = $1 and idempotency_key = $2`,
      [circleId, input.idempotencyKey],
    );
    const existing = rows[0] ? toPayment(rows[0]) : null;
    if (!existing) throw new Error('Idempotency conflict but no existing payment found');

    // Every input the hold decision used must match, or a retry could return a
    // payment the rules allowed under different facts (say, before a call began).
    const same =
      existing.amountCents === input.amountCents &&
      existing.payeeKind === input.payeeKind &&
      existing.category === input.category &&
      existing.payeeName === input.payeeName &&
      existing.onCall === input.onCall &&
      existing.guardScore === (input.guard?.score ?? null) &&
      existing.guardModelVersion === (input.guard?.modelVersion ?? null) &&
      existing.explanation === input.explanation &&
      existing.billDueDate === (input.billDueDate ?? null) &&
      existing.initiatedBy === (input.initiatedBy ?? 'device');
    if (!same) {
      throw new PaymentError(
        'idempotency_conflict',
        'This idempotency key was already used for a different payment.',
      );
    }
    // A crash between approval and sending leaves it 'approved'; finish the job.
    return existing.status === 'approved' ? executePayment(existing.id) : existing;
  }

  /**
   * A family member's answer. Wins only if the payment is still held and the
   * deadline has not passed, both checked by the database in the same UPDATE.
   */
  async function decidePayment(input: {
    paymentId: string;
    member: { auth0Sub: string } | { memberId: string };
    decision: 'approve' | 'deny';
    via: DecisionChannel;
  }): Promise<Payment> {
    const bySub = 'auth0Sub' in input.member ? input.member.auth0Sub : null;
    const byId = 'memberId' in input.member ? input.member.memberId : null;

    const decided = await transaction(pool, async (client) => {
      const locked = await client.query<PaymentRow>(
        `select ${COLUMNS.replace(/(\w+)/g, 'p.$1')} from payments p
         where p.id = $1 and exists (select 1 from circle_members m
           where m.circle_id = p.circle_id and (m.auth0_sub = $2 or m.id = $3)
             and m.role = 'approver') for update`,
        [input.paymentId, bySub, byId],
      );
      const row = locked.rows[0];
      if (!row) throw new PaymentError('not_found', 'Payment not found or approval permission missing');
      if (row.status !== 'held') return null;
      // The circle lock orders this against a Freeze tap. While frozen the
      // spending money is in the vault, so an approval would pay from nothing.
      const circle = await client.query<{ frozen: boolean }>(
        'select frozen from circles where id = $1 for update', [row.circle_id],
      );
      if (input.decision === 'approve' && circle.rows[0]?.frozen) {
        throw new PaymentError('frozen', 'Spending is frozen. Unfreeze first.', toPayment(row));
      }
      const member = await client.query<{ id: string }>(
        `select id from circle_members where circle_id = $1 and role = 'approver'
         and (auth0_sub = $2 or id = $3) for share`, [row.circle_id, bySub, byId],
      );
      if (!member.rows[0]) throw new PaymentError('not_found', 'Approval permission missing');
      const voted = await client.query(
        `insert into payment_votes(payment_id, member_id, decision, via)
         select $1, $2, $3, $4 where exists
           (select 1 from payments where id = $1 and expires_at > clock_timestamp())
         on conflict (payment_id, member_id) do update set decision = 'deny', via = excluded.via
           where excluded.decision = 'deny' and payment_votes.decision = 'approve'`,
        [row.id, member.rows[0].id, input.decision, input.via],
      );
      if (!voted.rowCount) {
        const live = await client.query('select 1 from payments where id = $1 and expires_at > clock_timestamp()', [row.id]);
        return live.rowCount ? toPayment(row) : null;
      }
      const tally = await client.query<{ denied: boolean; approvals: number }>(
        `select coalesce(bool_or(v.decision = 'deny'), false) as denied,
           count(*) filter(where v.decision = 'approve')::int as approvals
         from payment_votes v join circle_members m on m.id = v.member_id
         where v.payment_id = $1 and m.role = 'approver'`, [row.id],
      );
      if (!tally.rows[0]!.denied && tally.rows[0]!.approvals < row.approvals_required) return toPayment(row);
      const updated = await client.query<PaymentRow>(
        `update payments set status = $2, decided_by = $3, decided_via = $4,
          decided_at = clock_timestamp(), updated_at = clock_timestamp()
         where id = $1 and status = 'held' and expires_at > clock_timestamp() returning ${COLUMNS}`,
        [row.id, tally.rows[0]!.denied ? 'denied' : 'approved', member.rows[0].id, input.via],
      );
      return updated.rows[0] ? toPayment(updated.rows[0]) : null;
    });
    if (decided) return decided.status === 'approved' ? executePayment(decided.id) : decided;

    // It did not win. Say why, without revealing payments in other circles.
    const { rows: visible } = await pool.query<PaymentRow>(
      `select ${COLUMNS.replace(/(\w+)/g, 'p.$1')}
         from payments p
         join circle_members m on m.circle_id = p.circle_id
        where p.id = $1 and (m.auth0_sub = $2 or m.id = $3)`,
      [input.paymentId, bySub, byId],
    );
    const current = visible[0] ? toPayment(visible[0]) : null;
    if (!current) throw new PaymentError('not_found', 'Payment not found');
    if (current.status === 'held') {
      await expireOverdue(current.circleId);
      throw new PaymentError(
        'expired',
        'Nobody answered in time, so this payment was blocked.',
        (await getPayment(current.id)) ?? current,
      );
    }
    throw new PaymentError(
      current.status === 'expired' ? 'expired' : 'already_decided',
      current.status === 'expired'
        ? 'Nobody answered in time, so this payment was blocked.'
        : 'Someone in the family already answered.',
      current,
    );
  }

  /** Held payments past their deadline become `expired`: blocked. */
  async function expireOverdue(circleId: string): Promise<number> {
    const { rowCount } = await pool.query(
      `update payments
          set status = 'expired', decided_via = 'timeout',
              decided_at = expires_at, updated_at = now()
        where circle_id = $1 and status = 'held' and expires_at <= now()`,
      [circleId],
    );
    return rowCount ?? 0;
  }

  async function ensureMerchant(name: string, category: Category): Promise<string> {
    const key = [normalizeName(name), category];
    const select = `select nessie_merchant_id from nessie_merchants
                     where normalized_name = $1 and category = $2`;
    const found = await pool.query<{ nessie_merchant_id: string }>(select, key);
    if (found.rows[0]) return found.rows[0].nessie_merchant_id;

    const nessieMerchantId = await nessie.createMerchant(
      merchantBody({ name, category, ...DEMO_MERCHANT_LOCATION }),
    );
    // Two payments creating the same merchant at once: keep whichever landed first.
    await pool.query(
      `insert into nessie_merchants (normalized_name, category, name, nessie_merchant_id)
       values ($1, $2, $3, $4) on conflict do nothing`,
      [...key, name, nessieMerchantId],
    );
    const stored = await pool.query<{ nessie_merchant_id: string }>(select, key);
    return stored.rows[0]?.nessie_merchant_id ?? nessieMerchantId;
  }

  /**
   * Sends an approved payment to Nessie, exactly once. The `approved ->
   * paying` claim is a conditional UPDATE, so if two requests race here only
   * one of them sends.
   */
  async function executePayment(id: string): Promise<Payment> {
    const claimed = await pool.query<PaymentRow>(
      `update payments set status = 'paying', updated_at = now()
        where id = $1 and status = 'approved'
       returning ${COLUMNS}`,
      [id],
    );
    if (!claimed.rows[0]) {
      const current = await getPayment(id);
      if (!current) throw new PaymentError('not_found', 'Payment not found');
      return current;
    }
    const payment = toPayment(claimed.rows[0]);
    const circle = await circleSettings(payment.circleId);
    const common = { amountCents: payment.amountCents, at: new Date(), timeZone: circle.timeZone };

    let kind: 'purchase' | 'withdrawal' | 'bill';
    let send: () => Promise<string>;
    try {
      switch (payment.payeeKind) {
        case 'merchant': {
          const merchantId = await ensureMerchant(payment.payeeName, payment.category);
          const body = purchaseBody({
            ...common,
            merchantId,
            description: taggedDescription(CATEGORY_LABELS[payment.category], payment.id),
          });
          kind = 'purchase';
          send = () => nessie.createPurchase(circle.nessieAccountId, body);
          break;
        }
        case 'person': {
          const body = withdrawalBody({
            ...common,
            description: taggedDescription(`To ${payment.payeeName}`, payment.id),
          });
          kind = 'withdrawal';
          send = () => nessie.createWithdrawal(circle.nessieAccountId, body);
          break;
        }
        case 'biller': {
          const body = paidBillBody({
            ...common,
            payee: payment.payeeName,
            nickname: taggedDescription(`${CATEGORY_LABELS[payment.category]}${payment.billDueDate ? ` due ${payment.billDueDate}` : ''}`, payment.id),
            dueDate: payment.billDueDate ?? undefined,
          });
          kind = 'bill';
          send = () => nessie.createBill(circle.nessieAccountId, body);
          break;
        }
      }
    } catch (error) {
      // Nothing reached Nessie yet (a merchant create is not a payment).
      return markFailed(payment.id, `Could not prepare the payment: ${messageOf(error)}`);
    }

    // Restart the reconcile clock at the send itself, not at the claim: the
    // merchant lookup above can take a while, and a concurrent read must not
    // conclude "failed" while this send is still about to happen.
    // If that touches no row, a concurrent read already concluded this payment
    // (preparation ran past the reconcile window), so it must not be sent.
    const stillPaying = await pool.query(
      `update payments set updated_at = now(), sent_at = now(),
              next_lookup_at = now() + make_interval(secs => $2)
        where id = $1 and status = 'paying'`,
      [payment.id, LOOKUP_INTERVAL_SECONDS],
    );
    if (stillPaying.rowCount === 0) {
      const current = await getPayment(id);
      if (!current) throw new PaymentError('not_found', 'Payment not found');
      return current;
    }

    // Only the send is guarded here. Once Nessie has said yes, nothing that
    // goes wrong afterwards may mark this payment failed: the money moved.
    let nessieId: string;
    try {
      nessieId = await send();
    } catch (error) {
      if (error instanceof NessieError && error.outcomeUnknown) {
        // Too soon to call it failed: a write that timed out on our side can
        // still land at Nessie. Look now; if it is not there yet, stay `paying`.
        return reconcile(payment, circle.nessieAccountId, { mayConcludeFailed: false });
      }
      return markFailed(payment.id, messageOf(error));
    }
    return recordPaid(payment, kind, nessieId);
  }

  /**
   * Records a payment Nessie confirmed. If our own bookkeeping fails, the
   * payment stays `paying` with a note, and a later read finds it at Nessie by
   * its tag and records it then. It is never marked failed.
   */
  async function recordPaid(
    payment: Payment,
    kind: 'purchase' | 'withdrawal' | 'bill',
    nessieId: string,
  ): Promise<Payment> {
    try {
      return await markPaid(payment, kind, nessieId);
    } catch (error) {
      await notePaying(
        payment.id,
        `Sent to Nessie but not yet recorded here (${messageOf(error).slice(0, 200)})`,
      ).catch(() => {});
      throw error;
    }
  }

  /** Leaves a payment `paying`, with a note for the dashboard. */
  async function notePaying(id: string, note: string): Promise<void> {
    await pool.query(
      `update payments set failure = $2 where id = $1 and status = 'paying'`,
      [id, note],
    );
  }

  /**
   * After a write whose outcome is unknown: look for the payment's tag at
   * Nessie instead of sending again. Finding it settles it. Not finding it
   * settles it only when enough time has passed since the last attempt that a
   * slow write would have landed (`mayConcludeFailed`); until then it stays
   * `paying` and a later read looks again.
   */
  async function reconcile(
    payment: Payment,
    nessieAccountId: string,
    conclusion:
      | { mayConcludeFailed: false }
      // `observedUpdatedAt`: the payment's updated_at when it was judged stale,
      // as Postgres text (microseconds; a JS Date would drop them).
      | { mayConcludeFailed: true; observedUpdatedAt: string },
  ): Promise<Payment> {
    let record;
    try {
      record = await nessie.findRecordForPayment(nessieAccountId, payment.id);
    } catch {
      await notePaying(payment.id, 'Nessie did not confirm this payment; checking again shortly');
      return (await getPayment(payment.id)) ?? payment;
    }
    if (record && record.kind !== 'deposit') {
      return recordPaid(payment, record.kind, record.nessieId);
    }
    if (!conclusion.mayConcludeFailed) {
      await notePaying(payment.id, 'Nessie has not confirmed this payment yet; checking again shortly');
      return (await getPayment(payment.id)) ?? payment;
    }
    // Conclude only if nobody touched the payment while we were looking. A
    // slow original request restarts updated_at just before it sends; if that
    // happened, this update matches nothing and the send goes ahead. If this
    // lands first, that request sees the payment is no longer `paying` and
    // does not send. The row lock makes the two mutually exclusive.
    return markFailed(payment.id, 'Nessie never confirmed this payment and has no record of it', {
      ifUpdatedAt: conclusion.observedUpdatedAt,
    });
  }

  /**
   * Settles a payment left `paying`: a send cut off mid-flight, or one waiting
   * on reconciliation. Claims one Nessie lookup per interval across all readers.
   * An absent record cannot mean failure until the last send is old enough.
   */
  async function reconcileIfStuck(payment: Payment): Promise<Payment> {
    if (payment.status !== 'paying') return payment;
    const { rows } = await pool.query<{ observed: string; long_enough: boolean }>(
      `update payments set next_lookup_at = now() + make_interval(secs => $2)
        where id = $1 and status = 'paying' and next_lookup_at <= now()
          and (sent_at is not null or updated_at < now() - make_interval(secs => $3))
       returning updated_at::text as observed,
              -- Never sent (died before the send): nothing can land, safe to fail.
              (sent_at is null or sent_at < now() - make_interval(mins => $4))
                and updated_at < now() - make_interval(secs => $3) as long_enough`,
      [payment.id, LOOKUP_INTERVAL_SECONDS, STUCK_PAYING_SECONDS, UNKNOWN_OUTCOME_MINUTES],
    );
    if (!rows[0]) return payment;
    const circle = await circleSettings(payment.circleId);
    // Too soon after the send to call it failed: look, and if it is not at
    // Nessie yet, keep showing "sending". Telling someone "failed" invites a
    // second payment, and the first may still land.
    if (!rows[0].long_enough) {
      return reconcile(payment, circle.nessieAccountId, { mayConcludeFailed: false });
    }
    return reconcile(payment, circle.nessieAccountId, {
      mayConcludeFailed: true,
      observedUpdatedAt: rows[0].observed,
    });
  }

  /** paying -> paid, and the ledger row, in one transaction; once only. */
  async function markPaid(
    payment: Payment,
    kind: 'purchase' | 'withdrawal' | 'bill',
    nessieId: string,
  ): Promise<Payment> {
    return transaction(pool, async (client) => {
      const { rows } = await client.query<PaymentRow>(
        `update payments
            set status = 'paid', nessie_kind = $2, nessie_id = $3,
                failure = null, updated_at = now()
          where id = $1 and status = 'paying'
         returning ${COLUMNS}`,
        [payment.id, kind, nessieId],
      );
      if (!rows[0]) return (await getPayment(payment.id, client)) ?? payment;
      // Claim the Nessie record first; the ledger gets a row only if it is new.
      const claim = await client.query(
        `insert into spending_nessie_records (nessie_id, circle_id) values ($1, $2)
         on conflict do nothing`,
        [nessieId, payment.circleId],
      );
      if (claim.rowCount) {
        await client.query(
          `insert into spending (occurred_at, circle_id, amount_cents, category, payee_name, payment_id, nessie_id)
           values (now(), $1, $2, $3, $4, $5, $6)`,
          [payment.circleId, payment.amountCents, payment.category, payment.payeeName, payment.id, nessieId],
        );
      }
      return toPayment(rows[0]);
    });
  }

  /** paying -> failed. With `ifUpdatedAt`, only if the row is unchanged since then. */
  async function markFailed(
    id: string,
    failure: string,
    options: { ifUpdatedAt?: string } = {},
  ): Promise<Payment> {
    const { rows } = await pool.query<PaymentRow>(
      `update payments set status = 'failed', failure = $2, updated_at = now()
        where id = $1 and status = 'paying'
          and ($3::timestamptz is null or updated_at = $3::timestamptz)
       returning ${COLUMNS}`,
      [id, failure.slice(0, 500), options.ifUpdatedAt ?? null],
    );
    if (rows[0]) return toPayment(rows[0]);
    const current = await getPayment(id);
    if (!current) throw new PaymentError('not_found', 'Payment not found');
    return current;
  }

  /**
   * The phone's view of one of its payments. Applies anything that is due
   * first (an expired deadline, a crashed send), so polling this endpoint is
   * also what moves stalled payments forward.
   */
  async function paymentForCircle(circleId: string, id: string): Promise<Payment> {
    await expireOverdue(circleId);
    const { rows } = await pool.query<PaymentRow>(
      `select ${COLUMNS} from payments where id = $1 and circle_id = $2`,
      [id, circleId],
    );
    if (!rows[0]) throw new PaymentError('not_found', 'Payment not found');
    const payment = toPayment(rows[0]);
    if (payment.status === 'approved') return executePayment(payment.id);
    return reconcileIfStuck(payment);
  }

  /** Newest first, across circles, with overdue holds expired first. */
  async function listPayments(
    circleIds: string[],
    options: { heldOnly: boolean; limit: number },
  ): Promise<Payment[]> {
    if (circleIds.length === 0) return [];
    await Promise.all(circleIds.map(expireOverdue));
    const { rows } = await pool.query<PaymentRow>(
      `select ${COLUMNS} from payments
        where circle_id = any($1::uuid[]) and (not $2 or status = 'held')
        order by created_at desc
        limit $3`,
      [circleIds, options.heldOnly, options.limit],
    );
    return rows.map(toPayment);
  }

  return {
    createPayment,
    decidePayment,
    expireOverdue,
    executePayment,
    paymentForCircle,
    getPayment,
    listPayments,
  };
}

export type PaymentService = ReturnType<typeof createPaymentService>;

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
