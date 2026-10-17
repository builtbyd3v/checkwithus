# Devpost video (1:30 to 2:00, target 1:55)

- **Who watches:** Devpost viewers and judges who read the submission. This is the full showcase. The 30 s judge video for the expo table is separate ([pitch.md](pitch.md)).
- **Goal:** show how deeply each sponsor's tech does real work. Each segment puts a sponsor label on screen (a lower third, for example "Capital One Nessie: withdrawals + ATMs").
- **Format:** voiceover plus captions. Real phones, the pinned `main` build, synthetic Rosa only.
- **Hard limit:** under 2:00 including titles. Cut a segment rather than speed through an unreadable screen.

Record the same pinned commit on both phones and the server. This is a shot plan, not evidence that the steps have been recorded or verified. Rehearse the setup in [demo.md](demo.md) first. Do not show tokens, pairing codes, notifications from real people, or account settings.

| Time | Picture | Lower third | Narration |
| --- | --- | --- | --- |
| 0:00–0:10 | Rosa's home screen and the family app side by side | checkwith.us | "Scammers talk victims past every warning. checkwith.us moves the decision. Rosa, our synthetic user, does nothing. Her family does the work." |
| 0:10–0:22 | Scam text in Spam, not the inbox. Then the "Possible scam" call screen. | Our model, on the phone | "Our own 1 MB scam model runs inside the iOS Message Filter, so her texts never leave the phone. Known scam numbers ring as 'Possible scam'." |
| 0:22–0:40 | During the call: Rosa tries to pay $200 for a gift card. "Paused, waiting for family". The family sees the reasons and taps Deny. Rosa's lock screen: "Stopped". | Fixed rules decide money | "She answers anyway. A gift card during a call pauses. Fixed code decides, not AI. The AI can add a warning, never remove one. Her family sees why, in plain words, and says no." |
| 0:40–0:55 | Approve with Face ID. Allowances tab: "Utilities, up to $400, until Nov 30". A $350 power bill pays with no push. | Auth0: roles, step-up, agent scopes | "Auth0 decides who can say yes. Approvers and viewers are separate roles. Over $1,000 two approvers must agree. Approve needs Face ID, and Freeze or a new allowance needs a fresh Auth0 sign-in. A limited, expiring allowance lets routine bills pay." |
| 0:55–1:10 | Terminal: ATM withdrawal. Then a gift card, held: "Cash at an ATM, then a gift card". Bank alert in the family app. | Capital One Nessie: 10 resource types | "Nessie is her bank. Purchases and bills are real payments. Withdrawals catch ATM cash. ATMs and branches tell the family she is at a bank during a call." |
| 1:10–1:25 | Dashboard: "About 4x her usual", the spending chart, the speed card. Then the performance table, close up. | Tiger Data: hypertable + continuous aggregates | "Her spending is a Tiger Data hypertable with real-time continuous aggregates. They spot unusual spending while the payment waits. On a million rows: 13.8 times faster, 3.2 times smaller." |
| 1:25–1:35 | Family taps Freeze. "Frozen. Money is in the safe account." | Nessie transfer, exactly once | "One tap moves her balance to a vault with a Nessie transfer. It runs exactly once, even on a double tap." |
| 1:35–1:47 | Rosa's phone at the largest text size. One big button. | Easy On The Eyes | "For Rosa, no new interface. One action per screen, plain words, the largest text sizes and VoiceOver." |
| 1:47–1:55 | Name, URL, repository | checkwith.us | "Those are test results, not a guarantee. checkwith.us: before money moves, check with the family." |

Do not show or narrate the bill-pay agent or the Guardian push unless their live run was recorded. Keep the final export below two minutes, including titles and credits. Add captions from the final narration and check them against the exported video.

If a live step fails, omit its outcome claim or explicitly label the replacement.
The existing [dashboard clip](gallery/dashboard-backup.md) is 38.4 seconds of
synthetic local UI. It can replace the dashboard shot with a visible
"Synthetic UI preview, simulated decisions" caption. It cannot prove a bank
payment, Auth0 approval, phone filter, or Freeze transfer.

Upload the final export to the team's video host, open its public link in a
signed-out browser, and put that link in the Devpost video field. A relative
repository path is not the public submission video link.
