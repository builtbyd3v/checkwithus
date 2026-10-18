---
title: "Before money moves, check with us: scam protection the family runs"
published: false
tags: mlhacks, devchallenge, hackathon, ios
cover_image:
---

_This is a submission for the [MLH x DEV Writing Challenge](https://dev.to/mlh-hackathon)_

<!-- Before publishing (after the event): sign in to DEV with the MLH account linked to your registration. Add a cover image. Embed the Devpost video with `{% embed VIDEO_URL %}`. Then set published: true. -->

## What I Built

[checkwith.us](https://www.checkwith.us) is scam protection where the older adult does nothing and the family does the work. We built it at SwampHacks XII. The code is public: [github.com/builtbyd3v/checkwithus](https://github.com/builtbyd3v/checkwithus).

Most scam tools ask the person at risk to decide under pressure. Scammers are good at pressure. So the family carries the work. The older adult has nothing new to do:

- **Texts.** A Message Filter extension runs our own scam model on the phone. Scam texts go to Spam.
- **Calls.** A Call Directory extension labels known scam numbers "Possible scam".
- **Payments.** Every payment goes to our server. Fixed rules decide if it pauses. A paused payment waits for a family member to approve it.

Three hard rules: AI suggests, code decides money. Money is integer cents. Texts and bills never go to a cloud AI model.

### The model had to fit where the texts are

The Message Filter is the one place that sees a text from an unknown sender, so the model had to run there. We fine-tuned DistilBERT on public SMS datasets. At 67 MB in Core ML, it got the extension killed on a real iPhone. A probe build died about 21 MB above baseline.

So we trained a smaller model: character and word n-grams with logistic regression. The weights are 1 MB. On 884 real test texts it scored 96.0% scam recall and 2.4% false holds. DistilBERT scored 94.0% and 1.3%. The filter only moves texts to Spam, so we took that trade.

Two caveats. We set the validation recall target after seeing one test result, so the scores are slightly optimistic. And "wrong number" investment openers slip past the text filter, so the payment hold is the backstop. Our first split also leaked: a read-only Codex review found the same scam campaigns in train and test.

### AI suggests, code decides money

One pure function decides if a payment pauses. This is `decideHold` from [`web/lib/rules.ts`](https://github.com/builtbyd3v/checkwithus/blob/main/web/lib/rules.ts):

```ts
export function decideHold(input: {
  payment: PaymentFacts;
  holdOverCents: Cents;
  baseline: Baseline;
  guard: GuardSuggestion;
  circle?: CircleFacts;
}): HoldDecision {
  const { payment, holdOverCents, baseline, guard, circle } = input;
  const reasons = new Set<HoldReason>();

  if (circle?.frozen) reasons.add('frozen');

  const categoryReason = ALWAYS_HOLD[payment.category];
  if (categoryReason) reasons.add(categoryReason);

  if (payment.category === 'gift_cards' && circle?.atmCashRecently) reasons.add('cash_then_gift_card');

  if (!payment.payeeKnown) reasons.add('new_payee');

  // "Over $300" means strictly over: exactly $300.00 does not pause.
  if (payment.amountCents > holdOverCents) reasons.add('over_limit');

  if (isUnusual(payment.amountCents, baseline)) reasons.add('unusual_spending');

  if (payment.onCall) reasons.add('during_call');

  // The model's only power: adding a reason. Note there is no branch anywhere
  // in this function where it can remove one.
  if (guard && guard.score >= GUARD_HOLD_SCORE) reasons.add('guard_flagged');

  if (reasons.size === 0) return { action: 'allow' };
  return { action: 'hold', reasons: HOLD_REASONS.filter((r) => reasons.has(r)) };
}
```

The model's score can add a hold reason. No branch can remove one. A broken model can only make the system more careful. Each reason has a plain-words label for the family.

A gift card alone is always held. The hold limit defaults to $300. Over $1,000 by default, two different approvers must say yes, and one no stops the payment. Both are family settings. The family can change them or turn them off on the dashboard.

A language model does one job: it explains a hold. Apple's on-device Foundation Models rewrites facts that code picked. If the note loses a fact, we send the plain facts.

## Demo

- **Live:** [www.checkwith.us](https://www.checkwith.us). The "Try a payment" widget runs the same `decideHold` code in your browser. The family dashboard needs a sign-in, so use the video to see the family side.
- **Video:** on our Devpost project page.

In the demo, Sam is a made-up older adult:

1. A scam text reaches Sam's phone. It goes to Spam. A scam number calls. The screen says "Possible scam".
2. Sam tries to pay with a gift card. The phone says the payment is paused and the family will call.
3. The family app shows the amount, the payee and each reason. Approve asks for Face ID first. Deny does not, because it only stops money.
4. Freeze is one tap. One Nessie transfer moves the spending balance to a vault.

## Partner Technologies

**Capital One Nessie** is the bank. We call 10 resource types, and each has a job. Accounts hold a spending balance and a vault. Merchants carry payee categories. Purchases, bills and withdrawals carry every allowed payment. ATMs and branches drive an alert when the phone is at a bank during a call. Transfers do Freeze.

The sandbox has limits. It takes whole dollars only, so we refuse cents. Its reported balance never changes, so our ledger is the balance. A transfer cannot name its destination, so the vault lives in our ledger. Writes never retry: after an unknown outcome we look the payment up by its tag.

**Auth0 (for AI Agents)** handles login, roles and the bill agent. The dashboard uses Auth0 login. The iPhone app uses PKCE. Every family API route checks the signed access token. Unfreeze, allowances, role changes and top-ups need a sign-in from the last 5 minutes. Freeze does not, because it only protects money.

The bill agent is its own Machine-to-Machine client with one scope, `pay:bills`. Its bills go through the same rules as the phone. Family routes reject machine tokens, so it can never approve a payment or freeze the account. On Oct 17 we verified it on the live tenant: it signed in with only `pay:bills` and paid a $350 water bill under the family's allowance. We also built CIBA, a Guardian push with payment details. It is built and tested against a fake Auth0, and off in the demo.

**Tiger Data** holds the spending ledger. `spending` is a hypertable with columnstore compression. Three real-time continuous aggregates sit on it: daily, weekly (built on daily) and per payee. The daily one gives the baseline for the "much more than they usually spend" rule. A time-window query finds ATM cash followed by a gift card within 2 hours.

We measured 1,000,000 synthetic rows (200 circles, 3 years) on Tiger Cloud. The dashboard weekly chart dropped from 2.61 ms to 1.10 ms (2.4x). Weekly totals for all 200 circles dropped from 2077.43 ms to 150.23 ms (13.8x). Compression took the table from 163.3 to 50.3 MiB (3.2x). The aggregates were fully materialized, a best case, and for one family the raw queries were already fast. Results are the recorded Oct 17 run in `web/lib/perf-benchmark.json`.

**GoDaddy Registry** runs the `.us` domain, and the name is the pitch: check with .us. We registered it on Friday night after kickoff with the MLH code, which is redeemed through Porkbun. The name is the site, the iPhone app's API address, and the Auth0 API audience.

## Hackathon Experience

We went to SwampHacks XII (Oct 16 to 18, 2026) as a team of four, and entered the Best First Timers track. Two of us, Hitesh and Rishon, were at our first hackathon. Hitesh wrote the pitch script and planned the demo video. Rishon did the design research that Dev turned into the app and dashboard design.

We built with Claude Code and OpenAI Codex CLI. Claude Code wrote most of the code. Codex continued parts of the web backend and reviewed changes read-only. It found the data leak above and real payment bugs, like a retry that sent a new request instead of the same one. We checked every finding before a fix.

Next: test the screens with older adults and their families, and add push alerts. Our scores describe our test set, not every scam.
