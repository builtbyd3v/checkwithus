# Dashboard approval gallery

Issue #16 builds on PR #43. The existing `dashboard-full.png`,
`dashboard-state-waiting.png`, `dashboard-states-decided.png` and
`dashboard-after-deny.png` show the dashboard from that PR with synthetic DB data.

The `dashboard-review-*` images exercise the **same PaymentCard, StateBadge and
DecisionForm used by the dashboard**, using a local-only fixture. These captures
show UI states, not real Auth0 sessions or Nessie transfers. The fixture never
calls a payment service and `/dashboard/preview` returns not-found in production.

| State | Phone (390 px) | Desktop (1440 px) |
| --- | --- | --- |
| Waiting | [Phone](dashboard-review-390-held.png) | [Desktop](dashboard-review-1440-held.png) |
| Approved | [Phone](dashboard-review-390-approved.png) | [Desktop](dashboard-review-1440-approved.png) |
| Denied | [Phone](dashboard-review-390-denied.png) | [Desktop](dashboard-review-1440-denied.png) |
| Expired, blocked | [Phone](dashboard-review-390-expired.png) | [Desktop](dashboard-review-1440-expired.png) |
| Keyboard focus and long payee | [Phone](dashboard-review-390-keyboard-long-name.png) | [Desktop](dashboard-review-1440-keyboard-long-name.png) |

From `web/`, run:

```sh
npm ci
npm exec -- playwright install chromium
npm exec -- playwright test --config playwright.dashboard.config.ts
```

The browser suite starts a local server using explicitly fake Auth0 configuration,
tests keyboard approval/denial and persistent result focus, partial approvals,
Guardian/viewer controls, button text contrast (at least 4.5:1), 200% text size,
and long payee names. It recreates all ten screenshots. DevTools indicators are
hidden in captures; payment UI is unchanged.

Server-action unit tests separately verify authenticated delegation to the payment
service, no dashboard approval in CIBA mode, permission failures, malformed input,
partial approvals and stale/expired payments. These do not replace a live Auth0
and Nessie smoke test before the expo.

No Figma file is linked in #15 or #16. This follows the existing dashboard's
teal/stone design and the design principles in PR #38: plain words, clear reasons,
large decision controls, and status labels that do not depend on colour.

AI tools used for this follow-up: Codex.
