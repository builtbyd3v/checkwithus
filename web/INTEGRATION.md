# Backend integration

Production base URL: `https://checkwith.us/api/v1`.

## Authentication and money

- Device routes use `Authorization: Bearer <deviceToken>` from device pairing.
- Family routes use an Auth0 access token with this backend's configured audience. An ID token is not an API credential.
- Dashboard sessions use Auth0 cookies; mobile API authentication uses bearer tokens.
- Amounts are integer cents. For example, `$84.12` is `8412`. Merchant and person payments must be whole dollars because Nessie truncates fractions; bills can include cents. Invalid whole-dollar amounts return `422 whole_dollars_only`.
- Scam detection stays on the phone. Send its score/version and explanation for the family, not raw message or bill contents for cloud inference.
- API responses are not cached. Errors have `error` and `message`, and validation errors may include `details`.

## Endpoint map

All paths below are relative to the base URL.

| Method and path | Credential | Purpose |
| --- | --- | --- |
| `POST /device/pair` | One-time pairing code in body | Exchange `{code, label}` for a device token |
| `GET /device/config` | Device | Family names, hold threshold, timeout, locked app groups |
| `GET /device/bank-locations` | Device | Cached public Nessie ATM/branch directory for on-device bank-location checks |
| `POST /device/alerts` | Device | Record `ask_family` or `bank_during_call` with optional detail |
| `GET /device/labels?cursor=<nextCursor>` | Device | Family decisions as labels for local training; optional legacy `after` starting filter |
| `POST /payments` | Device | Request a payment with an idempotency key |
| `GET /payments/:id` | Device | Poll payment state; process Guardian answers and recover interrupted sends |
| `GET /family/me` | Family | Circles the signed-in member belongs to |
| `POST /family/join` | Family | Join with `{inviteCode, displayName}` |
| `POST /family/circles/:id/pairing-code` | Family | Generate a one-time device pairing code |
| `GET /family/alerts` | Family | Recent alerts from the member's circles |
| `GET /family/payments` | Family | Latest 50 payments across the member's circles |
| `GET /family/payments?status=held` | Family | Pending payments, independently of recent completed payments |
| `GET /family/payments/:id` | Family | Payment detail, Guardian polling and interrupted-send recovery |
| `POST /family/payments/:id/decision` | Family | `{decision: "approve" \| "deny"}`; CIBA mode accepts denial only |

Health endpoint: `GET https://checkwith.us/api/health`.

Bank directory entries contain `id`, `kind` (`atm` or `branch`), `name`, `coordinates` (`latitude`, `longitude`, or null), and `address` (or null). Use only entries with coordinates for geofences; do not treat a missing coordinate as zero. Match the phone's location locally, then post `bank_during_call` when the iOS call/location rules trigger. No phone location is required by the directory endpoint. The directory is cached with Next's `hours` profile.

## Payment flow

Create one idempotency key per attempted payment and keep it for retries. Reusing it with a different request returns `409 idempotency_conflict`.

```json
{
  "idempotencyKey": "demo-bill-2026-10-17-001",
  "amountCents": 8412,
  "payee": { "name": "City Power & Light", "kind": "biller" },
  "category": "utilities",
  "onCall": false,
  "guard": { "score": 0.03, "modelVersion": "guard-test" },
  "explanation": null
}
```

Poll the appropriate detail endpoint while status is `held`, `approved`, or `paying`. Use about a five-second interval, avoid overlapping requests, and stop at a terminal state. Server-side claims enforce Auth0's polling interval and throttle Nessie reconciliation independently of client requests. Use backoff on network failures and honor `Retry-After` when present.

The family detail endpoint returns the same payment shape as entries in the family list: id, circleId, protectedName, status, amountCents, payee, category, holdReasons, guard, explanation, timestamps, decidedVia and decidedByName. It returns `404` both for an unknown payment and one outside the member's circles. It never authorizes an undecided payment merely because it was read.

| State | Meaning |
| --- | --- |
| `held` | Waiting for family; no bank send |
| `approved` / `paying` | Authorized or being reconciled; keep polling, do not submit a new payment |
| `paid` | Nessie record confirmed |
| `denied` | Family blocked it |
| `expired` | No decision before the deadline; blocked |
| `failed` | Send failed or reconciliation concluded failure |

In CIBA mode an API approval returns `403 approve_in_guardian`. The member must approve through Guardian. A denial through the API can only stop money. Conflicting or late decisions return `409`, including current payment details when available.

## Demo setup and boundaries

Run `npm run db:migrate` and `npm run seed:demo` from `web/` with local environment variables configured. The seed creates synthetic Rosa data, known payees, historical spending, and an invite. Sign in, join with that invite, then generate a pairing code in the dashboard for the iPhone.

`npm run check:nessie` reads the synthetic account on both supported Nessie hosts. Add `-- --write` to verify one $1 utility payment per host through the normal rules and ledger. Fixed idempotency keys make repeat checks read the same payments rather than resend. The check prints statuses and synthetic balance amounts, never API keys. Both hosts were verified on October 17, 2026. Nessie's reported account balance did not change after those payments, so it is not currently an authoritative spendable balance; payment accounting remains in Tiger Data.

The current demo provisions circles and Nessie accounts through the seed. It does not include general customer/account onboarding, bank linking, or a public circle-creation endpoint. Known payees, hold limits, invites, and pairing codes can be managed through the dashboard; full mobile settings CRUD is not implemented.

Approval polling and recovery run on requests. There is no scheduled worker: if every app closes, there is no autonomous polling. Overdue holds fail closed on the next read or decision attempt. The dashboard currently refreshes on navigation or reload rather than continuously polling.

