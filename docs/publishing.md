# Publishing the submission materials

Use [devpost.md](devpost.md) for the submission fields, [dev-post.md](dev-post.md)
for the DEV article, [video-script.md](video-script.md) for the two-minute video,
and [pitch.md](pitch.md) and [demo.md](demo.md) for the separate expo demo (30 s judge video + 2:00 live talk). The PR description
is the current work-status record; this page explains how to publish the assets.

## Select the demonstrated build

Everything in these docs is on `main` and live at checkwith.us. Pin one `main`
commit, record its SHA, and use it for the server and both iPhones. Remove claims
for any feature the demo does not show. A successful health endpoint alone is
not enough; check the Vercel deployment commit too.

The model scores link to saved evaluation outputs in the README. Performance
numbers come from the recorded benchmark JSON; `cd web && npm run perf:report`
regenerates its README table and report without contacting the database.
Confirm dataset licenses and the domain challenge's registration eligibility
with the team. Do not replace unresolved personal details with invented stories.

## Gallery upload captions

Use selected images rather than uploading every state. Keep text readable in the
platform preview. The following captions distinguish app captures from fixtures
and design explorations:

| Asset in `docs/gallery/` | Suggested caption |
| --- | --- |
| `03-older-adult-home-safe.png` | “Older adult home screen from the development app: plain words and one large action.” |
| `05-family-approvals.png` | “Family approval screen from the development app, using synthetic demo data.” |
| `06-family-why-we-paused.png` | “The family sees concrete hold reasons before deciding, using synthetic demo data.” |
| `dashboard-sequence-390.png` | “Local dashboard fixture: synthetic ATM cash and gift-card timeline. Decisions are simulated.” |
| `dashboard-review-390-keyboard-long-name.png` | “Local fixture checks keyboard focus, long payee names and a narrow screen.” |
| `design-final.png` | “Post-implementation design exploration across six screens; these are mockups.” |

See [dashboard-review.md](gallery/dashboard-review.md) and
[design handoff](design/handoff.md) for provenance. Do not label the new boards
as early sketches or user-testing evidence. Use original assets without music
or third-party imagery requiring additional permission.

## DEV article

Copy the title, tags and Markdown from `dev-post.md` into the team's DEV editor.
Keep `published: false` for any import until the author has reviewed the preview.
The MLH x DEV Writing Challenge template requires the tags `mlhacks`,
`devchallenge` and `hackathon`, and the first line "This is a submission for the
MLH x DEV Writing Challenge". Check the official page for any change. A cover image is optional unless those rules
require it; use an original gallery asset with its accurate caption if desired.

Verify links, tables, code formatting and AI disclosure in the preview. Check
the `decideHold` excerpt against the selected commit. Publish through the team
account, then paste the actual public article URL into the DEV Writing section
of `devpost.md`. Never substitute a repository draft link for a published post.

## Devpost and final video

Record and export the complete video using the shot plan, then verify duration,
captions and public playback without signing in. The existing backup clip and
separate SRT are supporting footage, not a complete end-to-end submission.

Paste the prepared sections into their matching Devpost fields, add the public
video and DEV URLs, upload the selected gallery images, and review the seven
entry names in `devpost.md`. Best First Timers is the single specialized track;
the other listed entries are challenges. Confirm team membership, licenses,
AI disclosure and demonstrated behavior before submitting. Follow the event
deadline in [RULES.md](RULES.md). After publication, verify the public project
page and update issue #7 with its actual links; keep it open while those links
or the required complete demo are missing.
