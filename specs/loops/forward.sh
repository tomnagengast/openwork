#!/usr/bin/env bash
# forward.sh
# Usage: ./forward.sh <spec.md|"query with spaces"> [orchestrator|builder] [iterations]

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(git rev-parse --show-toplevel)"
START=$(date +"%Y%m%d_%H%M%S")

INPUT="${1:-}"
INIT="${2:-orchestrator}" # orchestrator | builder

# Detect if input is a filepath or a query (query contains spaces)
if [[ "$INPUT" == *" "* ]]; then
	# Query mode: write query to generated spec file
	SPEC_MD="${PROJECT_DIR}/specs/loops/${START}/spec.md"
	mkdir -p "$(dirname "$SPEC_MD")"
	echo "$INPUT" >"$SPEC_MD"
else
	# Filepath mode: use as-is
	SPEC_MD="${PROJECT_DIR}/${INPUT}"
fi
STATUS_MD="${PROJECT_DIR}/specs/loops/${START}/status.md"
TASK_MD="${PROJECT_DIR}/specs/loops/${START}/tasks/task.md"
STEP_MD="${PROJECT_DIR}/specs/loops/${START}/steps/step.md"
PROGRESS_MD="${PROJECT_DIR}/specs/loops/${START}/progress.md"
ARCHIVE="${PROJECT_DIR}/specs/loops/${START}/archive"
ITERS="${3:-}"

echo "
Starting loop in ${SCRIPT_DIR} at ${START}:
- SPEC_MD: ${SPEC_MD}
- INIT: ${INIT}
- STATUS_MD: ${STATUS_MD}
- TASK_MD: ${TASK_MD}
- STEP_MD: ${STEP_MD}
- PROGRESS_MD: ${PROGRESS_MD}
- ARCHIVE: ${ARCHIVE}
- ITERS: ${ITERS}
"

if [[ -z "${INPUT}" ]]; then
	echo "Usage: $0 <spec.md|\"query with spaces\"> [orchestrator|builder] [iterations]"
	exit 1
fi

if [[ "${INIT}" != "orchestrator" && "${INIT}" != "builder" ]]; then
	echo "Invalid mode: ${INIT}"
	echo "Usage: $0 <spec.md|\"query with spaces\"> [orchestrator|builder] [iterations]"
	exit 1
fi

# ensure dirs exist
mkdir -p "$(dirname "$STATUS_MD")" "$(dirname "$TASK_MD")" "$(dirname "$STEP_MD")" "$ARCHIVE"

# seed files
echo "starting" >"$STATUS_MD"
: >"$STEP_MD" || true
: >"$PROGRESS_MD" || true

ORCHESTRATOR_INSTRUCTIONS="
@${SPEC_MD} contains the implementation to build.
@${STATUS_MD} contains the current status of the implementation – one of following: starting, planning, building, reviewing, task-complete, spec-complete, bail.
@${TASK_MD} contains the single more important task to complete towards the implementation plan.
@${STEP_MD} contains additional guidance for the builder to complete the task.
@${PROGRESS_MD} contains the progress the builder has made towards implementing the spec.

You are running in FORWARD MODE as the orchestrator.
You will write specs and review work done, but not modify any code.
Your sole responsibility is to assess if a task is completed, what the next task is, or if the implementation is complete.

## Instructions

1) Read @${STATUS_MD} and decide the correct next state.
2) If there is no current task spec in @${TASK_MD} (missing or empty), follow the instructions in the Task section.
3) If there is a current task spec in @${TASK_MD}, follow the instructions in the Step section.

## Task

1) Update ${STATUS_MD} with exactly: planning.
2) Decide the single highest priority task to do next (you choose, not necessarily first in the list) to complete the ${SPEC_MD}.
3) Write a spec for ONLY that one task which the builder will pick up for work, saving the spec to ${TASK_MD}.
4) Optionally write initial guidance to ${STEP_MD}.
5) When the task is ready to be implemented, update ${STATUS_MD} with exactly: building.
6) If the ${SPEC_MD} is sufficiently complete, follow the instruction in the Exit section.

