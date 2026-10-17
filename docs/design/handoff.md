# Design handoff (#15)

These original vector frames were created on October 17 **after the app was implemented**.
They document and explore the current design. The sketch and wireframe boards
are new work; they are not presented as an earlier historical design process or
as user-tested designs. All amounts and people are synthetic.

Import the individual SVG files into Figma as editable vector frames. No Figma
document has been created or uploaded from this environment. The repository
assets are the available handoff, alongside [design principles](../design-principles.md)
and [sourced research](../research.md).

| Screen | Editable vector | Implementation / behavior |
| --- | --- | --- |
| Older adult Home | [home.svg](home.svg) | `HomeView`, `ContentView.swift`; safety first, one primary Ask my family button |
| Paused | [paused.svg](paused.svg) | `StatusView`, `ContentView.swift`; money is safe, family calls, one OK button |
| Ask my family confirmation | [asked.svg](asked.svg) | `ContentView.swift`; confirm the alert was sent, one OK button |
| Lock-screen card | [lock-screen.svg](lock-screen.svg) | `SafeCard.swift`; waiting outcome; updates while the phone app polls |
| Family approval | [family-approval.svg](family-approval.svg) | `FamilyViews.swift`; amount, payee, true hold reasons, then Deny / Approve |
| Family dashboard | [dashboard.svg](dashboard.svg) | `web/app/dashboard`; held payment with two-hour sequence timeline |

Gallery boards: [new exploratory sketches](../gallery/design-sketch.png),
[new wireframes](../gallery/design-wireframe.png),
[visual specifications](../gallery/design-final.png).
The final specifications are mockups. Actual app captures remain in
[research.md](../research.md#design-steps) and
[dashboard-review.md](../gallery/dashboard-review.md).

The older adult frames use 22px body copy, 38px headlines and 80px primary
buttons. The native implementation must continue to honor Dynamic Type and
56pt minimum tap targets. Family screens use explicit state words and separate
Deny/Approve actions; Guardian mode displays its approval instruction instead
of a dashboard Approve button. More than $1,000 requires two different approvers.

Rebuild from the repository root:

```sh
node docs/design/generate-frames.mjs
node docs/design/capture-boards.mjs
```

The renderer uses the existing Playwright development dependency. Plain SVG,
system fonts and original shapes only; no external artwork. No parent interview
quotes were provided. Add verified quotes and resulting design changes to
`docs/research.md` when available; do not fabricate them.

AI tool used: Codex for the vector assets and handoff.
