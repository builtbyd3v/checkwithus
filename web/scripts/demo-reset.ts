/**
 * Puts the demo back to a known state between expo demos. `npm run demo:reset`
 *
 *   seed-demo   Rosa's circle, accounts, purchase history, aggregates, vault
 *   then        no pending holds, not frozen, no recent ATM cash, the utility-bill allowance (#19),
 *               and a $350 water bill last paid 25 days ago for the bill-pay agent
 *
 * Refuses to run unless the tables resolve to a throwaway wt_* schema, or the
 * caller passes --live for the live schema. Safe to run again.
 */
import { pathToFileURL } from 'node:url';
import pg from 'pg';
import { transaction } from '@/lib/db';
import { dbEnv, nessieEnv } from '@/lib/env';
import { normalizeName } from '@/lib/names';
import { createNessieClient, type NessieClient } from '@/lib/nessie/client';
import { seedDemo } from './seed-demo';

/** Utility bills up to $400 until Nov 30: above the $300 hold limit, so step 6 shows it at work. */
export const DEMO_ALLOWANCE = { category: 'utilities', maxAmountCents: 40_000, expiresAt: '2026-11-30T23:59:59-05:00' } as const;

/**
 * The bill-pay agent's demo biller: last bill $350, 25 days ago, so its next
 * bill is due within the agent's 7-day window. Over the $300 hold limit and
 * inside the $400 allowance, so the allowance is what lets the agent pay.
 */
export const DEMO_AGENT_BILL = { name: 'Sunshine Water Co.', category: 'utilities', amountCents: 35_000, daysAgo: 25 } as const;

/** The schema the tables resolve to. Throws unless it is wt_*, or `live` is set. */
export async function demoTarget(pool: pg.Pool, live: boolean): Promise<string> {
  const { rows } = await pool.query<{ search_path: string; ns: string | null }>(
    `select current_setting('search_path') as search_path,
       (select n.nspname from pg_class c join pg_namespace n on n.oid = c.relnamespace
         where c.oid = to_regclass('circles')) as ns`,
  );
  const { search_path: searchPath, ns } = rows[0]!;
  // Check where `circles` resolves too: a wt_* schema without migrations falls through to public.
  const throwaway = /^\s*"?wt_/.test(searchPath) && Boolean(ns?.startsWith('wt_'));
  if (!live && !throwaway) {
    throw new Error(`Refusing: search_path is "${searchPath}" and circles is in ${ns ?? 'nothing'}. Pass --live for the live schema.`);
  }
  return ns ?? 'unknown';
}

