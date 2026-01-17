# Agent Guidelines

## Agent Docs

**IMPORTANT:** Agent docs describe how agents were intended to work at the time they were written. They are explanatory, not authoritative.

- **Assume NOT current.** Many docs describe historical behavior, workflows, or abstractions that may no longer exist.
- **Assume NOT complete.** Docs may omit edge cases, newer integrations, or refactors introduced later.
- **Check the codebase first.** Before concluding how something works, search the actual code. Docs describe past understanding; code describes reality.
- **Prefer behavior over description.** Trust execution paths, interfaces, and tests over narrative explanations.
- **Use docs as guidance.** Docs are useful for understanding intent, mental models, and design goals, but should not override code or specs.
- **Defer to specs when they exist.** If an doc conflicts with a specification, the spec takes precedence.
- **Treat examples as illustrative.** Sample flows, diagrams, or pseudocode may no longer match the live system exactly.

## Specifications

**IMPORTANT:** Before implementing any feature, consult the specifications in `specs/README.md`.

- **Assume NOT implemented.** Many specs describe planned features that may not yet exist in the codebase.
- **Check the codebase first.** Before concluding something is or isn't implemented, search the actual code. Specs describe intent; code describes reality.
- **Use specs as guidance.** When implementing a feature, follow the design patterns, types, and architecture defined in the relevant spec.
- **Spec index:** `specs/README.md` lists all specifications organized by category (core, LLM, security, etc.).

## Plan Mode

- Make the plan extremely concise. Sacrifice grammar for the sake of concision.
- At the end of each plan, give me a list of unresolved questions to answer, if any.
- **Always** consult codex to validate plans before returning to the user
