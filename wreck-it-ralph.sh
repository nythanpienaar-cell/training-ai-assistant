#!/usr/bin/env bash
#
# wreck-it-ralph.sh — a "Ralph loop" for the Project 54 Training Manual Assistant.
#
# A Ralph loop runs the SAME prompt through a series of completely fresh,
# stateless Claude Code sessions. Each session picks up the next GitHub issue,
# builds it test-first, commits, closes the issue, and leaves a plain-English
# note in .ralph/progress.txt so the next (amnesiac) session knows what's done.
# After each session the loop asks GitHub how many issues are still open, and
# stops early once none are.
#
# Usage:
#   ./wreck-it-ralph.sh <number-of-iterations>
#
# Requirements: bash (Git Bash on Windows is fine), the `claude` CLI, and `gh`
# (GitHub CLI) authenticated for this repo.

set -uo pipefail

# ----------------------------------------------------------------------------
# Always run from the project root (the dir this script lives in), so the
# relative paths below resolve no matter where the loop is launched from.
# ----------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PROGRESS_FILE=".ralph/progress.txt"
LOG_DIR=".ralph/logs"

# How many issues are still open, straight from GitHub. We ask GitHub rather than
# trusting the session's own words: a session that merely MENTIONS being finished
# reads identically to one that IS finished, and that ambiguity used to end the
# loop after a single iteration.
count_open_issues() {
  gh issue list --state open --limit 100 --json number --jq 'length' 2>/dev/null
}

# Open issues a human must do themselves are not work the loop can ever finish,
# so they must not count towards "is there anything left for me?".
count_agent_issues() {
  gh issue list --state open --limit 100 --json number,labels \
    --jq '[.[] | select(.labels | map(.name) | index("hitl") | not)] | length' 2>/dev/null
}

# ----------------------------------------------------------------------------
# Validate the single argument: how many iterations to attempt.
# ----------------------------------------------------------------------------
ITERATIONS="${1:-}"

if [[ -z "$ITERATIONS" ]]; then
  echo "Usage: ./wreck-it-ralph.sh <number-of-iterations>" >&2
  exit 1
fi

if ! [[ "$ITERATIONS" =~ ^[0-9]+$ ]] || [[ "$ITERATIONS" -lt 1 ]]; then
  echo "Error: iterations must be a positive whole number. Got: '$ITERATIONS'" >&2
  exit 1
fi

# ----------------------------------------------------------------------------
# Make sure the tracking files exist (idempotent — safe to re-run).
# ----------------------------------------------------------------------------
mkdir -p .ralph "$LOG_DIR"
[[ -f "$PROGRESS_FILE" ]] || : > "$PROGRESS_FILE"

# Fail fast if the tools the sessions rely on are missing.
if ! command -v claude >/dev/null 2>&1; then
  echo "Error: 'claude' CLI not found on PATH." >&2
  exit 1
fi
if ! command -v gh >/dev/null 2>&1; then
  echo "Error: 'gh' (GitHub CLI) not found on PATH." >&2
  exit 1
fi

# Be graceful on Ctrl-C.
trap 'echo; echo "Interrupted. Stopping the Ralph loop."; exit 130' INT

# ----------------------------------------------------------------------------
# The prompt handed to every fresh session. It is intentionally self-contained:
# a fresh session has NO memory of prior ones — the only durable state is the
# git repo, the GitHub issues, and .ralph/progress.txt.
#
# Single-quoted heredoc: nothing inside is expanded by this script.
# ----------------------------------------------------------------------------
read -r -d '' RALPH_PROMPT <<'EOF'
You are ONE iteration of an autonomous build loop ("Ralph") for the **Project 54
Training Manual Assistant** — a browser app that generates training manuals in the
"REFRESH" template style. You are a fresh session with NO memory of previous
iterations. The only durable state is the git repository, the GitHub issues, and
.ralph/progress.txt. Do the following steps IN ORDER. Do not deviate or skip ahead.

## 1–4. Load context (read these before doing ANYTHING else)
1. Read `README.md` — what the app is and how it runs.
2. Read `docs/design.md` — the visual design system (colours, type, components)
   the manuals and their PDF export must follow. Binding.
3. Read `template.js` — the manual's structural "essence" (the REFRESH skeleton
   and the design tokens on `window.TEMPLATE_DESIGN`). Binding.
