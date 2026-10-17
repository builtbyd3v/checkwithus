# Backup dashboard recording (#7)

[Dashboard backup video](dashboard-backup.webm) · [SRT captions](dashboard-backup.srt)

This silent UI walkthrough is 38.4 seconds long, with separate SRT captions. It records the actual
shared dashboard card and controls through the **local synthetic fixture**:
ATM cash then gift card, Deny, partial approval, Approved, Expired and Guardian-only
approval instructions. It is not an authenticated bank transaction or a Guardian
push recording. The page states that the data and decisions are simulated.

Use this as backup footage for the family-dashboard portion of the expo or edit
it into a team-recorded submission video. A complete project video should also
show the on-device Message Filter, call label and older adult flow on a real
iPhone. No device access or team video account was available here, and this file
has not been uploaded or submitted to Devpost.

Re-record from `web/` in two terminals:

```sh
npm run preview:dashboard
```

```sh
npm run demo:record-dashboard
```

All people, payees and amounts are synthetic. There is no external music,
artwork, narration or private data. Codex scripted the capture; Playwright
(Apache-2.0) records the local browser.
