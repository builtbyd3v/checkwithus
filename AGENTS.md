# CheckWith.us — agent & contributor guide

Read this before making changes. It is the single source of truth for how we work
in this repo; `CLAUDE.md` just points here.

Built for SwampHacks. Speed over polish — prefer a working implementation over a
clean abstraction unless someone asks for the abstraction.

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

> **TODO — not decided yet.** Fill this in as soon as the first real code lands.
> Include: language and framework, how to install deps, how to run the app
> locally, how to run tests, and any required env vars (names only — never commit
> secrets).

## Ownership

> **TODO — fill in once work is split.** One line per person: name, branch, and
> the directories or features they own, so agents know whose area they are
> touching and whose PR to read first.

## Ground rules

- No secrets, API keys, or `.env` files in the repo. Commit a `.env.example` with
  empty values instead.
- Do not reformat or restructure files you were not asked to touch; it buries the
  real diff and causes conflicts for everyone else.
- If you hit something ambiguous and the answer changes what you build, ask in the
  team chat rather than guessing and building the wrong thing twice.
