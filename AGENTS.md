# CheckWith.us — agent & contributor guide

Read this before making changes. It is the single source of truth for how we work
in this repo; `CLAUDE.md` just points here.

Built for SwampHacks. Speed over polish — prefer a working implementation over a
clean abstraction unless someone asks for the abstraction.

## What we build

**Read [docs/PLAN.md](docs/PLAN.md) first.** It is the single source of truth for what we
build, the demo, how each sponsor challenge is won, and what is out of scope.

In one line: scam protection where the older adult does nothing and the family does the
work. We are going all in on the sponsor challenges (Nessie, Auth0, Tiger Data, Easy On
The Eyes, GoDaddy). Work is tracked in GitHub issues (`gh issue list`).

## Hard rules (never break these)

1. **AI suggests, code decides money.** No model output moves money directly. Every
   payment passes fixed rules and, when held, family approval.
2. **Money is integer cents everywhere.** Nessie only accepts whole numbers. Convert
   dollars at the edge with one helper. Never use floats for money.
3. **Never send the older adult's texts or bills to a cloud AI model.** Scam
   detection runs on the phone.

## Hackathon rules

Read [docs/RULES.md](docs/RULES.md) before you build, submit, or write Devpost text.
It holds the SwampHacks, Devpost and MLH rules and every judging criterion. If a task
would break a rule there, stop and ask the team.

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
- **Env vars:** names live in `web/.env.example`. Values live in `web/.env.local`
  (never committed) and on Vercel. Ask Dev for the current file, not Haadi.

Done-checks before calling a task done:

```bash
cd web && npm run typecheck && npm run build   # web
cd ml && python eval.py                          # ml: prints scores (script name TBD)
# ios: the app builds and the feature works on a real iPhone
```

## Ownership

GitHub issues are the source of truth for who does what: `gh issue list --assignee <login>`.

| Person | Branch | Area |
| --- | --- | --- |
| Dev (builtbyd3v) | `dev` | Lead. `ios/` (older adult app, Message Filter, Call Directory), `ml/`, integration |
| Haadi (haad1r) | `haadi` | `web/` backend code: Nessie, Auth0, Tiger Data migrations |
| rgons (rgons15) | `rgons` | Design, dashboard UI, Tiger Data performance + scam sequence query, README and Devpost |
| Hitesh (hiteshk2k6) | `hitesh` | Demo script, demo video, Devpost, DEV post (#55) |

Touching someone else's area (for example a migration in `web/db`)? Agree on it in the
team chat first.

## Accounts and hosting

| Service | Account owner | Ask them for |
| --- | --- | --- |
| Vercel (`checkwithus`, production deploys, env vars) | Dev | deploys, `web/.env.local` values |
| Auth0 tenant | Dev | test approver sign-in, dashboard settings, client secrets |
| Nessie (Capital One) | Dev | API key, seeded customers and accounts |
| Tiger Data (Postgres) | Haadi | database access, running live migrations |

Only Dev deploys to production. Do not paste secrets in issues, PRs, or chat logs.

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
