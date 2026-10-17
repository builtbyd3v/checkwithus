/**
 * An in-memory Nessie behind a fake `fetch`, for tests. Plug it into the real
 * `createNessieClient`, so tests exercise the client and the format boundary
 * too, down to the JSON bodies.
 *
 * Mirrors behaviour verified against the live API: creates answer
 * `{ objectCreated: { _id } }`, amounts are stored as sent, and lists answer
 * 200 []. `failNext` simulates the failures payments must survive.
 */
type Stored = { kind: 'purchases' | 'withdrawals' | 'deposits' | 'bills' | 'transfers'; accountId: string; body: Record<string, unknown> & { _id: string } };

export type FakeNessie = ReturnType<typeof createFakeNessie>;

export function createFakeNessie() {
  let nextId = 1;
  const merchants: Array<Record<string, unknown> & { _id: string }> = [];
  const accounts: Array<Record<string, unknown> & { _id: string; customer_id: string }> = [];
  const customers: Array<Record<string, unknown> & { _id: string }> = [];
  const records: Stored[] = [];
  const calls: Array<{ method: string; path: string; body: unknown }> = [];
  /**
   * The next matching write fails this way. `recordedThen500` stores the
   * record and still answers 500: the "did it go through?" case.
   */
  let pendingFailure: { pathIncludes: string; mode: 'recordedThen500' | 'lostThen500' | 'timeout' } | null =
    null;

  /** Runs once, in the middle of the next account list read: for staging races. */
  let listHook: (() => Promise<void>) | null = null;

  const id = () => `fake-${nextId++}`;

  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  async function fetch(url: string, init: RequestInit): Promise<Response> {
    const { pathname } = new URL(url);
    const method = String(init.method ?? 'GET');
    const body = init.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined;
    calls.push({ method, path: pathname, body });

    const failure =
      method === 'POST' && pendingFailure && pathname.includes(pendingFailure.pathIncludes)
        ? pendingFailure
        : null;
    if (failure) pendingFailure = null;
    if (failure?.mode === 'timeout') throw new Error('The operation was aborted due to timeout');

    if (method === 'POST' && pathname === '/merchants') {
      const merchant = { ...body, _id: id() };
      merchants.push(merchant);
      return json(201, { code: 201, message: 'Merchant created', objectCreated: merchant });
    }

    if (pathname === '/customers') {
      if (method === 'GET') return json(200, customers);
      const customer = { ...body, _id: id() };
      customers.push(customer);
      return json(201, { code: 201, message: 'Customer created', objectCreated: customer });
    }

    const customerAccounts = pathname.match(/^\/customers\/([^/]+)\/accounts$/);
    if (customerAccounts) {
      const customerId = customerAccounts[1]!;
      if (method === 'POST') {
        // Account ids are unique columns in our database, so never reuse one across fakes.
        const account = { ...body, _id: `fake-account-${crypto.randomUUID()}`, customer_id: customerId };
        if (failure?.mode !== 'lostThen500') accounts.push(account);
        if (failure) return json(500, { message: 'Internal server error' });
        return json(201, { code: 201, message: 'Account created', objectCreated: account });
      }
      return json(200, accounts.filter((a) => a.customer_id === customerId));
    }

    const accountRoute = pathname.match(/^\/accounts\/([^/]+)\/(purchases|withdrawals|deposits|bills|transfers)$/);
    if (accountRoute) {
      const [, accountId, kind] = accountRoute as [string, string, Stored['kind']];
      if (method === 'GET' && listHook) {
        const hook = listHook;
        listHook = null;
        await hook();
      }
      if (method === 'POST') {
        const record = { ...body, _id: id() };
        if (failure?.mode !== 'lostThen500') records.push({ kind, accountId, body: record });
        if (failure) return json(500, { message: 'Internal server error' });
        return json(201, { code: 201, message: 'Created', objectCreated: record });
      }
      return json(
        200,
        records.filter((r) => r.kind === kind && r.accountId === accountId).map((r) => r.body),
      );
    }

    if (method === 'GET' && pathname === '/merchants') return json(200, merchants);
    return json(404, { message: `fake Nessie has no route for ${method} ${pathname}` });
  }

  return {
    fetch,
    calls,
    records,
    accounts,
    /** Writes that reached the fake (not merchant creation). */
    paymentWrites: () =>
      calls.filter((c) => c.method === 'POST' && c.path !== '/merchants'),
    failNext(pathIncludes: string, mode: 'recordedThen500' | 'lostThen500' | 'timeout') {
      pendingFailure = { pathIncludes, mode };
    },
    /** Run `hook` while the next lookup of an account's records is in flight. */
    duringNextLookup(hook: () => Promise<void>) {
      listHook = hook;
    },
  };
}
