# Family dashboard visual refresh

Based on the supplied [DESIGN.md reference](style-reference.md). The reference
is an original Fold-inspired proposal, not proprietary Fold source or an exact
reproduction. This implementation applies its navy/blue palette, cool canvas,
white surfaces, rounded cards, restrained financial typography and desktop
workspace navigation to the family web dashboard.

The landing page and native iPhone app keep their current styling in this pass.
The dashboard retains the existing Geist/system font stack. Blue primary buttons
use `#2468c9` rather than the reference's lighter blue so white button labels meet
AA contrast. Muted text is similarly darkened. State badges keep meaningful
green/red/amber colors and explicit words. Deny is an outlined action; approving
still runs the existing authenticated server action and Guardian restrictions.

The overview's payment count, 90-day spending and category count come from the
existing server queries. They are not account balances or security guarantees.
Only the development preview supplies labelled synthetic values. The summary,
payment cards and controls are shared with production. Added loading placeholders
and a dashboard retry boundary keep the same visual language when data is absent.

Preview locally:

```sh
cd web
npm run preview:dashboard
```

Open http://127.0.0.1:3106/dashboard/preview. This route is development-only;
its decisions are simulated and it never connects to a bank. Desktop and mobile
captures: [1440px](../gallery/dashboard-style-1440.png) and
[390px](../gallery/dashboard-style-390.png). State-specific captures are indexed
in [dashboard-review.md](../gallery/dashboard-review.md).

Verification: existing browser checks cover decision focus, partial approvals,
Guardian/viewer permissions, expiry, timeline wrapping, button contrast, and
390px layout at 200% text size. No iPhone build or live payment test is implied.
AI tool: Codex for the implementation and screenshot verification.