## Step

1) Update ${STATUS_MD} with exactly: reviewing.
2) Read ${TASK_MD}, ${STEP_MD} and ${PROGRESS_MD}, then validate and review the work done to assess the completeness of the ${TASK_MD} spec.
3) If the work requires additional feedback and iteration:
  - Update ${STEP_MD} to guide the builder towards completion of the ${TASK_MD}.
  - Update ${STATUS_MD} with exactly: building.
4) If the ${TASK_MD} is sufficiently complete:
  - Move the ${STEP_MD} to ${ARCHIVE}/$(date +%s)-step.md
  - Move the ${TASK_MD} to ${ARCHIVE}/$(date +%s)-task.md
  - Clear ${STEP_MD} (empty file)
  - Update ${STATUS_MD} with exactly: task-complete

## Exit

1) If the ${SPEC_MD} is complete, update ${STATUS_MD} to contain exactly: spec-complete

If for any reason you need to stop work, you can break-the-glass by updating ${STATUS_MD} with exactly: bail
"

BUILDER_INSTRUCTIONS="
@${TASK_MD}
@${STEP_MD}

You are running in FORWARD MODE as the builder.

1) Update ${STATUS_MD} with exactly: building.
2) Read ${TASK_MD} and ${STEP_MD}.
3) Implement ONLY that one task.
4) Run feedback loops (tests/typecheck/lint/build as defined in @AGENTS.md if present).
5) Append a short entry to ${PROGRESS_MD} describing what you did and what changed.
6) Make a git commit for this one task.
"

orchestrator() {
	echo "=== ORCHESTRATOR START ========================================================"
	echo "==============================================================================="

	codex --yolo exec --skip-git-repo-check "
${ORCHESTRATOR_INSTRUCTIONS}
For your context, we will be instructing the builder with the following:
<BUILDER_INSTRUCTIONS>
${BUILDER_INSTRUCTIONS}
</BUILDER_INSTRUCTIONS>
  "

	status="$(cat "$STATUS_MD" | tr -d '\r\n')"

	if [[ "$status" == "spec-complete" || "$status" == "bail" ]]; then
		echo "=== FORWARD ITERATION $ITER_COUNT${ITERS:+/$ITERS} EXIT (${status}) ==========="
		echo "==============================================================================="
		exit 0
	fi
}

builder() {
	echo "=== BUILDER START =============================================================="
	echo "================================================================================"

	printf "${BUILDER_INSTRUCTIONS}" | claude --dangerously-skip-permissions \
		-p --output-format stream-json --verbose | \
		grep --line-buffered '^{' | \
		bunx repomirror visualize | \
		sed $'s/$/\r/'
}

# testing
# exit 0

ITER_COUNT=1
while true; do
	if [[ -n "${ITERS:-}" && "$ITERS" =~ ^[0-9]+$ && "$ITER_COUNT" -gt "$ITERS" ]]; then
		echo "ITERS threshold ($ITERS) reached. Exiting."
		exit 0
	fi

	echo "=== FORWARD ITERATION $ITER_COUNT${ITERS:+/$ITERS} START ======================"
	echo "==============================================================================="

	# Run orchestrator only when:
	# - init is orchestrator and it's the first iter, OR
	# - it's not the first iter (always orchestrate between builder runs)
	if [[ ("$INIT" == "orchestrator" && "$ITER_COUNT" == 1) || "$ITER_COUNT" -gt 1 ]]; then
		orchestrator
	fi

	builder

	echo "=== FORWARD ITERATION $ITER_COUNT${ITERS:+/$ITERS} COMPLETE ==================="
	echo "==============================================================================="
	ITER_COUNT=$((ITER_COUNT + 1))
done
