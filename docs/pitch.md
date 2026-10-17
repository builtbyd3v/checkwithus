# Expo pitch: 30 s judge video + 2:00 live talk (draft for Hitesh)

- **Owner:** Hitesh. This is a starting draft. Improve it with your agents, then rehearse it.
- **Goal:** win the sponsor challenges (Nessie, Auth0, Tiger Data, Easy On The Eyes, GoDaddy). Overall and Best Use of AI/ML are side entries. Do not build the pitch around them.
- **The trap:** if judges hear "scam protection for elderly people", we sound like every other team. Lead with how deep each sponsor's tech goes and what it does in the product.
- **Shape:** a 30 s judge video with only the wow moments, then a 2:00 live talk with one block per sponsor (tech, benefit, proof on the table). That is 2:30, with 30 s of buffer inside the 3:00 limit, then 1 minute of questions. The Devpost video (1:30 to 2:00) is a separate deliverable: [video-script.md](video-script.md).
- **Before the expo:** check every claim against the code and the live build. Cut anything that is not verified (see "Unverified").

Related: [demo.md](demo.md) (device setup, how to film the judge video, live "show me" steps, fallbacks), [PLAN.md](PLAN.md) (what we build and why), [RULES.md](RULES.md) (judging criteria), [perf.md](perf.md) (Tiger Data numbers).

## Hard requirements

1. The video is 30 s or less. It has captions and no voiceover, because the expo is loud.
2. The talk is 2:00 or less. With the video, the total is 2:30. The 1 minute of judge questions comes after.
3. Every sponsor block names the real features we use. "We used Auth0 for login" loses. Name the endpoints, the features and the numbers.
4. Every claim has a proof that a judge can see: a phone, the dashboard, a terminal, or a README table. Keep both phones live on the table.
5. Use synthetic Rosa only. Show no real names, numbers, tokens or pairing codes.

**Judges rotate (science-fair style).** When a sponsor judge walks up, start with their block's 60 s version. Cut the other blocks to one line each. Know your audience before you speak: ask "Which sponsor are you judging?"

## Flow (2:30 of the 3:00 limit)

| Time | Part | Who (suggested) |
| --- | --- | --- |
| 0:00–0:30 | Judge video plays | Hitesh starts it |
| 0:30–0:45 | Opener: how we differ (15 s) | Dev |
| 0:45–2:05 | Sponsor blocks, 20 s each: Nessie, Auth0, Tiger Data, Easy On The Eyes | Haadi (Nessie, Auth0), rgons (Tiger Data, design) |
| 2:05–2:15 | AI/ML line (10 s) | Dev |
| 2:15–2:25 | GoDaddy + close (10 s) | Dev |
| 2:25–3:00 | Buffer | |

When a judge asks "show me", use the matching live step in [demo.md](demo.md).

## Part 1: the 30-second video

| Time | Shot | Caption | Sponsor shown |
| --- | --- | --- | --- |
| 0:00–0:04 | Rosa's iPhone: the scam toll text lands in Spam, not the inbox | "Scam text. Caught on her phone." | on-device model |
| 0:04–0:08 | Incoming call shows "Possible scam". She answers. | "She answers anyway. Scammers are persuasive." | |
| 0:08–0:16 | She pays $200 at a gift card store. Her screen: "Paused, waiting for family". Family phone shows the reasons. Tap Deny. Her lock screen: "Stopped". | "Her family decides, not the scammer." | Auth0, Easy On The Eyes |
| 0:16–0:22 | ATM cash $200, then a gift card. The hold reads "Cash at an ATM, then a gift card". | "Normal alone. A scam together." | Nessie, Tiger Data |
| 0:22–0:27 | Family taps Freeze. "Money is in the safe account." | "One tap. Her balance goes to a vault." | Nessie |
| 0:27–0:30 | checkwith.us logo | "She does nothing. Her family does the work." | GoDaddy |

Shoot it on the real phones with the pinned `main` build. How to film each shot: [demo.md](demo.md).

## Part 2: the talk

Each sponsor block has a **20 s** version for the default order and a **60 s** version for when that sponsor's judge is at the table. Bold brackets are actions, not words. Each block ends with **Proof** (what to point at) and **If asked** (true facts to answer with). At about 150 words a minute, 20 s is about 50 words and 60 s about 140, less when you pause for an action.

### Opener (15 s): how we differ
> "Scammers talk victims past every warning, and the bank can't stop a payment she makes herself. So we move the decision. Rosa changes nothing: a payment that looks like a scam waits for her family before it reaches the bank. One rule: AI suggests, code decides money."

### Capital One Nessie