export async function resetDemo(input: { pool: pg.Pool; nessie: NessieClient; customerLastName?: string }) {
  const { pool } = input;
  const seeded = await seedDemo(input);
  const { circleId } = seeded;
  const state = await transaction(pool, async (q) => {
    // Same row lock as payments and Freeze taps, so nothing lands mid-reset.
    await q.query('select id from circles where id = $1 for update', [circleId]);
    const expired = await q.query(
      `update payments set status = 'expired', decided_via = 'timeout', decided_at = now(), updated_at = now()
        where circle_id = $1 and status = 'held'`, [circleId],
    );
    await q.query(
      `update ciba_requests r set state = 'superseded' from payments p
        where p.id = r.payment_id and p.circle_id = $1 and r.state = 'pending'`, [circleId],
    );
    // ponytail: Nessie never updates balances, so the vault is only our ledger.
    // Clearing it restores the spending balance without a transfer back.
    await q.query('update circles set frozen = false where id = $1', [circleId]);
    const cleared = await q.query('delete from vault_transfers where circle_id = $1', [circleId]);
    // Last demo's step 4 cash would add "cash then gift card" to the next step 3.
    // ponytail: its spending_nessie_records claim stays, so nothing re-imports it.
    const atm = await q.query(
      `delete from spending where circle_id = $1 and atm_id is not null and occurred_at >= now() - interval '3 hours'`,
      [circleId],
    );

    // Exactly one live allowance: the demo's. Granted by the first approver,
    // because payments only honor allowances an approver granted.
    const approver = await q.query<{ id: string }>(
      `select id from circle_members where circle_id = $1 and role = 'approver' order by created_at limit 1`, [circleId],
    );
    const keep = await q.query<{ id: string }>(
      `select id from allowances
        where circle_id = $1 and revoked_at is null and payee_id is null and category = $2
          and max_amount_cents = $3 and expires_at = $4::timestamptz and granted_by = $5
        order by created_at limit 1`,
      [circleId, DEMO_ALLOWANCE.category, DEMO_ALLOWANCE.maxAmountCents, DEMO_ALLOWANCE.expiresAt, approver.rows[0]?.id ?? null],
    );
    await q.query(
      `update allowances set revoked_at = now() where circle_id = $1 and revoked_at is null and id is distinct from $2`,
      [circleId, keep.rows[0]?.id ?? null],
    );
    if (!keep.rows[0] && approver.rows[0]) {
      await q.query(
        `insert into allowances (circle_id, category, max_amount_cents, expires_at, granted_by) values ($1, $2, $3, $4, $5)`,
        [circleId, DEMO_ALLOWANCE.category, DEMO_ALLOWANCE.maxAmountCents, DEMO_ALLOWANCE.expiresAt, approver.rows[0].id],
      );
    }
    // The agent's biller, with one fresh last bill. Last demo's agent payment
    // and its ledger row go, so the agent pays it again in this demo.
    // ponytail: the history row is ledger-only (no Nessie record); a bank feed would supply it.
    await q.query(
      `insert into payees (circle_id, name, normalized_name, kind, category) values ($1, $2, $3, 'biller', $4)
       on conflict (circle_id, kind, normalized_name) do nothing`,
      [circleId, DEMO_AGENT_BILL.name, normalizeName(DEMO_AGENT_BILL.name), DEMO_AGENT_BILL.category],
    );
    await q.query('delete from spending where circle_id = $1 and payee_name = $2', [circleId, DEMO_AGENT_BILL.name]);
    await q.query(`delete from payments where circle_id = $1 and initiated_by = 'agent' and payee_name = $2`, [circleId, DEMO_AGENT_BILL.name]);
    await q.query(
      `insert into spending (occurred_at, circle_id, amount_cents, category, payee_name)
       values (now() - make_interval(days => $4), $1, $2, $3, $5)`,
      [circleId, DEMO_AGENT_BILL.amountCents, DEMO_AGENT_BILL.category, DEMO_AGENT_BILL.daysAgo, DEMO_AGENT_BILL.name],
    );
    const members = approver.rows[0] ? [] : (await q.query<{ id: string; display_name: string; role: string }>(
      'select id, display_name, role from circle_members where circle_id = $1 order by created_at', [circleId],
    )).rows;
    return {
      holdsExpired: expired.rowCount ?? 0, vaultRowsCleared: cleared.rowCount ?? 0, atmRowsCleared: atm.rowCount ?? 0,
      allowance: Boolean(approver.rows[0]), members,
    };
  });
  return { ...seeded, ...state };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== '--live')) throw new Error('Only --live is supported');
  const live = args.includes('--live');
  const pool = new pg.Pool({ connectionString: dbEnv().DATABASE_URL, max: 2 });
  try {
    const schema = await demoTarget(pool, live);
    // A throwaway schema gets its own synthetic Nessie customer, never live Rosa's accounts.
    const customerLastName = live ? undefined : `CheckWithSynthetic${schema.replace(/[^a-z0-9]/gi, '')}`;
    const nessie = createNessieClient({ key: nessieEnv().NESSIE_API_KEY });
    const r = await resetDemo({ pool, nessie, customerLastName });
    console.log(`Reset demo in schema ${schema}: circle ${r.circleId}, vault account ${r.vaultId}`);
    console.log(`Nessie records created: ${r.created}; ledger rows added: ${r.ledgerAdded}`);
    console.log(`Holds expired: ${r.holdsExpired}; vault rows cleared: ${r.vaultRowsCleared}; ATM cash rows cleared: ${r.atmRowsCleared}; not frozen`);
    const rerun = `npm run demo:reset${live ? ' -- --live' : ''}`;
    if (r.allowance) console.log('Allowance: utilities up to $400 until Nov 30. npm run agent:bills pays the $350 water bill under it.');
    else if (!r.members.length) console.log(`No allowance: nobody has joined the circle. Join with the invite code, make that member an approver, then ${rerun}.`);
    else {
      // Roles are the family's call, so reset never changes them; it says what to run.
      console.log('No allowance: the circle has no approver. To make a member an approver, run this SQL on this database, then ' + rerun + ':');
      for (const m of r.members) {
        console.log(`  -- ${m.display_name} (now ${m.role})\n  update circle_members set role = 'approver' where id = '${m.id}';`);
      }
    }
    if (r.invite) console.log(`Family invite code: ${r.invite.code} (expires ${r.invite.expiresAt})`);
    console.log('Run npm run demo:atm right before demo step 4.');
  } finally {
    await pool.end();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Demo reset failed');
    process.exitCode = 1;
  });
}
