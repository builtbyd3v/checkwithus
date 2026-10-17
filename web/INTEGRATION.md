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
| `POST /family/payments/:id/decision` | Family (approver) | `{decision: "approve" \| "deny"}`; CIBA mode accepts denial only; `403 permission_required` if the token has a `permissions` claim without `approve:payments` |
| `POST /family/circles/:id/freeze` | Family (approver) | `{}` -> `{frozen: true, movedCents}`: spending balance to the vault |
| `POST /family/circles/:id/unfreeze` | Family (approver, fresh login) | `{amountCents}` -> `{frozen: false, movedCents}`: that amount back |
| `GET /family/circles/:id/balance` | Family | Ledger balance (vault excluded) and `frozen` |

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

Run `npm run db:migrate` and `npm run seed:demo` from `web/` with local environment variables configured. The seed creates synthetic Rosa data, known payees, historical spending, the Freeze vault account, and an invite. Sign in, join with that invite, then generate a pairing code in the dashboard for the iPhone.

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

### Auth0 for AI agents: what needs whom

The AI on the phone only suggests: its score can add a hold reason, never remove
one. Fixed rules decide, and Auth0 decides who may override them.

| What happens | Who must say yes | How |
| --- | --- | --- |
| A payment inside an allowance (known payee, matching payee or category, at or under the cap, before expiry, granted by a current approver, no scam reason, under the two-approval threshold) | Nobody: it pays at once | The payment stores `allowanceId` |
| Any held payment (new payee, gift card, crypto, wire, during a call, Guard flag, over the hold limit, unusual spending, ATM cash then gift card, frozen) | One approver | CIBA push to every approver's Auth0 Guardian (`APPROVAL_MODE=ciba`), or the family app (`app` mode) |
| A held payment over the two-approval threshold (default $1,000) | Two distinct approvers; one Deny stops it | Same channels; one tally across them |
| Grant an allowance, change the threshold or roles, unfreeze | One approver with a fresh login (`auth_time` within 5 minutes) | `max_age=0` sign-in |
| Deny, freeze, revoke an allowance | One approver, no fresh login | These only stop money |

Approver means the circle role in our database. When the verified Auth0 token
carries a `permissions` claim, it must also list `approve:payments`: the family
API decision route returns `403 permission_required` otherwise, and a Guardian
approval whose access token lacks it is recorded as failed, not counted. Tokens
without the claim (RBAC off) keep working on the circle role alone. Other
approver routes (allowances, freeze, policy) check the circle role only.

Two-approval quorum is tested on both paths: `app/api/v1/api.int.test.ts`
(family app route: one approval holds, a repeat does not count, the second
approver pays once, approve then deny blocks) and `lib/approvals.int.test.ts`
(Guardian through a fake Auth0: the same cases, plus a Guardian vote and an app
vote together).

### CIBA push details (`AUTH0_CIBA_RAR`)

Every push has a binding message such as `Rosa: 1,500.00 USD to QuickGift
Cards` (letters, digits, whitespace and `+-_.,:#`, at most 64 characters).

With `AUTH0_CIBA_RAR=true`, `bc-authorize` also sends `audience=AUTH0_AUDIENCE`
and one Rich Authorization Requests object of type
`urn:auth0:schemas:authorization-details:v1:payment` in Auth0's Guardian display
schema: amount, payee, plain-words hold reasons, "Approvals needed" when two are
required, and a hidden integer `amount_cents`. Never message or bill contents.
If Auth0 answers 400, the push is retried once without audience and details.
Unset or `false` sends neither. That is the default because our tenant refuses
`audience` today: a probe on October 17 (a user that does not exist, so no push)
answered `Client ... is not authorized to access resource server`.