| Nessie resource | Its job in checkwith.us |
| --- | --- |
| Customers + accounts | Rosa has a spending account and a vault account |
| Merchants | Each payee becomes a Nessie merchant tagged with its category (gift card store, utility); the category drives the rules |
| Purchases | Approved store payments are real Nessie purchases |
| Bills | Known billers (City Power & Light) that allowances cover; approved bills are paid as Nessie bills |
| Withdrawals | ATM cash: the first half of the "cash, then gift card" scam |
| ATMs + branches | A geofence: the family gets an alert when she is at a bank during a phone call. Nessie's banks are near Washington, DC, so the demo adds one bank at our table (`DEMO_BANK_LOCATIONS`) |
| Transfers | Freeze (spending to vault). A family top-up also uses transfers, but it is API only, with no button yet: do not demo it |
| Deposits | Rosa's monthly pension in the seeded history; deposits count toward her spending balance |

**20 s**
> "Nessie is Rosa's bank, and ten resource types each do a job. Every payee is a Nessie merchant with a category, so our rules know a gift card from a power bill. Purchases and bills are the real payments. A Nessie ATM withdrawal starts the scam we catch. One transfer powers Freeze, exactly once."

**60 s**
> "Nessie isn't a data source for us. It's Rosa's bank, and ten resource types each have a job. She has a spending account and a vault. Her pension arrives as deposits. Every payee becomes a Nessie merchant tagged with a category, and that category drives our rules: a gift card is always held. Approved payments post as real purchases, and her power bill is a real Nessie bill. **[MacBook: Enter on `npm run demo:atm`.]** That's a real sandbox withdrawal at a Nessie ATM. Now a gift card within two hours is held as a scam sequence. Nessie's ATMs and branches also feed a geofence, so the family hears when she walks into a bank during a call. **[iPhone B: Money, Freeze.]** And one transfer sweeps her balance into the vault. It's claimed under a database lock, so even a double tap moves money once."

**Proof:** the `demo:atm` output in the terminal, then Freeze on iPhone B ("Frozen. Money is in the safe account.").
**If asked:** Nessie only takes whole dollars for some payees, so the server refuses cents there instead of letting Nessie truncate them. A payment whose Nessie result is unknown is looked up, never re-sent, so a timeout cannot pay twice.

### Auth0

**20 s**
> "Auth0 is the family's authority, not just a login. The family app signs in with PKCE, and the server verifies every token. Only approvers can say yes; over $1,000, two must agree, and one no wins. Our bill-pay agent has its own machine identity with one scope. It can never approve."

**60 s**
> "Auth0 decides who can say yes to Rosa's money. The family app signs in with Authorization Code plus PKCE, and the server checks the signature, issuer and audience of every token. Approvers and viewers are separate roles. Over $1,000, two approvers must agree, and a single no stops it. **[iPhone B: Approve a held payment, Face ID.]** Approve needs Face ID on the phone. Riskier changes, like Freeze or a new allowance, need a fresh Auth0 sign-in from the last five minutes. For AI agents, our bill-pay agent signs in as its own Machine-to-Machine client with exactly one scope, `pay:bills`. It can only ask. **[iPhone B: Allowances tab.]** Inside the family's allowance, utilities up to $400 until November 30th, a bill pays. Outside it, the bill waits for the family. And every family route rejects machine tokens, so the agent can never approve, freeze or change a rule."

**Proof:** approve with Face ID on iPhone B; the Allowances tab.
**If asked:** the Guardian push (CIBA) with the payment details is built and tested against a fake Auth0, not verified live; say exactly that. Only say "Auth0 RBAC" or "`approve:payments` permission" once RBAC is confirmed on the live API (see "Unverified").

### Tiger Data

**20 s**
> "Rosa's spending is a Tiger Data hypertable with compression. A real-time continuous aggregate answers 'more than three times her usual?' in about a millisecond, while the payment waits. A two-hour time-window query catches ATM cash, then a gift card. On a million rows: 13.8 times faster, 3.2 times smaller."

**60 s**
> "Every payment Rosa makes lands in a Tiger Data hypertable, in seven-day chunks. After 30 days they move to the columnstore, segmented by family. On top sit three real-time continuous aggregates. The daily one is in the payment path: is this more than three times what she usually spends on this? That answers in about a millisecond, while the payment waits. A weekly aggregate, built on the daily one, draws the family's chart, and a per-payee one gives 'about 4x her usual'. The scam sequence is a time-window query on the hypertable: ATM cash, then a gift card, within two hours. **[MacBook: point at the speed card.]** This card times the weekly chart on her real data, aggregate against raw rows. On a million rows, weekly totals for 200 families went from 2 seconds to 150 milliseconds: 13.8 times faster, and 3.2 times smaller."

