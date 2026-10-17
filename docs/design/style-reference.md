# Fold-inspired interface design

## Provenance
Original design specification created for this project, not an official Fold document or a recovered getdesign.md download. Reference inspected: https://getdesign.md/design-md/fold-money and its public full-page preview at https://cdn.getdesign.md/catalog/fold-money/home.webp . The linked public repository did not expose a Fold folder during inspection. Colors, measurements, fonts, components, and behavior below are proposed implementation choices, not extracted source tokens.

## Direction
Build a calm personal-finance experience with editorial scale and precise everyday controls. Pair near-white backgrounds with deep ink headings, cool gray panels, and a single clear blue action color. Let generous empty space frame the main message. Use compact, credible financial interface details as the visual centerpiece. Occasional playful abstract illustration is appropriate; avoid filling every section with decoration.

## Tokens
```css
:root {
  --paper: #ffffff;
  --canvas: #f4f5f7;
  --panel: #eceef3;
  --ink: #202749;
  --body: #444b60;
  --muted: #73798b;
  --line: #e2e5ec;
  --blue: #337fe9;
  --blue-soft: #e9f2ff;
  --positive: #248464;
  --negative: #b6434b;
  --radius-control: 10px;
  --radius-card: 18px;
  --radius-feature: 28px;
  --shadow: 0 18px 55px rgba(32,39,73,.08);
}
```
Use blue for primary actions, focus, and selected navigation. Use green/red only for meaningful status, accompanied by text or a sign. Navy can become a full-width feature band with white text. Do not scatter bright colors across peer cards.

## Typography
Use a rounded geometric sans such as DM Sans; provide system-ui and sans-serif fallbacks. This is a substitute, not a verified Fold font. Headlines: weight 600–700, tracking -0.045em, line-height 1.02–1.1. Body: weight 400–500, line-height 1.55. Marketing hero: clamp(44px, 6vw, 80px), maximum 12–15 characters per line. Section headings 32–48px. Application headings 26–34px. Financial totals 32–44px, tabular numerals. Body 15–17px; labels 12–14px. Reserve uppercase, letter-spaced text for short eyebrows.

## Layout and rhythm
Base spacing unit: 4px; prefer 8, 12, 16, 24, 32, 48, 64, 96. Marketing max-width 1120px with 24–48px side padding. Center the opening message; alternate centered statements and balanced two-column feature sections. Give sections 80–120px vertical breathing room. Application shell: 200–224px sidebar, 32px content padding, 24px gaps. Keep transaction rows compact and aligned rather than placing each in a floating card.

## Components
- Header: simple lowercase wordmark, quiet text navigation, one primary action. Avoid heavy chrome.
- Primary button: blue background, white text, 10px radius, 44px minimum touch target; darker blue hover. Secondary: white or transparent with a subtle neutral outline. Never use an unlabeled icon as the only primary action.
- Surface: white on a cool gray canvas, 1px neutral border when separation is needed, 18px corners, little or no shadow. Large feature demonstrations may use a pale panel with a 28px radius.
- Financial summary: muted label, dominant total, quiet time context. Keep currency and precision consistent. Sample values are fictional.
- Transactions: merchant, category/date, right-aligned amount; separators rather than repeated cards. Incoming amounts have a plus sign as well as green text.
- Chart: simple blue line or restrained bars; provide period, units, and a textual summary. Avoid decorative chart noise and misleading axes.
- Phone demonstration: deep navy frame, white or dark-navy app surface, large amount, concise rows. Phone devices support the story rather than crowding the page.
- Empty state: short specific explanation and one useful next action. Loading: preserve layout with skeletons. Error: name the failed task and offer retry without deleting previous data.

## Suggested screens
1. Landing: compact navigation; oversized centered headline; short explanation; blue CTA; pale illustration made from stacked account cards; concise benefit row.
2. Overview: sidebar; greeting/date; total balance; cash-flow panel; recent transactions and connected accounts.
3. Mobile: monthly overview; dominant balance; spending distribution; recent activity; four-item bottom navigation.

## Interaction and accessibility
Provide visible keyboard focus, semantic buttons, accessible names, and hover/focus parity. Meet WCAG AA text contrast; muted text must stay readable. Financial changes should include signs and labels. Minimum touch targets 44px. Respect reduced motion. Use 120–180ms transitions on small state changes; no looping decorative animation. Never display invented security certifications or imply that a mock connection is real.

## Responsive rules
Below 900px, reduce shell padding to 24px and collapse the sidebar into a top navigation. Below 640px, stack feature columns, make primary actions comfortably tappable, and reduce hero size. Application summaries become one column. Transactions preserve merchant and amount; optional metadata moves to a second line. Avoid horizontal page scrolling. Use fluid widths and min-width:0 in grid children.

## Agent handoff
Read this document before implementing. Reuse the palette, typography, spacing, and component rules consistently. Use original product naming and copy unless explicitly asked to reproduce a reference. Build real semantic components and responsive layouts; do not flatten the interface into a screenshot. Treat banking integrations, account balances, and transaction data as demonstration content until connected to a real authorized service. Implement complete loading, empty, and error states when building the functional product.

## Avoid
Neon gradients, glass panels, heavy black outlines, excessive pills, dense boxed dashboards, tiny labels, competing CTAs, copied proprietary illustrations, and unsupported financial/security claims.
