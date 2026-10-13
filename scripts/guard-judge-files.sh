#!/usr/bin/env bash
# PreToolUse hook: ループ中に判定ファイルの編集を拒否する
set -uo pipefail
input=$(cat)
path=$(printf '%s' "$input" | node -e 'let s="";process.stdin.on("data",c=>s+=c).on("end",()=>{const i=JSON.parse(s).tool_input??{};process.stdout.write(i.file_path??i.notebook_path??"")})')
case "$path" in
  */e2e/method-comparison.spec.ts|*/scripts/check-goal.sh|*/scripts/loop-stop-hook.sh|*/scripts/guard-judge-files.sh|*/docs/method-comparison/GOAL.md|*/playwright.config.ts|*/.loop/judge.sha256)
    printf '判定ファイル（%s）は変更できません。変更が必要ならユーザーに確認してください。\n' "$path" >&2
    exit 2
    ;;
esac
exit 0