**Proof:** the dashboard's "How fast this page is" card, then the table in [perf.md](perf.md).
**If asked:** the aggregate times in perf.md are a best case (fully materialized; in production the current week is computed live). Daily baseline: 1.18 ms from the aggregate against 2.57 ms from raw rows.

### Easy On The Eyes

**20 s**
> "The best interface for a scared 80-year-old is no new interface. Protection runs inside iOS: the Message Filter, the call label, the lock-screen card. In our app, each screen has one action and plain words: 'Paused, waiting for family.' Her family sees plain reasons too, never a risk score."

**60 s**
> "We designed for two people under different pressure. Rosa is scared and rushed, so she learns nothing new. Scam texts go to Spam, calls say 'Possible scam', and the lock screen says 'Paused, waiting for family. Your money is safe.' **[iPhone A at the largest text size.]** When she opens the app, there's one thing to read and one big button: 'Ask my family'. Every screen works at the largest Dynamic Type sizes and scrolls, so nothing is cut off. Nothing tappable is smaller than 56 points. Text colors keep at least 4.5 to 1 contrast. VoiceOver reads the family's answer aloud when it arrives, and Reduce Motion stops the animation. The family is the opposite: they need to decide fast. They get the amount, the payee and every reason in plain words, like 'Paid while on a phone call'. Never a risk score. The only countdown is on the family's side."

**Proof:** iPhone A at the largest text size; a held payment on iPhone B; the gallery and [design-principles.md](design-principles.md).

### Best Use of AI/ML (10 s, side entry; 60 s only if the AI/ML judge asks)

**10 s**
> "Our own scam model runs inside the iOS Message Filter in 1 MB, so her texts never leave the phone. It can add a hold reason, never remove one."

**60 s**
> "We trained two models. A DistilBERT model scored well, but it's 67 MB, and iOS kills the Message Filter above about 25 to 30 MB. So we shipped Guard tiny: character and word n-grams with logistic regression, 1 MB of weights, 0.14 milliseconds a text in Swift, together with fixed rules. On 884 real texts it catches 96.0% of scams with 2.4% false holds. The hard part was honest data. We found near-duplicate scam campaigns leaking between train and test, so we cluster similar texts and keep each cluster in one split. Then the rule that matters: the model can only add a hold reason, never remove one, so a fooled model makes us more careful, never less. And when a payment is held, Apple's on-device model writes a short note for the family, from facts our code picked."

**Proof:** the README "Model evaluation" table.

### GoDaddy + close (10 s)
> "The name is the promise: before money moves, check with us. checkwith.us."

## Unverified: cut or verify before the expo

1. **Bill-pay agent:** the code is on main (PR #46 itself was closed unmerged), but the real Auth0 Machine-to-Machine grant is not tested on the live tenant. Ask Dev for one live `npm run agent:bills` run. If it does not run, say "tested against a fake Auth0".
2. **CIBA Guardian push:** built and tested against a fake Auth0 (`web/test/fake-auth0.ts`), not verified live. Do not say "live". Mention it only if a judge asks.
3. **GoDaddy:** the .us registry (RDAP, Oct 17) lists Porkbun as the registrar. Confirm with Dev that the MLH GoDaddy Registry code was used before claiming the prize.
4. **`approve:payments`:** the server checks this Auth0 permission only when the token carries a `permissions` claim or `AUTH0_RBAC=true`. Otherwise the circle's approver role alone decides. Before saying "Auth0 RBAC", confirm RBAC is on for the live Auth0 API.
5. **Freeze on stage:** Freeze needs an Auth0 sign-in from the last 5 minutes. If iPhone B signed in earlier, tapping Freeze opens the Auth0 login sheet first. Sign in again on iPhone B just before a judge arrives.

Checked against `main` on Oct 17 (Hitesh, with Claude Code): the 10 Nessie resource types, Freeze exactly once, `demo:atm`, PKCE, token checks, roles, the 2-approver rule, the agent's scope and machine-token rejection, the hypertable, compression, the three continuous aggregates, the 2-hour window, the [perf.md](perf.md) numbers, the speed card, the screen wording, the accessibility list and the model numbers in the README.

## Next steps for Hitesh

1. ~~Have your agents check every claim here against the code.~~ Done Oct 17; see the list above.
2. ~~Make each sponsor block deeper and sharper.~~ Done Oct 17: each 20 s block is about 50 words.
3. ~~Write the 60 s version of each block.~~ Done Oct 17, plus a 60 s AI/ML answer. Time each one out loud and cut if it runs long.
4. Film the 30 s judge video on the real phones ([demo.md](demo.md)). Then record the Devpost video ([video-script.md](video-script.md)).
5. Run the video plus the 2:00 talk with a timer, twice, with the whole team.
