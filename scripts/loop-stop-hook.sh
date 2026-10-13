#!/usr/bin/env bash
set -uo pipefail

cat >/dev/null || true
repo_root=$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel) || exit 1
cd "$repo_root" || exit 1

if [[ -e .loop/escalate ]]; then
  rm -f .loop/active
  exit 0
fi
if [[ ! -e .loop/active ]]; then exit 0; fi

count=0
max=40
if [[ -f .loop/stop-count ]]; then
  count=$(<.loop/stop-count)
  [[ "$count" =~ ^[0-9]+$ ]] || count=0
fi
if [[ -f .loop/max-blocks ]]; then
  max=$(<.loop/max-blocks)
  [[ "$max" =~ ^[0-9]+$ ]] || max=40
fi
count=$((10#$count))
max=$((10#$max))

if ((count >= max)); then
  printf '反復上限の%d回に達したため停止しました。ユーザーに確認してください。\n' "$max" > .loop/escalate
  rm -f .loop/active
  printf '反復上限に達しました。ユーザーに確認してください。\n' >&2
  exit 0
fi

check_status=0
if [[ -f .loop/local-only ]]; then
  scripts/check-goal.sh --local >.loop/last-check.log 2>&1 || check_status=$?
else
  scripts/check-goal.sh >.loop/last-check.log 2>&1 || check_status=$?
fi
if ((check_status == 0)); then
  rm -f .loop/active
  exit 0
fi

count=$((count + 1))
printf '%d\n' "$count" > .loop/stop-count
tail -n 40 .loop/last-check.log | LOOP_COUNT="$count" LOOP_MAX="$max" node -e '
let output = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => { output += chunk; });
process.stdin.on("end", () => {
  if (output.endsWith("\n")) output = output.slice(0, -1);
  const prompt = `\n\n(反復 ${process.env.LOOP_COUNT}/${process.env.LOOP_MAX}) docs/method-comparison/PROGRESS.md を更新し、次の作業へ進んでください。エスカレーション条件に該当する場合は .loop/escalate に理由を書いて停止してください。`;
  process.stdout.write(`${JSON.stringify({ decision: "block", reason: output + prompt })}\n`);
});
'
