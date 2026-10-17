# checkwith.us expo demo (3 minutes)

Hard limit: 3 minutes, then 1 minute of judge questions ([RULES.md](RULES.md)).

## Cast and props

| Who | Device | Shows |
| --- | --- | --- |
| Rosa, the older adult | iPhone A: older adult role, built from the reviewed demo commit | Home, Pay a bill, held screen, lock-screen card |
| Her family | iPhone B: family app (family role), same reviewed demo build, signed in with Auth0 | Approvals, Alerts, Money (Freeze) |
| Backup for the family | MacBook: checkwith.us/dashboard | Waiting payments, spending chart |
| The scammer | Google Voice (laptop or a third phone) | One scam text, one call |

Rosa is synthetic ("Rosa CheckWith (synthetic)"). Never use a real person's name or number.

## Pre-demo checklist (do 15 minutes before)

One build for everything
- [ ] One build: choose a reviewed commit (development work is currently on rishon, PR #54) and use that exact code for both iPhones and the server. Do not merge to main without the user's explicit instruction. Verify migrations and live settings before deploying. Never mix feature branches.
- [ ] On the selected deployment, `/api/health` prints `{"ok":true,"database":"reachable"}`. Confirm its commit matches both phones and exercise the Freeze route; health alone does not prove the feature build is deployed.
- [ ] Migrations on the live database: `cd web && npm run db:migrate` (014 freeze, 015 ATM cash, 016 weekly and per-payee aggregates, 017 ledger credits, and 020 payment initiator if #46 is merged).
- [ ] `DEMO_BANK_LOCATIONS` is set on Vercel to a spot at the expo table, for example `[{"name":"SwampHacks Demo Bank","lat":29.6463,"lng":-82.3478}]`. TODO(Dev): confirm the coordinates on site, redeploy after changing it, then relaunch the app on iPhone A.
- [ ] `npm run smoke:demo` passes (a $350 City Power & Light bill pays with no push while the allowance exists, and holds when it is revoked; with #46, step 6a: the agent pays the $350 water bill only because of the allowance; runs on a throwaway schema).
- [ ] If showing the agent: `AUTH0_AGENT_CLIENT_ID` and `AUTH0_AGENT_CLIENT_SECRET` are in the MacBook's `.env.local`, and a second terminal has `npm run agent:bills -- --within 14` typed, not run. Run it only after `demo:reset`.
- [ ] `npm run demo:reset -- --live` on the real demo circle (only there; without `--live` it refuses anything but a throwaway `wt_*` schema). It reseeds Rosa, clears held payments, unfreezes, clears recent ATM cash, and grants the utilities allowance up to $400 until Nov 30.
- [ ] Do NOT run `npm run demo:atm` after the reset until step 5. If you do, step 3 also shows the ATM reason.
- [ ] `APPROVAL_MODE=app` on Vercel (the default). The family approves in the family app, which asks for Face ID first. The Guardian push (`ciba`) is implemented but not verified live, so do not use it in the demo.

iPhone A (Rosa)
- [ ] The selected reviewed demo build installed. A debug build also has the "Make this spot a test bank" and "Pretend I'm on a call" backups.
- [ ] Paired: dashboard, make a pairing code, type it on the phone. Home says "You're safe".
- [ ] Message Filter on: Settings, Apps, Messages, Unknown and Spam, "Check With Us".
- [ ] Call labels on: Settings, Apps, Phone, Call Blocking and Identification, "Check With Us".
- [ ] The Google Voice number is in `scam-numbers.local.json`, and the app was opened once after install so the list loaded.
- [ ] The Google Voice number is NOT a saved contact, and has not texted this phone before (iOS skips the filter for a sender already in Spam, [DECISIONS 28](../ml/data/DECISIONS.md)).
- [ ] Location set to Always and Precise. The phone is within 150 m of the `DEMO_BANK_LOCATIONS` spot. Backup in a debug build: tap "Make this spot a test bank"; the debug panel says "Watching" 1 or more banks.
- [ ] Live Activities allowed. Volume up. Focus and Do Not Disturb off.
- [ ] No held payment is waiting (the phone allows one at a time).

iPhone B (family)
- [ ] Family role. Signed in with the Auth0 approver account. Joined Rosa's circle.
- [ ] Face ID works for the app (passcode is the fallback). The phone has a passcode set.
- [ ] Money tab says not frozen, and Allowances shows "Utilities, up to $400" (both from `demo:reset`).

MacBook
- [ ] checkwith.us/dashboard signed in, on Rosa's circle.
- [ ] Terminal open in `web/` with `.env.local`. Type `npm run demo:atm` and do not press Enter yet.
- [ ] A tab with the README "Model evaluation" and "Tiger Data performance" tables.
- [ ] Google Voice signed in, with the scam text typed and ready. TODO(Dev): test the exact text on iPhone A once; use one that lands in Spam.
- [ ] Wi-Fi works on all devices. A phone hotspot is ready as backup.

Suggested scam text (made up, test it first): `FL Toll Services: unpaid toll balance of $6.89. Pay today to avoid a $50 late fee: https://fl-toll-pay.example`

## The script

Times are cumulative. The script ends at 2:45, so 15 seconds are left as buffer. Say the lines in quotes; do the steps in bold.

### 0:00 Hook (10 s)
"Every scam tool asks older adults to do something new. checkwith.us asks them to do nothing. The family does the work. This is Rosa's phone, and this is her family's."

### 0:10 Step 1: a scam text never reaches her (15 s)
1. **Google Voice: send the scam text to iPhone A.**
2. **Hold up iPhone A: open Messages.** The inbox has no new text. Open the Spam folder to show it there.

"Our own scam model runs inside the Message Filter, on the phone. It is 1 MB. Her texts never leave the phone."

### 0:25 Step 2: a scam call rings as "Possible scam" (20 s)
1. **iPhone A: open Check With Us so it is on screen.**
2. **Google Voice: call iPhone A.**
3. **Show the incoming call screen:** "Possible scam".
4. **Answer, then go straight back to Check With Us and keep it in the foreground.** The bank alert for "call starts while already inside a bank" only fires while the app is open. The scammer stays on the line from here on.

"Rosa answers anyway. Scammers are persuasive. So we protect the money, not just the phone."

### 0:45 Step 3: a gift card during the call pauses (35 s)
1. **iPhone A: tap "Pay a bill", then "Gift card store". Enter 200. Tap "Next", then "Yes, pay".**
2. iPhone A shows "Paused, waiting for family" and "Your money is safe. Your family will call you."
3. **iPhone B: open Approvals.** The held payment shows the amount, the payee and the reasons, including "Gift card purchase", "Someone they have not paid before" and "Paid while on a phone call". Point at the short note.

"Fixed code rules held this, not an AI. The AI can add a reason; it can never remove one. The note was written on Rosa's phone by Apple's on-device model, from facts our code picked."

4. **iPhone B: tap Deny.**
5. **Show iPhone A.** The screen and the lock-screen card change to "Stopped. Your family said no." Nothing reached the bank.

"Deny is one tap. Approve asks for Face ID first, and our server only accepts an approver's signed Auth0 token."

### 1:20 Step 4: she is at a bank during the call (20 s)
1. **iPhone B: open Alerts.** Pull down to refresh. The alert names the bank, for example "At a bank (SwampHacks Demo Bank branch) while on a phone call."

"The scammer sends her to the bank. Her phone watches the nearest bank and ATM locations from Capital One's Nessie. Nessie's banks are all near Washington, DC, so our server adds a demo bank at this table. Only the bank's name is sent, never her location."

2. **Hang up the Google Voice call.**

### 1:40 Step 5: ATM cash, then a gift card (20 s)
1. **MacBook: press Enter on `npm run demo:atm`.** It prints "ATM cash $200 at ...".

"Rosa takes $200 cash at an ATM. That is a real Nessie withdrawal."

2. **iPhone A: Pay a bill, Gift card store, 200, Yes, pay.**
3. **iPhone B: Approvals.** New reason: "Cash at an ATM, then a gift card. Scammers often ask for this."

"Each step looks normal alone. Together they are the classic scam script. Tiger Data finds the pair with a time-window query on her spending."

4. **iPhone B: tap Deny.**

### 2:00 Step 6: an allowance pays a routine bill (15 s)
1. **iPhone B: Allowances tab.** Show "Utilities, up to $400, until Nov 30" (granted by `demo:reset`).
2. **iPhone A: Pay a bill, City Power & Light, 350, Yes, pay.** It shows "Paid". No hold, no push to the family.

"$350 is over her $300 limit, but the family said yes in advance for utilities up to $400. It never lifts a gift card, a new payee, a call or a scam flag."

### 2:15 Step 7: Freeze (15 s)
1. **iPhone B: Money tab. Tap "Freeze money now", then "Freeze".** It shows "Frozen. Money is in the safe account."

"One tap moves her whole spending balance to a vault account with a Nessie transfer. It runs exactly once, even if you tap twice. Every new payment now waits for the family."

### 2:30 Close: the numbers (15 s)
1. **MacBook: show the README tables.**

"On a million rows in Tiger Data, continuous aggregates make 3 years of weekly totals for 200 families 13.8 times faster, and compression makes the data 3.2 times smaller. Our 1 MB on-device model catches 96.0% of real scam texts with 2.4% false holds. checkwith.us."

### If there is time, or a judge asks
Unfreeze first if step 7 ran, and make sure no call is active (a call adds a hold an allowance never lifts).
- **Approve with Face ID:** iPhone A: Pay a bill, Neighborhood Pharmacy (a known payee), 350, Yes, pay. It holds because $350 is over the $300 limit (it may also show "Much more than they usually spend on this"). iPhone B: Approve, Face ID. iPhone A shows "Paid".
- **Bill-pay agent (needs #46):** MacBook: press Enter on `npm run agent:bills -- --within 14`. It prints "Signed in as the bill-pay agent (scope: pay:bills)", then "Paid under the family's allowance: Sunshine Water Co. $350.00". Reload the dashboard: "Paid by the bill agent under your Utilities allowance". Say: "The agent has its own Auth0 identity with one scope. It can only ask; the same rules decide. $350 is over the $300 limit, so it paid only because of the family's $400 allowance."
- **Allowance off:** iPhone B: Allowances, Revoke the utilities allowance. iPhone A pays City Power & Light $350 again: now it holds as "Over the limit you set".
- **Dashboard:** MacBook: reload checkwith.us/dashboard to show the waiting payments and the spending chart.

## If X fails, say Y

| If this fails | Do this | Say this |
| --- | --- | --- |
| Scam text lands in the inbox | Move on. Show the model table later. | "iOS only sends unknown senders to the filter. Here are the model's scores on 884 real texts." |
| Call shows no "Possible scam" label | Answer and continue with step 3. | "iOS reloads the call list on its own schedule. The payment rule still knows she is on a call." |
| Payment does not reach the server | Check `https://www.checkwith.us/api/health`. Switch to the hotspot. | "No connection means nothing is paid. The app fails closed." |
| Family app does not show the hold | Pull down to refresh (it polls every 10 seconds). Or reload the dashboard on the MacBook. | "The family can also act from the web dashboard." |
| Face ID fails | Use the passcode. | "The phone's passcode is the fallback, like any banking app." |
| No on-device note | Continue. | "When Apple Intelligence is off, the family sees the plain facts instead." |
| Bank alert does not arrive | Bring Check With Us to the foreground on iPhone A. Debug build: tap "Make this spot a test bank", or turn on "Pretend I'm on a call". Then refresh Alerts. | "Nessie's banks are in DC, so we add a demo bank here. The geofence fires when she is inside one during a call." |
| `npm run demo:atm` fails | Skip to step 6. | "The rule is a two-hour window query on the Tiger Data hypertable: ATM cash, then a gift card." |
| Freeze fails | Show the error, then move to the close. | "Freeze is one Nessie transfer, recorded exactly once, so a retry never moves money twice." |
| Step 3 already shows the ATM reason | Continue. | "We ran this demo earlier, so her ATM cash from then still counts." |

## Reset between demos (2 minutes)

1. End any call on iPhone A.
2. MacBook: `npm run demo:reset -- --live`. It clears holds, unfreezes, clears ATM cash and re-grants the allowance.
3. iPhone B: pull down to refresh. Money tab says not frozen; Allowances shows utilities up to $400.
4. Send the next scam text from a Google Voice number that has not texted iPhone A before, or accept that step 1 may show it in Spam already.

## Dashboard-only backup footage

[38-second synthetic UI clip](gallery/dashboard-backup.webm) and [captions](gallery/dashboard-backup.srt). This records the local dashboard fixture, not a live payment or Guardian push. It can cover the dashboard portion if devices are unavailable; use real-phone footage for the text/call and older adult flows. Re-recording instructions: [dashboard-backup.md](gallery/dashboard-backup.md).
