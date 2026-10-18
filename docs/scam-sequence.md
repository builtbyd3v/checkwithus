# Cash then gift cards (#17)

The fixed rule already holds a gift-card request after ATM cash within two hours,
including the boundary. The dashboard now shows the supporting withdrawal and
gift-card request as a timeline, with integer-cent amounts, ATM name and UTC times.

The display query in `web/lib/scam-sequence.ts` is scoped to the signed-in family's
active circle and requested payment IDs. It requires the **stored**
`cash_then_gift_card` hold reason, ignores non-ATM spending and future withdrawals,
and selects the latest eligible withdrawal before the original request time.
This is supporting history reconstructed from the ledger, not a persisted snapshot
of the exact row read by the payment rule. If no supporting row remains, the stored
hold reason still displays. No display result can authorize a payment.

Demo setup, against the existing synthetic demo circle only:

```sh
cd web
npm run demo:atm -- --with-gift-card
```

This makes one real **sandbox** $200 withdrawal and records it in the ledger, then
creates a $500 gift-card request through `createPaymentService`. The helper asserts
the request is held with the sequence reason. It sends no gift-card purchase and
seeds no Guardian push. Each run is another withdrawal, so run it once for a demo.
Keep the existing `npm run demo:atm` flow when demonstrating the subsequent request
from the phone itself. Never run either command against real people/accounts.

Before deciding the request, copy the printed held-payment UUID and run:

```sh
npm run check:sequence -- <held-payment-uuid>
```

This verifier opens a repeatable-read, read-only transaction. It checks that the
payment belongs to the synthetic demo circle, is held and unexpired, has no recorded Nessie
payment ID or payment spending row, and has the stored sequence reason plus
eligible ATM evidence through the production dashboard query. It creates no
withdrawal or payment and prints a JSON evidence record. Save its output with
the tested commit and timestamp when doing the live sandbox smoke test.
It does not independently query Nessie or prove Auth0 permissions. A failed
check is not a reason to repeat the withdrawal; inspect the existing request
and configuration first. After family denial, verify the dashboard and ledger
separately; the verifier intentionally requires the pre-decision held state.

Validation:

- Five tests execute the production display SQL in an ephemeral embedded PostgreSQL
  database (PGlite), covering the fixed-rule reason, exact two-hour boundary,
  just outside the window, future/non-ATM rows, other families and original request
  time. These tests do not claim TimescaleDB performance or live Nessie validation.
- Existing `freeze.int.test.ts` covers the actual payment service hold path on
  the migrated Tiger Data schema; it needs database credentials.
- The browser suite checks the shared timeline on a 390px viewport and writes
  [the sequence gallery image](gallery/dashboard-sequence-390.png).

For credential-free UI review, run `npm run preview:dashboard` and select
**ATM sequence**. All preview values are synthetic. Live Auth0/Nessie and the
new full demo-seed command were not run here because credentials are unavailable.

AI tool used: Codex for the dashboard evidence, local SQL tests and seed option.
