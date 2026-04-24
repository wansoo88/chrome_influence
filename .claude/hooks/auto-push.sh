#!/usr/bin/env bash
# Auto-push hook: git commit 성공 시 자동으로 git push origin HEAD 실행.
# Claude Code PostToolUse(matcher=Bash)에서 호출.
#
# stdin에 tool use 컨텍스트 JSON 전달 — tool_input.command에 "git commit"이 포함되고
# tool_response.exit_code가 0일 때만 push 실행.
#
# Windows Git Bash 환경 가정. jq 있으면 사용, 없으면 sed 폴백.

set -u

payload="$(cat)"

extract() {
  local path="$1"
  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$payload" | jq -r "$path // empty" 2>/dev/null
  else
    case "$path" in
      ".tool_input.command")
        printf '%s' "$payload" | sed -n 's/.*"command"[[:space:]]*:[[:space:]]*"\(.*\)".*/\1/p' | head -1
        ;;
      ".tool_response.exit_code")
        printf '%s' "$payload" | sed -n 's/.*"exit_code"[[:space:]]*:[[:space:]]*\([0-9]*\).*/\1/p' | head -1
        ;;
    esac
  fi
}

command="$(extract '.tool_input.command')"
exit_code="$(extract '.tool_response.exit_code')"

case "$command" in
  *"git commit"*)
    if [ "${exit_code:-1}" = "0" ]; then
      project_dir="${CLAUDE_PROJECT_DIR:-$(pwd)}"
      cd "$project_dir" || exit 0
      if git remote get-url origin >/dev/null 2>&1; then
        git push origin HEAD 2>&1 | sed 's/^/[auto-push] /'
      fi
    fi
    ;;
esac

exit 0