Docs: [CIBA with RAR](https://auth0.com/docs/get-started/authentication-and-authorization-flow/client-initiated-backchannel-authentication-flow/user-authorization-with-ciba),
[Configure RAR](https://auth0.com/docs/get-started/apis/configure-rich-authorization-requests),
[Client grants](https://auth0.com/docs/get-started/applications/application-access-to-apis-client-grants),
[RBAC for APIs](https://auth0.com/docs/manage-users/access-control/configure-core-rbac/enable-role-based-access-control-for-apis).

### Auth0 dashboard steps (Dev)

1. APIs > the API whose Identifier is `AUTH0_AUDIENCE` > Permissions: add
   `approve:payments`. Settings > RBAC: turn on Enable RBAC and Add Permissions
   in the Access Token. User Management > Roles: create `Approver` with that
   permission and assign it to each approver.
2. Same API > Settings > Application Access Policy: User-Delegated Access to
   Per-app authorization. Application Access tab > the web app > User-Delegated
   Access > Grant Access, with `approve:payments`.
3. Register the details type on the API (Management API):
   `PATCH /api/v2/resource-servers/{id}` with
   `{"authorization_details":[{"type":"urn:auth0:schemas:authorization-details:v1:payment"}]}`.
   With Per-app authorization, also add it to the app's user client grant:
   `PATCH /api/v2/client-grants/{id}` with
   `{"authorization_details_types":["urn:auth0:schemas:authorization-details:v1:payment"]}`.
4. Set `AUTH0_CIBA_RAR=true` and run `npm run check:auth0`. It must print
   `✓ CIBA with audience + authorization_details`. The probe uses a user that
   does not exist, so it sends no push.
5. Enroll a family test account in Guardian and approve one real push. Not yet
   done: Guardian display of the details and an RBAC-carrying token are untested
   against the real tenant. Automated tests use `test/fake-auth0.ts`.

### Freeze (#18) and Nessie transfers

Freeze is implemented. One tap sets the circle frozen, then moves the spendable
ledger balance (whole dollars, less approved or sending payments) to a vault
account with one Nessie transfer. The vault is a Savings account created on the
first freeze. Every new payment is then held with "Your family froze spending",
and approving an already held payment answers `409 frozen` ("Spending is frozen.
Unfreeze first."); denying still works. A retry of a tap moves nothing and returns
the first answer. Unfreeze needs an approver with a fresh login (`403
step_up_required` otherwise), returns `409 not_enough_in_vault` over the vault total,
`409 freeze_in_progress` while a freeze sent in the last 30 seconds is unconfirmed,
and `422 whole_dollars_only` for cents. Viewers get `403`. The vault total is our
Tiger Data ledger (`vault_transfers`), like spending.

Nessie transfer quirks, verified live on October 17 (a synthetic probe customer froze
$1,000 from an account Nessie stores at $50 into a vault opened at $0, then unfroze $400):

- `POST /accounts/:id/transfers` accepts exactly `transaction_date`, `status`,
  `amount`, `description`. `medium` and `payee_id` are rejected, so a transfer
  cannot name its destination. Our description names it, with a `[cw:<id>]` tag.
- Amounts with cents are truncated to whole dollars, like purchases.
- Nessie does not check or change stored balances: the $1,000 transfer from a $50
  account was accepted, and both stored balances stayed the same.
- `GET /accounts/:id/transfers` answers `404 "No transfers found"` when empty,
  not `200 []`, and lists rows with `id` instead of `_id`.
- A transfer whose outcome is unknown (timeout or 5xx) is not retried or looked up;
  it stays `sending` and counts as moved.

### Scam sequence (#17)

A gift card bought within two hours of ATM cash (boundary included) is held with
"Cash at an ATM, then a gift card. Scammers often ask for this." Nessie
withdrawals carry no time and no ATM, so ATM cash enters the ledger with
`spending.atm_id`. For demo step 4 run `npm run demo:atm` right before showing it:
it records one $200 withdrawal at a Nessie ATM now.

Bill requests accept optional `billDueDate` (`YYYY-MM-DD`, billers only). Migration
012 stores it and retries must preserve it. The payment is made now, including
when paying early; it is not a scheduled job. Nessie's `payment_date` is the actual
payment date, `recurring_date` uses the bill's due day, and its nickname preserves
the original due date with the reconciliation tag. A new biller still holds.

## Verification commands

Before pushing web changes run `npm run typecheck`, `npm test`, `npm run test:db`, and `npm run build`. Integration tests use synthetic Tiger Data fixtures and fake Nessie/Auth0 transports; they do not prove Guardian enrollment or the iPhone UI works.
