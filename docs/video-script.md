# Submission video (1 minute 55 seconds)

Record the same reviewed commit on both phones and the server. This is a shot
plan, not evidence that the steps have been recorded or verified. Use synthetic
Rosa data. Rehearse the live setup in [demo.md](demo.md) first. Do not show tokens,
pairing codes, notifications from real people, or account settings.

| Time | Picture | Narration |
| --- | --- | --- |
| 0:00–0:10 | Older adult home screen and family screen side by side | “checkwith.us protects an older adult while the family does the work. Rosa is our synthetic demo user.” |
| 0:10–0:25 | Real iPhone: unknown-sender scam text in Spam, then call label | “Our small scam model filters texts on the phone. Known scam calls are labelled. Texts never go to a cloud AI model.” |
| 0:25–0:45 | Request a gift-card payment during the call; show held screen and family reasons | “The payment pauses. Fixed code checks the payee, amount, call state and spending history. AI can add a warning; it cannot authorize money.” |
| 0:45–1:00 | Family denies; older adult screen updates | “The family sees why it paused and says no. The phone updates. This request never becomes a bank payment.” |
| 1:00–1:15 | ATM cash then gift-card timeline on dashboard | “Tiger Data finds ATM cash followed by a gift card within two hours. The family sees the amounts and times together.” |
| 1:15–1:30 | Known utility bill under an allowance, then Freeze | “A limited, expiring family allowance lets a routine utility bill pay. Freeze moves the remaining spending balance to the Nessie vault.” |
| 1:30–1:45 | README evaluation and performance tables, readable close-up | “Our shipped one-megabyte model catches 96 percent of scams in the real-text test set, with 2.4 percent false holds. On a million synthetic rows, all-family weekly totals were 13.8 times faster using aggregates.” |
| 1:45–1:55 | Product name and repository URL | “Those are test results, not a guarantee. Auth0 checks family identity and roles. checkwith.us: before money moves, check with the family.” |

Keep the final export below two minutes, including titles and credits. Add captions
from the final narration and check them against the exported video. Do not speed
through unreadable screens to fit the limit; cut a segment instead.

If a live step fails, omit its outcome claim or explicitly label the replacement.
The existing [dashboard clip](gallery/dashboard-backup.md) is 38.4 seconds of
synthetic local UI. It can replace the dashboard shot with a visible
“Synthetic UI preview — simulated decisions” caption. It cannot prove a bank
payment, Auth0 approval, phone filter, or Freeze transfer. Do not describe the
Guardian push or bill agent as live-verified without recording their actual run.

Upload the final export to the team's video host, open its public link in a
signed-out browser, and put that link in the Devpost video field. A relative
repository path is not the public submission video link.
