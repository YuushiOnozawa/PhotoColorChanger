---
name: task-lifecycle
description: >-
  Start and finish PhotoColorChanger tasks with an isolated Git worktree,
  fast-forward main synchronization, linked GitHub issue closeout, and Trello
  MCP card updates. Use for this repository's normal task workflow; skip for
  read-only exploration or unrelated repositories.
---

# Task lifecycle

Use this skill for the project's normal implementation workflow. It has a
start phase and a post-merge closeout phase.

## Start a task

- Inspect the base checkout with `git status --short --branch` and preserve any
  unrelated changes; do not stash or discard them.
- Keep the base checkout on `main`. Fetch `origin/main` and fast-forward the
  base checkout only; do not force-update or rewrite history.
- Create a new topic branch and worktree from `origin/main`, using a branch
  name such as `feat/<slug>` or `chore/<slug>`.
- Stop if the proposed worktree path or branch already exists instead of
  reusing it silently.
- Make all task changes in the new worktree. Keep the base checkout clean.

## Close out a merged task

Run this phase only after the pull request has been merged.

- Verify the merged pull request, then fetch `origin/main` and fast-forward the
  base checkout.
- Before any external write, verify Trello authentication with
  `trelloReadMember({ action: "get_me" })` on every run. If it fails, stop and
  tell the user to run `codex mcp login trello`.
- Close a GitHub Issue only when it is explicitly linked by the pull request
  or provided by the user, and only when it is still open. Never infer an
  issue from a vague title match.
- Update Trello through the Trello MCP server. Prefer an explicit card ID;
  otherwise search by the user-provided card name or task identifier. If zero
  or multiple cards match, stop and report the ambiguity instead of guessing.
- Remove the merged task worktree and local topic branch only after the
  worktree is clean and the branch is confirmed merged.
- Report the result of main synchronization, Issue handling, Trello handling,
  and cleanup separately, including any item left pending.

Do not store Trello credentials or board/card identifiers in this skill.
