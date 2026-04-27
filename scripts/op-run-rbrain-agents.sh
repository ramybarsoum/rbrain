#!/bin/zsh
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <env-file> <command> [args...]" >&2
  exit 64
fi

env_file="$1"
shift

service_name="${RBRAIN_1PASSWORD_KEYCHAIN_SERVICE:-ai.rbrain.1password.service-account}"
account_name="${RBRAIN_1PASSWORD_KEYCHAIN_ACCOUNT:-${USER:-cole}}"

token="$(/usr/bin/security find-generic-password -a "$account_name" -s "$service_name" -w)"
if [[ -z "$token" ]]; then
  echo "Missing 1Password service account token in macOS Keychain: $service_name" >&2
  exit 78
fi

export OP_SERVICE_ACCOUNT_TOKEN="$token"
unset token

if [[ -z "${OP_SOCK:-}" ]]; then
  sock_hash="$(print -r -- "$env_file" | /usr/bin/shasum | /usr/bin/awk '{print $1}')"
  export OP_SOCK="${TMPDIR:-/tmp}/rbrain-op-${USER:-cole}-${sock_hash}.sock"
fi

exec /opt/homebrew/bin/op run --env-file "$env_file" -- /usr/bin/env -u OP_SERVICE_ACCOUNT_TOKEN "$@"
