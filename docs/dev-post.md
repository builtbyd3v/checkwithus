---
title: "We fit a scam model inside the iPhone's Message Filter, and let it decide no money"
published: false
tags: ios, machinelearning, postgres, hackathon
---

<!-- DEV Writing Challenge draft for SwampHacks XII. TODO(Dev): check the challenge rules on Devpost/MLH, add a cover image, publish, and paste the link into Devpost. -->

At SwampHacks XII we built [checkwith.us](https://checkwith.us): scam protection where the older adult does nothing and the family does the work. Scam texts are filtered on the phone. Scam calls ring as "Possible scam". Risky payments pause until a family member approves them.

This post is about three decisions that shaped the build, and what each one cost us. The code is public at [github.com/builtbyd3v/checkwithus](https://github.com/builtbyd3v/checkwithus).

Draft scope: the implementation described here is on [`rishon`](https://github.com/builtbyd3v/checkwithus/tree/rishon), in [PR #54](https://github.com/builtbyd3v/checkwithus/pull/54). It is not a claim that this build is deployed. The dashboard backup clip uses synthetic data and simulated decisions; live Auth0/Nessie verification and a complete device recording remain necessary before publication.

## 1. The model had to fit where the texts are

We had one hard privacy rule: the older adult's texts never go to a cloud AI model. On iOS, the place that sees an incoming text from an unknown sender is a Message Filter extension. So that is where our scam model had to run.

We fine-tuned DistilBERT on openly licensed SMS datasets (Mendeley, NCSU, UCI, plus some generated training data). Exported to Core ML with 8-bit weights it was 67 MB. On a real iPhone, iOS killed the extension while loading it.

We wrote a probe build that allocates 1 MB per step. It died about 21 MB above baseline on iOS 26. A 67 MB model was never going to fit.

So we trained a second, much smaller model: hashed character n-grams (3 to 5 characters) plus word n-grams, into 262,144 buckets, with logistic regression. The weights are 1 MB of float32. The Swift scorer builds exactly the same features as the Python trainer, and a fixture test checks they match.

Here is how the two compare on 884 real test texts (no near-duplicates of training rows):

| Model | Shipped | Size | Accuracy | Scam recall | False holds | Mac speed per text |
| --- | --- | --- | --- | --- | --- | --- |
| Guard tiny (n-grams) | Yes | 1 MB | 97.2% | 96.0% | 2.4% | 0.14 ms |
| Guard v2 (DistilBERT, PyTorch) | No | | 97.4% | 94.0% | 1.3% | |
| Guard v2, Core ML 8-bit | No | 67 MB | | 94.0% | 1.1% | 1.50 ms |

The tiny model uses 2.6 MB in the extension. It catches more scams, and it holds more legit texts. For a filter that only moves texts to Spam, we took that trade. The app ships only the tiny model; DistilBERT stays trained and evaluated, but not shipped. (Mac speeds are from our Swift eval on an M5 Pro, rules included. We did not save an iPhone timing.)

Two honest caveats. First, we raised the validation recall target to 97% after seeing one test result, so these test numbers are slightly optimistic. Second, "sorry, wrong number" investment openers are a weak spot: both models catch only 2 of 15 in our synthetic probe set.

The biggest lesson came before any of this. Our first split leaked. A read-only review agent found the same scam campaigns, lightly reworded, in both train and test, and a validation set that was 91% generated text. With that validation set, the tuned threshold gave 88.9% test recall. We clustered texts by character 5-gram similarity, kept whole clusters in one split, and made validation and test real text only.

## 2. AI suggests, code decides money

A scam text is annoying. A scam payment is the real damage. We did not want any model to be the thing that moves money.

Every payment from the older adult's phone goes to our server, and one pure function decides if it pauses. This is the whole function, from `web/lib/rules.ts`:

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

(This excerpt matches `web/lib/rules.ts` on the development branch. Before publishing, check it against the exact reviewed commit used for the demo.)

A fooled, broken or tampered model can make the system more careful, never less. Every reason has a plain-words label the family reads on their phone, like "Paid while on a phone call". "The AI said so" is not a reason a family member can check.

Money is integer cents everywhere, with one helper at the edge. Capital One's Nessie API, which plays the bank, only accepts whole numbers anyway.

We did use a language model for one job: explaining a hold to the family. Apple's on-device Foundation Models rewrites the facts into a short, calm note. Our first try let the model explain on its own, and it wrote "the caller asked for gift cards" when there was no call. Now code picks only true facts, the model only rewords them, and if the note loses a fact we send the plain facts instead.

## 3. Spending history is time series, so we stored it as one

The rule "much more than they usually spend on this" needs a baseline: what does Rosa (our synthetic demo user) typically spend on groceries on a day she shops? The dashboard needs weekly totals. Both would re-sum months of raw payments on every request.

We put the ledger in Tiger Data (TimescaleDB on Tiger Cloud): a `spending` hypertable with columnstore compression, segmented by family circle, and real-time continuous aggregates on top. This is the daily one:

```sql
create materialized view spending_daily
with (timescaledb.continuous, timescaledb.materialized_only = false) as
select
  circle_id,
  category,
  time_bucket(interval '1 day', occurred_at, 'America/New_York') as day,
  sum(amount_cents)::bigint as total_cents,
  count(*)::integer as payments
from spending
group by circle_id, category, day
with no data;
```

`materialized_only = false` makes it real-time: a payment made a second ago already counts. A weekly aggregate is built on top of the daily one, and a per-payee one reads the raw table.

The same hypertable also catches a classic scam script: cash at an ATM, then a gift card within 2 hours. Each step looks normal alone. A time-window query finds the pair.

We measured it on 1,000,000 synthetic rows (200 circles, 40 payees each, 3 years) on Tiger Cloud. Server time, median of 21 warm runs:

| Query | Raw, row store | Continuous aggregate | Speedup |
| --- | ---: | ---: | ---: |
| Dashboard weekly chart (1 circle, 13 weeks) | 2.61 ms | 1.10 ms | 2.4x |
| Unusual-spending baseline (1 circle, 1 category, 90 days) | 2.57 ms | 1.18 ms | 2.2x |
| Weekly totals, all 200 circles, 3 years | 2077.43 ms | 150.23 ms | 13.8x |

Compression took the table from 163.3 MiB to 50.3 MiB (3.2x smaller). The aggregates were fully materialized, which is a best case. For one family, the raw queries were already fast. The aggregates matter at scale. These are the recorded October 17 measurements preserved in `web/lib/perf-benchmark.json`, not a fresh run for this article. The method and reproduction command are in [docs/perf.md](https://github.com/builtbyd3v/checkwithus/blob/rishon/docs/perf.md).

## What surprised us

- **Nessie is a sandbox, with sandbox quirks.** The reported account balance does not change after payments, so Tiger Data keeps our ledger. All of Nessie's bank and ATM locations are near Washington, DC, so for a demo in Gainesville our server adds demo bank locations from an environment variable, and debug builds have a "make this spot a test bank" button.
- **iOS has opinions.** Once a sender's text went to Spam, iOS stopped calling our filter for that sender, even for a legit text.
- **Review agents earn their keep.** We built with Claude Code and ran Codex as a read-only reviewer at the end of each turn. It found the data leaks above and real bugs in the payment flow, such as a retry that sent a new request instead of the same one, and a race in the exactly-once path. Every finding was checked against the code before a fix.

## AI tools we used

Claude Code (Opus 5 and 5.5) wrote most of the code and drafted this post with us. OpenAI Codex CLI built parts of the web backend and reviewed changes read-only. Inside the product, Apple Foundation Models writes the family's note on the phone. The scam models are ours, trained during the event.

Next we would test the screens with older adults and their families, improve coverage of investment-scam openers, and verify the full payment flow on the live test tenant. The benchmark and model scores describe measured test conditions, not protection against every scam.