Guardian enrollment and a real mobile sign-in/approval run are required to verify the full integration. Alerts are stored for family API reads; they do not currently send an APNs notification. Device code must poll for them.

The learning-label endpoint returns `{labels, nextCursor, hasMore}` with at most 200 labels. Start with no parameters (or a legacy `after` time), then send `cursor=nextCursor` without `after`. The opaque cursor preserves database timestamp precision and breaks equal timestamps by payment id. Save the last non-null cursor as a checkpoint even when `hasMore` is false; an empty poll returns a null cursor, so retain your previous checkpoint. Deduplicate labels by paymentId locally.

## Family policies for dashboard integration (#14, #19)

Migration `011_family_policies.sql` adds circle roles, a two-approval threshold,
distinct approval votes, and allowances. Existing members retain their authority.
The first member bootstraps an empty circle as approver; subsequent invite joins
are viewers until an approver promotes them using the policy endpoint. An approver has the server-side `approve:payments`
permission within their circle. Viewers can read but cannot decide payments,
change hold limits/payees, issue pairing/invite codes, or grant/revoke allowances.

All routes below are under `/api/v1` and use the existing verified family bearer
token. Circle access is checked server-side.

| Route | Input / result |
| --- | --- |
| `GET /family/circles/:id/balance` | Live Nessie reported balance, ledger balance, reservations, conservative available amount, timestamp |
| `POST /family/circles/:id/policy` | `{action:"threshold",twoApprovalsOverCents:100000}` or `{action:"role",memberId,role:"approver"\|"viewer"}`; fresh approver login required |
| `GET /family/circles/:id/allowances` | `{allowances:[...]}` with active scope, cap, expiry and grantor |
| `POST /family/circles/:id/allowances` | `{payeeId:null,category:"utilities",maxAmountCents:20000,expiresAt:"2026-11-30T23:59:00Z"}`; exactly one of payeeId/category, fresh approver login required |
| `DELETE /family/circles/:id/allowances/:allowanceId` | Approver revokes immediately for subsequent payment decisions; repeat revocation is safe |

Fresh login means a verified Auth0 `auth_time` no older than five minutes, not token
issuance time. Request reauthentication with `max_age=0`; for the dashboard use
`/auth/login?max_age=0&returnTo=/dashboard`. Bearer clients must arrange for Auth0 to
include `auth_time` in the signed API token; its absence fails closed. Dashboard
server actions `grantAllowanceAction` and `revokeAllowanceAction` are available for
rgons's UI and use the authenticated session. The grant action accepts integer
`maxAmountCents`, not a dollar float. The UI should show a sign-in-again action when
step-up is required. Dashboard allowance display/forms are still to be wired by
the UI owner.

Amounts strictly above the circle's threshold (default $1,000) always hold and
require two distinct current approvers; one denial blocks. Repeated votes do not
count twice. Fewer than two approvers cannot release a two-approval payment.
The requirement is captured when the payment is created. Family payment views
include `approvalsRequired` and `allowanceId`. Guardian approvals count through
the same transaction as direct decisions. In CIBA mode direct approval remains
disabled; a login alone never substitutes for a Guardian approval.

Allowances can lift routine amount/baseline limits for known payees only. They
cannot override new payees, gift cards, crypto, wire transfers, active calls,
Guard warnings, or the two-approval threshold. Each permitted payment stores the
allowance id. Expired/revoked grants and grants by demoted members stop applying.

### Auth0 configuration and live verification still required

CIBA now sends `AUTH0_AUDIENCE` and Guardian-compatible `authorization_details`.
Register `urn:auth0:schemas:authorization-details:v1:payment` on the Auth0 API and
allow that type for this application's user grant before testing. See the
[official Guardian RAR schema](https://auth0.com/docs/get-started/apis/configure-rich-authorization-requests).
The details contain amount, payee and hold reasons, never message/bill contents.
Tenant RAR configuration and real Guardian display/approval have not been verified;
the family test account is not enrolled yet. Automated tests use a fake Auth0.

### Nessie transfer blocker (#13, #18)

Live probes on October 17 found `GET /accounts/:id/transfers` returns 404 on both
supported hosts for our existing synthetic account. Empty POSTs reach a
`TransferCreate` validator requiring transaction_date/status/amount/description.
A validation-only request with an intentionally invalid amount confirmed both
`medium` and `payee_id` are rejected as extra fields. No transfer was created.
The [published spec](https://prod.nessieisreal.com/nessie-openapi-spec.yaml) also
does not describe a destination-bearing account transfer creation contract.
Reported account balances remain unchanged after real purchases/bills.

Freeze, unfreeze, family top-up, person transfers and benefit/vault refills need
an agreed accounting contract: a Tiger Data account ledger with Nessie transfer
records, or a sponsor-supported destination transfer endpoint. They are not
implemented or claimed complete.
Latest shared main (`2471aaa`) was fetched and merged; it contains no transfer fix.

Bill requests accept optional `billDueDate` (`YYYY-MM-DD`, billers only). Migration
012 stores it and retries must preserve it. The payment is made now, including
when paying early; it is not a scheduled job. Nessie's `payment_date` is the actual
payment date, `recurring_date` uses the bill's due day, and its nickname preserves
the original due date with the reconciliation tag. A new biller still holds.

## Verification commands

Before pushing web changes run `npm run typecheck`, `npm test`, `npm run test:db`, and `npm run build`. Integration tests use synthetic Tiger Data fixtures and fake Nessie/Auth0 transports; they do not prove Guardian enrollment or the iPhone UI works.
