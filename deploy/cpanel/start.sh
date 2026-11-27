#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$APP_DIR/run/uvicorn.pid"
LOG_FILE="$APP_DIR/logs/app.log"
VENV_UVICORN="$APP_DIR/.venv/bin/uvicorn"

mkdir -p "$APP_DIR/data" "$APP_DIR/logs" "$APP_DIR/run"

if [[ -f "$APP_DIR/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$APP_DIR/.env"
  set +a
fi

PORT="${PORT:-8055}"

is_running() {
  if [[ -f "$PID_FILE" ]]; then
    local pid
    pid="$(cat "$PID_FILE" 2>/dev/null || true)"
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      if grep -qa "uvicorn" "/proc/$pid/cmdline" 2>/dev/null; then
        return 0
      fi
    fi
  fi
  return 1
}

stop_server() {
  if [[ -f "$PID_FILE" ]]; then
    local pid
    pid="$(cat "$PID_FILE" 2>/dev/null || true)"
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      for _ in $(seq 1 20); do
        if ! kill -0 "$pid" 2>/dev/null; then
          break
        fi
        sleep 0.25
      done
      kill -9 "$pid" 2>/dev/null || true
    fi
    rm -f "$PID_FILE"
  fi
}

if [[ "${1:-}" == "--stop" ]]; then
  stop_server
  exit 0
fi

if [[ "${1:-}" == "--restart" ]]; then
  stop_server
elif is_running; then
  exit 0
fi

# Rotar log si supera 10 MB para cuidar cuota de disco en cPanel
if [[ -f "$LOG_FILE" ]] && [[ "$(wc -c < "$LOG_FILE")" -gt 10485760 ]]; then
  mv -f "$LOG_FILE" "${LOG_FILE}.1"
fi

cd "$APP_DIR"
nohup "$VENV_UVICORN" backend.main:app \
  --host 127.0.0.1 \
  --port "$PORT" \
  --proxy-headers \
  --forwarded-allow-ips="127.0.0.1" \
  </dev/null >>"$LOG_FILE" 2>&1 &

echo $! > "$PID_FILE"
