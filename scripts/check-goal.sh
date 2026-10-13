#!/usr/bin/env bash
set -uo pipefail

repo_root=$(git rev-parse --show-toplevel) || exit 1
cd "$repo_root" || exit 1

usage() {
  printf '使い方: scripts/check-goal.sh [--local]\n' >&2
  exit 2
}

local_only=false
if (($# > 1)); then usage; fi
if (($# == 1)); then
  [[ "$1" == "--local" ]] || usage
  local_only=true
fi

if [[ -f .loop/judge.sha256 ]] && ! sha256sum -c --quiet .loop/judge.sha256; then
  printf '判定ファイルが改変されています\n' >&2
  exit 1
fi

run_step() {
  local step=$1
  shift
  local output status
  output=$(mktemp) || return 1

  if "$@" >"$output" 2>&1; then
    printf '[OK] %s\n' "$step"
    rm -f "$output"
    return 0
  else
    status=$?
    printf '[FAIL] %s\n' "$step"
    tail -n 60 "$output"
    rm -f "$output"
    return "$status"
  fi
}

check_pr_sync() {
  local status pr_info pr_head
  status=$(git status --porcelain --untracked-files=no) || return 1
  if [[ -n "$status" ]]; then
    printf '追跡対象ファイルに未コミットの変更があります\n%s\n' "$status"
    return 1
  fi

  pr_info=$(gh pr view --json number,headRefOid,url 2>/dev/null) || {
    printf '現在のブランチに紐づくPRがありません\n'
    return 1
  }
  pr_number=$(node -e 'process.stdout.write(String(JSON.parse(process.argv[1]).number))' "$pr_info") || return 1
  pr_head=$(node -e 'process.stdout.write(JSON.parse(process.argv[1]).headRefOid)' "$pr_info") || return 1
  head_sha=$(git rev-parse HEAD) || return 1
  if [[ "$pr_head" != "$head_sha" ]]; then
    printf '未pushのコミットがあります\n'
    return 1
  fi
}

check_preview_deployment() {
  local runs run_data status conclusion run_id
  runs=$(gh run list --workflow pages-preview.yml --commit "$head_sha" --json status,conclusion,databaseId --limit 1) || {
    printf 'Pagesプレビューの実行情報を取得できません\n'
    return 1
  }
  run_data=$(node -e 'const rows=JSON.parse(process.argv[1]); if(rows.length){const r=rows[0]; process.stdout.write(`${r.status}\t${r.conclusion ?? ""}\t${r.databaseId}`)}' "$runs") || return 1
  if [[ -z "$run_data" ]]; then
    printf 'プレビューのデプロイ待ち（実行が表示されたら gh run watch <id>）\n'
    return 1
  fi

  IFS=$'\t' read -r status conclusion run_id <<<"$run_data"
  if [[ "$status" != "completed" ]]; then
    printf 'プレビューのデプロイ待ち（gh run watch %s）\n' "$run_id"
    return 1
  fi
  if [[ "$conclusion" != "success" ]]; then
    printf 'Pagesプレビューが成功していません（結論: %s）\n' "$conclusion"
    return 1
  fi
}

run_preview_playwright() {
  local repo_info owner repo
  repo_info=$(gh repo view --json owner,name) || {
    printf 'GitHubリポジトリ情報を取得できません\n'
    return 1
  }
  owner=$(node -e 'process.stdout.write(JSON.parse(process.argv[1]).owner.login.toLowerCase())' "$repo_info") || return 1
  repo=$(node -e 'process.stdout.write(JSON.parse(process.argv[1]).name)' "$repo_info") || return 1
  PREVIEW_URL="https://${owner}.github.io/${repo}/previews/pr-${pr_number}/" npx playwright test e2e/method-comparison.spec.ts
}

run_step 'typecheck' npm run typecheck || exit 1
run_step 'lint' npm run lint || exit 1
run_step 'test:run' npm run test:run -- || exit 1
run_step 'build' npm run build || exit 1

if [[ "$local_only" != true ]]; then
  run_step 'GitとPRの同期' check_pr_sync || exit 1
  run_step 'Pagesプレビュー' check_preview_deployment || exit 1
fi

if [[ "$local_only" == true ]]; then
  run_step 'Playwright' env -u PREVIEW_URL npx playwright test e2e/method-comparison.spec.ts || exit 1
else
  run_step 'Playwright' run_preview_playwright || exit 1
fi

printf '[GOAL MET]\n'
