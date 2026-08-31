---
name: git-delivery
description: Create a safe local Git commit for this project. Use when the user asks to commit, stage, split, or write a commit message. Enforce topic-branch-only commits, Conventional Commits, and Japanese commit subjects and bodies. Do not push, create pull requests, merge, or change branches.
---

# Git delivery

Create one or more focused local commits while protecting `main` and preserving unrelated work.

## Hard boundaries

- Commit only on a topic branch. If the current branch is `main` or `master`, stop and report that a topic branch is required; do not create or switch branches automatically.
- This skill stops after `git commit`. Never run `git push`, `gh`, pull-request commands, merge commands, or release commands.
- Never use `git reset --hard`, `git clean`, force operations, or history-rewriting commands unless the user explicitly requests that separate action.
- Do not discard, stash, unstage, or overwrite unrelated user changes.

## Workflow

1. Read the repository instructions, then run:
   - `git status --short --branch`
   - `git branch --show-current`
   - `git diff --stat`
   - `git diff --cached --stat`
2. Refuse to continue on `main`/`master`. Confirm that the requested files and commit scope are clear; ask before committing mixed or unrelated changes.
3. Inspect the relevant unstaged and staged diffs. Check for secrets, credentials, private paths, generated files, and accidental debug output. Preserve existing intentional staging.
4. Choose focused commit boundaries. Stage only approved paths or hunks; never use `git add .` or `git add -A`.
   - If the user says to commit only already-staged changes, do not stage anything else; commit exactly the current index contents.
5. Run the smallest meaningful repository checks available. Always run `git diff --cached --check`; run the project’s documented lint, typecheck, test, or build command when applicable.
6. Write a Conventional Commit:
   - Format: `type(scope): 日本語の要約`
   - Use a canonical lowercase type such as `feat`, `fix`, `docs`, `refactor`, `test`, `build`, `ci`, `chore`, or `perf`.
   - Keep the subject concise and imperative. Write the optional body in Japanese, explaining what changed and why; keep code identifiers and paths canonical.
7. Run `git commit` with the approved message. If hooks fail, report the failure and do not bypass them.
8. Verify with `git status --short --branch` and `git show --stat --oneline --decorate HEAD`.

## Deliverable

Report the commit hash and message, files included, checks run and their result, and the remaining working-tree state. Explicitly state that push and PR creation were not performed.
