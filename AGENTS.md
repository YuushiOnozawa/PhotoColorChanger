# Agent working agreement

## Subagent delegation and cost control

- Delegate independent, mechanically verifiable work that does not require product, architecture, or policy judgment to subagents by default. This includes research, search, repository mapping, test execution, static checks, log collection, and diff inspection.
- Prefer the least expensive model and reasoning level that can complete the delegated task reliably. Use parallel subagents only for genuinely independent work.
- Give each subagent a bounded objective, the minimum necessary context, an explicit read/write scope, and a required output format. Default to read-only work unless an isolated edit is explicitly assigned.
- Keep requirements interpretation, prioritization, architecture and product decisions, conflict resolution, final integration, and user agreement with the main agent.
- Treat subagent output as evidence, not as the final decision. The main agent must review relevant evidence and remains accountable for the result.
- Do not delegate destructive actions, external publication or messaging, secret handling, or implementation based on ambiguous requirements without explicit authorization and appropriate safeguards.
- The main agent may perform a trivial task directly when delegation overhead would exceed the work or when the task depends heavily on context that cannot be safely isolated.

## Language policy

- Write user-facing content in Japanese by default. This includes the README, product specifications, UX and acceptance documents, UI labels, error messages, help text, release notes, and other documents intended for users or human reviewers.
- English is allowed for AI-only instructions and machine-facing content, including `AGENTS.md`, `SKILL.md`, internal prompts, configuration keys, code identifiers, and tool command syntax.
- Keep code, API names, file paths, and third-party proper names in their canonical form; explain them in Japanese when they appear in user-facing documents.
- When a document serves both audiences, separate the Japanese user-facing section from the English AI-only instructions instead of mixing them without a reason.
- Follow an explicit language request from the user over this default.

## Branch and merge policy

- The current bootstrap may be committed to `main` once as the repository baseline.
- After the bootstrap commit, do not commit directly to `main`.
- Create a topic branch for every subsequent change; keep `main` aligned with its remote tracking branch.
- Changes intended for `main` must be merged through a pull request after the required checks and review.
- Never force-push `main` or rewrite its shared history.
- Before branching, committing, or opening a pull request, inspect the working tree and preserve unrelated changes.
- Keep commits focused and describe the relevant checks in the pull request.
