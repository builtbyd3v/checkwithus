# Codex second-opinion review

After Claude finishes a turn in which project files changed, `.claude/hooks/codex-review.sh`
hands those files to the Codex CLI (`codex exec`, read-only sandbox) for an independent
review. If Codex reports problems, they are fed back to Claude, which must verify and
fix them before the turn ends. One review per turn - a Codex-triggered continuation
never triggers another.

- Reports: `logs/<timestamp>.md` (full Codex transcript in the matching `.raw.log`)
- Turn it off:  `touch .claude/codex-review/DISABLED`
- Turn it on:   `rm .claude/codex-review/DISABLED`
- Changed-file tracking is by mtime against `.last-review`, so edits made through
  Bash, Write or Edit are all caught. Only source extensions are reviewed, and
  node_modules/dist/build/.git are skipped.
