#!/usr/bin/env bash
# backward.sh
# Usage: ./backward.sh 5
#
# Goal: iterate on specs/ and IMPLEMENTATION_PLAN.md until it's coherent.
# Then you switch to ./forward.sh

set -euo pipefail
ITERS="${1:-10}"
NOTES_FILE="${2:-notes.txt}"

mkdir -p specs

# If unauthenticated, run `docker sandbox run claude` and login
# Filter to only JSON lines (starting with {) for the visualizer
docker sandbox run claude -p "print 'ok'" --output-format stream-json --verbose 2>&1 | grep --line-buffered '^{' | bunx repomirror visualize | sed $'s/$/\r/'

for ((i = 1; i <= ITERS; i++)); do
	echo "=== BACKWARD ITERATION $i/$ITERS ==="

	docker sandbox run claude -p "
You are running in BACKWARD MODE.

You must NOT implement code in this mode.

Inputs:
- specs/ (requirements; one topic per file)
- Existing repo code (read only unless you are updating specs)
- Any progress/status files

Tasks:
1) Read the repo and identify missing, ambiguous, or contradictory requirements.
2) Update or create spec files under specs/ so each file covers a single topic.
3) Produce/overwrite ${NOTES_FILE} as a prioritized task list with NO implementation.
4) Exit after writing the plan.

Hard rule: do not change application code in backward mode.
" --output-format stream-json --verbose 2>&1 | grep --line-buffered '^{' | bunx repomirror visualize | sed $'s/$/\r/'
done
