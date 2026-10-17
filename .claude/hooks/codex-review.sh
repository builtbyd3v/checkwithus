#!/usr/bin/env bash
# Second-opinion QA pass: after Claude finishes a turn in which files changed,
# hand those files to the Codex CLI for an independent review. Findings are fed
# back to Claude so it can fix them before the turn really ends.
#
# Wired up as a Stop hook in .claude/settings.json.
# Kill switch: touch .claude/codex-review/DISABLED
set -uo pipefail

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
STATE_DIR="$PROJECT_DIR/.claude/codex-review"
STAMP="$STATE_DIR/.last-review"
LOG_DIR="$STATE_DIR/logs"
mkdir -p "$LOG_DIR"

[ -e "$STATE_DIR/DISABLED" ] && exit 0

PY=$(command -v python || command -v python3) || exit 0
input=$(cat)

# Already inside a Codex-triggered continuation: one review per turn, no loops.
active=$(printf '%s' "$input" | "$PY" -I -c 'import json,sys
try: print("1" if json.load(sys.stdin).get("stop_hook_active") else "")
except Exception: print("")' 2>/dev/null)
if [ -n "$active" ]; then
  touch "$STAMP"
  exit 0
fi

# First run just plants the marker — nothing to compare against yet.
if [ ! -f "$STAMP" ]; then
  touch "$STAMP"
  exit 0
fi

mapfile -t FILES < <(find "$PROJECT_DIR" -type f -newer "$STAMP" \
  -not -path '*/.git/*' -not -path '*/.claude/*' -not -path '*/node_modules/*' \
  -not -path '*/dist/*' -not -path '*/build/*' -not -path '*/.next/*' \
  -not -path '*/venv/*' -not -path '*/__pycache__/*' -not -path '*/target/*' \
  -not -name 'package-lock.json' -not -name 'pnpm-lock.yaml' -not -name '*.log' \
  \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' -o -name '*.mjs' \
  -o -name '*.py' -o -name '*.go' -o -name '*.rs' -o -name '*.java' -o -name '*.kt' \
  -o -name '*.swift' -o -name '*.rb' -o -name '*.php' -o -name '*.cs' -o -name '*.sql' \
  -o -name '*.c' -o -name '*.h' -o -name '*.cpp' -o -name '*.hpp' -o -name '*.sh' \
  -o -name '*.html' -o -name '*.css' -o -name '*.scss' -o -name '*.vue' -o -name '*.svelte' \
  -o -name '*.json' -o -name '*.yaml' -o -name '*.yml' -o -name '*.toml' \) \
  2>/dev/null | head -40)

[ "${#FILES[@]}" -eq 0 ] && exit 0

# Claim this batch before the review runs, so edits made meanwhile are not swallowed.
touch "$STAMP"

LIST=""
for f in "${FILES[@]}"; do
  LIST="$LIST
- ${f#"$PROJECT_DIR"/}"
done

read -r -d '' PROMPT <<PROMPTEOF
You are a second-opinion reviewer. Another AI coding agent just edited the files
below in this project. Review those changes and the code they directly touch.
If this is a git repo, "git diff" and "git status" show exactly what changed.

Files:$LIST

Report only concrete, verifiable defects: logic bugs, broken contracts between
modules, unhandled error paths, security problems, wrong API usage, tests that
cannot pass. No style nits, no speculation, no praise. For each finding give
file:line, what breaks, and the one-line fix. Keep the whole report under 300 words.

End your reply with exactly one line, either "VERDICT: PASS" (nothing worth
fixing) or "VERDICT: ISSUES" (you found something).
PROMPTEOF

TS=$(date +%Y%m%d-%H%M%S)
REPORT="$LOG_DIR/$TS.md"
# notify=[] keeps codex from waiting on the desktop notifier, which has been
# seen to hold the process open long after the review itself finished.
timeout 240 codex exec --sandbox read-only --skip-git-repo-check \
  -c notify='[]' -C "$PROJECT_DIR" \
  -o "$REPORT" "$PROMPT" >"$LOG_DIR/$TS.raw.log" 2>&1
rc=$?

if [ $rc -ne 0 ] || [ ! -s "$REPORT" ]; then
  printf '%s' "$LOG_DIR/$TS.raw.log" | "$PY" -I -c 'import json,sys
print(json.dumps({"systemMessage":"Codex review did not run (see "+sys.stdin.read()+")","suppressOutput":True}))'
  exit 0
fi

if grep -q 'VERDICT: ISSUES' "$REPORT"; then
  "$PY" -I -c 'import json,sys
report, path = open(sys.argv[1], encoding="utf-8", errors="replace").read(), sys.argv[2]
print(json.dumps({
  "decision": "block",
  "reason": ("A second reviewer (Codex) reviewed the files you just changed and "
             "found issues. Verify each one against the code yourself, fix the real "
             "ones, and say plainly which you rejected and why. Do not take it on "
             "faith.\n\n" + report + "\n\n(full report: " + path + ")"),
  "systemMessage": "Codex found issues in the changed files - report: " + path,
})) ' "$REPORT" "$REPORT"
else
  "$PY" -I -c 'import json,sys
print(json.dumps({"systemMessage":"Codex review: clean (" + sys.argv[1] + " files) - " + sys.argv[2], "suppressOutput":True}))' "${#FILES[@]}" "$REPORT"
fi
exit 0