4. Read the parent spec with `gh issue view 1`, then `.ralph/progress.txt` — what
   earlier iterations already finished. Do NOT redo completed work.

## 5. Pick exactly ONE issue
See the open work, with its labels:
    gh issue list --state open --limit 100 --label ready-for-agent
An issue is ELIGIBLE only if all three hold:
  a. it is open;
  b. it is NOT labelled `hitl` (that label means a human must do it — see below);
  c. every issue named in its own "Blocked by" section is already CLOSED.
Read each candidate's body with `gh issue view <n>` to check (c). Trust the
issue's own "Blocked by" section — it is the authority on ordering. A blocked
issue is NEVER "next", however low its number. Among eligible issues, take the
lowest-numbered one. If a "Blocked by" entry is malformed or names no issue,
treat the issue as blocked and say so in your progress note rather than guessing.
- The parent spec (issue #1) is the umbrella spec, NOT a slice: never pick it and
  never close it. The 5 build tickets are #2–#6.
- If NO issue is eligible, stop immediately — do no other work, write no blocker
  note. This is the normal, correct end of the loop: it means everything left is
  either human-only or waiting on human-only work. The loop detects this by
  itself and will stop; you do not need to signal it.
- If the next issue is a human-in-the-loop (`hitl`) task needing credentials,
  account creation, secrets, deploys, or subjective human authoring that you
  genuinely cannot do, STOP: append a clear blocker note to
  `.ralph/progress.txt` (which issue, why it is blocked, what a human must do),
  and exit WITHOUT committing. Never fake human-only work.
Work on ONE issue only this iteration.

## 6. Build it test-first with the TDD skill (red → green → refactor)
Use the **`tdd` skill** to implement the chosen issue. It drives the red-green-
refactor cycle: write a FAILING test that specifies the issue's behaviour FIRST,
confirm it fails for the right reason, write the smallest code that makes it pass,
then refactor. NEVER write implementation before a failing test exists.
- Assert on external behaviour a user would see, never on internals/private helpers.
- This repo has NO test runner yet: the first slice (#2) introduces the minimal
  one. Node's built-in `node --test` suits the pure `parseManual` function, which
  is written to be importable outside the browser. Reuse that setup thereafter.
- Some issues' fidelity ("matches the template by eye") is VISUAL and cannot be
  auto-verified in a headless session. For those, build the rendering faithfully
  from the `docs/design.md` tokens, base your green/commit decision on the tests
  you CAN write (e.g. the parseManual model), and NOTE in your progress entry that
  a human must visually check the PDF against Template/Copy of REFRESH _TRAINING_.pdf.
- Run the FULL test suite and CONFIRM everything is green. If you cannot reach
  green, STOP: append the blocker to `.ralph/progress.txt` and exit. Do NOT commit
  red tests.

## 7–9. Ship it
7. `git add` the changes, `git commit` with a clear message that references the
   issue number, and `git push`. NEVER commit while any test is red.
8. Close the issue: `gh issue close <n>` with a one-line comment. NEVER close an
   issue whose tests are not passing.
9. APPEND (never overwrite) a plain-English summary to `.ralph/progress.txt`:
   2–4 sentences, simple enough for someone still learning — what you built, why
   it matters, which tests confirm it, and any visual check a human still needs.
   Start the entry with the date and the issue number, e.g. "2026-07-29  #2  ...".

## Guardrails (never violate)
- ONE issue per iteration.
- Never pick or close the parent spec issue #1.
- Always build via the tdd skill; never skip the failing-test-first step.
- Never commit with failing/red tests.
- Never close an issue whose tests are not passing.
- If you get stuck or need input you cannot resolve, write the blocker clearly to
  `.ralph/progress.txt` and exit gracefully rather than guessing.
EOF

# ----------------------------------------------------------------------------
# The loop.
# ----------------------------------------------------------------------------
echo "Ralph loop starting: up to $ITERATIONS iteration(s)."
echo "Progress log: $PROGRESS_FILE   Session logs: $LOG_DIR/"
echo

for (( i=1; i<=ITERATIONS; i++ )); do
  STAMP="$(date '+%Y-%m-%d %H:%M:%S')"
  LOG_FILE="$LOG_DIR/iteration-$(printf '%03d' "$i").log"

  echo "============================================================"
  echo "  Ralph iteration $i of $ITERATIONS   ($STAMP)"
  echo "  Log: $LOG_FILE"
  echo "============================================================"

  # Snapshot the world BEFORE the session, so afterwards we can ask the only
  # question that matters: did anything actually change?
  HEAD_BEFORE="$(git rev-parse HEAD 2>/dev/null)"
  OPEN_BEFORE="$(count_open_issues)"

  # Fresh, headless session. Stream to the console AND capture to a log, so the
  # run can be reviewed afterwards.
  #
  # Model/effort are PINNED for reproducibility and best cost/quality balance:
  #   --model claude-sonnet-5  the coding workhorse: near-Opus quality on these
  #                            well-specified, test-guarded slices at far lower
  #                            cost, so an unattended loop won't burn usage fast.
  #   --effort medium          a moderate reasoning dial: cheaper/faster per
  #                            iteration than high, adequate for well-specified,
  #                            test-guarded slices. Bump to high (or xhigh/max)
  #                            for an unusually hard issue.
  claude -p "$RALPH_PROMPT" --model claude-sonnet-5 --effort medium --dangerously-skip-permissions 2>&1 | tee "$LOG_FILE"
  CLAUDE_EXIT=${PIPESTATUS[0]}

  if [[ "$CLAUDE_EXIT" -ne 0 ]]; then
    echo
    echo ">> Iteration $i: claude exited with code $CLAUDE_EXIT. Continuing to next iteration."
  fi

  # Out of usage: every further iteration would be a no-op that burns the count
  # for nothing. Anchored to the line start, because that is how the CLI prints
  # it — a session merely discussing limits mid-sentence must not trip this.
  if grep -qiE "^You've hit your (session|usage) limit" "$LOG_FILE"; then
    echo
    echo ">> Claude reports the usage limit is reached, so no further iteration can"
    echo "   do any work. Stopping after iteration $i. Re-run once it resets."
    exit 1
  fi

  # Ask GitHub — the source of truth — whether anything is left.
  OPEN_COUNT="$(count_open_issues)"
  AGENT_COUNT="$(count_agent_issues)"

  if ! [[ "$OPEN_COUNT" =~ ^[0-9]+$ ]] || ! [[ "$AGENT_COUNT" =~ ^[0-9]+$ ]]; then
    echo
    echo ">> Warning: could not read the open issues from GitHub. Assuming work"
    echo "   remains and continuing."
    echo ">> Iteration $i finished."
    echo
    continue
  fi

  if [[ "$OPEN_COUNT" -eq 0 ]]; then
    echo
    echo ">> All GitHub issues are closed. Stopping early after iteration $i."
    exit 0
  fi

  if [[ "$AGENT_COUNT" -eq 0 ]]; then
    echo
    echo ">> The only issues left ($OPEN_COUNT) are labelled 'hitl' — human-only work"
    echo "   the loop can never do. Stopping after iteration $i. See $PROGRESS_FILE."
    exit 0
  fi

  # The catch-all: if a whole session changed NOTHING — no new commit, no issue
  # closed — then the next identical session will change nothing either, because
  # a fresh session sees the same repo and the same issue list. Whatever the
  # cause (every remaining issue blocked behind human work, a stuck build, a
  # confused session), spending the remaining iterations to re-derive the same
  # dead end is pure waste. Stop and let a human look.
  HEAD_AFTER="$(git rev-parse HEAD 2>/dev/null)"
  if [[ "$HEAD_AFTER" == "$HEAD_BEFORE" ]] && [[ "$OPEN_COUNT" == "$OPEN_BEFORE" ]]; then
    echo
    echo ">> Iteration $i changed nothing: no new commit, and no issue closed."
    echo "   A fresh session would hit the same wall, so stopping here rather than"
    echo "   burning the remaining iteration(s)."
    echo "   $AGENT_COUNT non-hitl issue(s) are open but evidently not workable yet —"
    echo "   they are most likely blocked behind 'hitl' work. Check $PROGRESS_FILE."
    exit 0
  fi

  echo
  echo ">> $OPEN_COUNT issue(s) still open ($AGENT_COUNT for the agent, $(( OPEN_COUNT - AGENT_COUNT )) hitl)."
  echo ">> Iteration $i finished."
  echo
done

echo "============================================================"
echo "Reached the iteration limit ($ITERATIONS) without a COMPLETE signal."
echo "Stopping gracefully. Review $PROGRESS_FILE for status and any blockers."
echo "============================================================"
exit 0
