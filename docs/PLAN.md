# checkwith.us: the plan (single source of truth)

- **Goal: win the sponsor challenges.** Capital One Nessie, Auth0, Tiger Data, Easy On The Eyes (UI/UX), GoDaddy, plus the DEV Writing Challenge. We still enter Best Use of AI/ML, but it is not the focus.
- **Product:** scam protection where the older adult does nothing and the family does the work.
- **Work lives in GitHub issues.** This file says what and why; issues say who and done-when. If they disagree, ask in the team chat and fix this file.
- **Rule of thumb:** every sponsor's tech must do real work in the demo, not just be present.
- Devpost due **Sun Oct 18, 8:00 AM ET**. Expo Sun 10 AM to noon, 3-minute demo. Rules: [RULES.md](RULES.md).

## What we build

### Older adult (iPhone, no action needed)
1. **Texts:** the Message Filter runs our on-device Guard model; scam texts never reach the inbox. (Built.)
2. **Calls:** known scam numbers ring as "Possible scam" (Call Directory). #12
3. **Payments:** a protected Nessie account. Code rules hold gift cards, crypto, new payees, large amounts, anything unusual for this user, payments started during a call, and the "ATM cash then gift cards" sequence. #11, #17
4. **Screen:** "You're safe" or "Paused, your family will call", one big "Ask my family" button, a lock-screen card that updates live. #11

### Family (web dashboard + Auth0 Guardian push)
1. **Approve or deny** a held payment from the Guardian push (Auth0 CIBA) or the dashboard, with amount, payee and reason shown. #14, #16
2. **Family circle:** approvers vs viewers; large amounts need 2 of 3 approvals. #14
3. **Freeze:** one tap sweeps the spending balance to the vault (Nessie transfer). #18
4. **Allowances:** the family grants the AI agent limited, expiring permission (for example utility bills under $200 until Nov 30); inside it, no push. #19
5. **Dashboard:** holds, spending over time, "6x her usual", Tiger Data performance numbers. #6, #16

## How each sponsor is won
| Sponsor | What wins it | Issues |
|---|---|---|
| Capital One Nessie | Many endpoints, each with a job: accounts (vault + spending), merchants (categories), purchases (baseline), withdrawals + ATMs (cash then gift cards), transfers (Freeze, family top-up), bills (known billers), deposits, branches | #9, #13, #17, #18 |
| Auth0 | Auth0 for AI Agents: CIBA approvals with payment details, roles, 2-of-3, and scoped expiring allowances for the agent | #14, #19 |
| Tiger Data | Hypertable + compression + real-time continuous aggregates (daily, weekly, per-payee) driving holds and the dashboard; a measured performance story (1M rows, query times, compression ratio); time-window scam sequence query | #6, #17 |
| Easy On The Eyes | Polished older-adult screens (big text, one action per screen, plain words) and a clear family dashboard; design principles and steps in the gallery | #11, #15, #16 |
| GoDaddy | checkwith.us registered via the MLH code, live at the expo, used as the product name everywhere | #10 |
| DEV Writing | A post about how we built it | #7 |
| Best Use of AI/ML | Two trained models with honest scores in the README (already done) | #7 |

## The 3-minute demo
Setup: one iPhone as the older adult, the MacBook dashboard as the family, Google Voice as the scammer.
1. A scam text never reaches the inbox.
2. A scam call rings as "Possible scam".
3. A gift-card payment during the call pauses; the family denies it from the Guardian push; the phone updates live.
4. Cash at an ATM, then a gift card: held as a scam sequence.
5. The family taps Freeze; the balance moves to the vault.
6. A known utility bill under the allowance pays with no push.
7. Close on the Tiger Data numbers and the model scores.

## Out of scope (cut on Oct 17 to focus on sponsors)
- Qwen fine-tune ("checkwith-1") and model retraining
- ~~Family iPhone app~~ Back in scope (decided Oct 17): the iPhone app serves both roles, the older adult and the family. The web is the landing page plus the family dashboard.
- Screen Time app lock
- Usability test with older adults (later, not this weekend)

## Decided (Oct 17)
- Bank-while-on-a-call alert: build it once #13 lands the ATM and branch list. #25
- On-device AI: explanation only, not a full agent. Code picks the true facts; Apple's on-device model rewrites them into a short note for the family. #26
