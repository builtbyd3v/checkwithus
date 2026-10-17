# CheckWith.us — agent & contributor guide

Read this before making changes. It is the single source of truth for how we work
in this repo; `CLAUDE.md` just points here.

Built for SwampHacks. Speed over polish — prefer a working implementation over a
clean abstraction unless someone asks for the abstraction.

## What we build

checkwith.us protects older adults from scams with zero effort from them. Family
members approve risky payments with Face ID. All scam detection runs on the phone.

- **Older adult iPhone app:** Message Filter extension (on-device scam model screens
  texts), Call Directory extension ("Possible scam" labels), payment holds,
  bank-while-on-a-call alert, Screen Time app lock, one big "Ask my family" button,
  lock-screen card.
- **Family iPhone app:** Auth0 CIBA push, approve or deny with Face ID, family circle
  (up to 3 people, first answer decides, no answer in 5 minutes = blocked).
- **Backend:** Next.js on Vercel. Capital One Nessie (accounts, payments), Auth0
  (approvals), Tiger Data (spending history, dashboard).
- **On-device AI:** Guard = rules + fine-tuned DistilBERT (Core ML). checkwith-1 =
  fine-tuned Qwen3.5-2B (MLX Swift). Family decisions retrain the Guard.

## Hard rules (never break these)

1. **AI suggests, code decides money.** No model output moves money directly. Every
   payment passes fixed rules and, when held, family approval.
2. **Money is integer cents everywhere.** Nessie only accepts whole numbers. Convert
   dollars at the edge with one helper. Never use floats for money.
3. **Never send the older adult's texts or bills to a cloud AI model.** Scam
   detection runs on the phone.

## Before you start: read the live state

This file goes stale. The repo does not. Always begin by checking what has actually
landed and what is in flight:

```bash
git fetch origin
git log --oneline origin/main -20     # what has landed
git diff --stat origin/main...HEAD    # what you are adding on top
gh pr list                            # what others have in flight
gh pr view <n>                        # what a specific PR is doing and why
```

If `gh` is missing, install it (`winget install GitHub.cli` on Windows,
`brew install gh` on macOS) and run `gh auth login`. Without it you are blind to
everything outside your own working tree.

## Branching

- `main` is the shared base. Everyone branches off it.
- Each person works on their own branch named after them (`haadi`, etc.).
- Never commit directly to someone else's branch.
- Rebase or merge `main` into your branch often — long-lived divergence is what
  actually costs time at a hackathon, not merge conflicts themselves.

## PRs are the status channel

We do not keep a hand-maintained status file; it is wrong within the hour. The PR
description *is* the status update. When you open one, say:

- what it does, in one or two sentences
- anything another person's work will collide with (shared files, schema, routes,
  env vars, package.json deps)
- anything deliberately left unfinished, so nobody re-does it

That way every other agent on the team gets real context from `gh pr list` without
anyone maintaining a changelog by hand.

## Automated review

A `Stop` hook in `.claude/settings.json` sends files changed during a turn to the
Codex CLI for an independent read-only review, and feeds findings back for the
agent to verify and fix. See `.claude/codex-review/README.md`. It is currently set
up on Haadi's branch only — adopt it on yours if you want the same safety net.

## Stack

```
ios/        Xcode project: older adult app, family app, extensions
web/        Next.js backend + family dashboard (deployed to Vercel)
ml/         datasets, training, eval scripts, exported models
docs/       Devpost write-up, demo script, research
```

- **Web:** Next.js App Router, TypeScript strict, Tailwind only, npm (never npx; use
  `npm exec --`). Server Components by default. Validate input at route handlers and
  server actions. No `any`. Node.js runtime on Vercel, never `runtime = 'edge'`.
- **iOS:** Swift, SwiftUI. Builds are signed with Dev's Apple Developer account, so
  iOS changes go through a PR and Dev builds them to devices.
- **ML:** Python 3.12 in `ml/`, pinned versions in `ml/requirements.txt`. Every
  trained model gets a row in the eval table in `README.md`.
- **Older adult screens:** large text (Dynamic Type), big tap targets, plain words,
  one action per screen.
- **Env vars (names only):** `NESSIE_API_KEY`, `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`,
  `AUTH0_CLIENT_SECRET`, Tiger Data connection string (name TBD). Keep them in
  `.env.local`; list names in `.env.example`.

Done-checks before calling a task done:

```bash
cd web && npm run typecheck && npm run build   # web
cd ml && python eval.py                          # ml: prints scores (script name TBD)
# ios: the app builds and the feature works on a real iPhone
```

## Ownership

| Person | Branch | Owns |
| --- | --- | --- |
| Dev (builtbyd3v) | `dev` | Lead. All ML (`ml/`: training, fine-tuning, learning loop, eval table). All iOS (`ios/`: older adult app, Message Filter, Call Directory, Screen Time lock, bank alert, lock-screen card, building and signing the family app). Integration. |
| Haadi (haad1r) | `haadi` | `web/`: Next.js on Vercel, Nessie, Auth0 CIBA, family circle logic, Tiger Data, family dashboard |
| rgons (rgons15) | `rgons` | Both apps' screens (Figma), SwiftUI views for the family app (PR to Dev), `docs/` research write-up |
| [data + demo teammate, not on the repo yet] | `[their name]` | `ml/data/`: collect and label training data for Dev (about 200 hand-written elder scams, real bills, cleaned public sets). `docs/`: Devpost, demo script, backup video |

## Ground rules

- No secrets, API keys, or `.env` files in the repo. Commit a `.env.example` with
  empty values instead.
- Do not reformat or restructure files you were not asked to touch; it buries the
  real diff and causes conflicts for everyone else.
- If you hit something ambiguous and the answer changes what you build, ask in the
  team chat rather than guessing and building the wrong thing twice.
- Hackathon rules: all code is written during the event (after Friday 8:30 PM), and
  AI tool use must be disclosed on Devpost. Note the AI tools you used in each PR.
- Devpost is due Sunday 8:00 AM ET. The expo is Sunday 10 AM to noon.
