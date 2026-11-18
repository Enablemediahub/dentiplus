#!/bin/bash
set -euo pipefail

ROOT="$(cd -- "$(dirname -- "$0")" && pwd)"
FRONTEND_ROOT="$ROOT/frontend"
RUN_LOGS="$ROOT/run-logs"
FRONTEND_PID_FILE="$RUN_LOGS/frontend.pid"
BACKEND_PID_FILE="$RUN_LOGS/backend.pid"
VITE_CLI="$FRONTEND_ROOT/node_modules/vite/bin/vite.js"
ROUTER="$ROOT/backend/public/router.php"
NODE="$(command -v node || true)"
PHP="$(command -v php || true)"

if [[ -z "$NODE" ]]; then
    for candidate in /opt/homebrew/bin/node /usr/local/bin/node "$HOME/.volta/bin/node" "$HOME/.asdf/shims/node"; do
        if [[ -x "$candidate" ]]; then
            NODE="$candidate"
            break
        fi
    done
fi

if [[ -z "$NODE" ]]; then
    NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
    if [[ -s "$NVM_DIR/nvm.sh" ]]; then
        . "$NVM_DIR/nvm.sh"
        if nvm use --silent default >/dev/null 2>&1; then
            NODE="$(command -v node || true)"
        fi
    fi
fi

if [[ -z "$NODE" ]]; then
    echo "Node.js was not found. Install it with 'brew install node', then open a new Terminal and retry." >&2
    exit 1
fi

if [[ -z "$PHP" ]]; then
    for candidate in /opt/homebrew/bin/php /usr/local/bin/php "$HOME/.config/herd/bin/php" "$HOME/Library/Application Support/Herd/bin/php"; do
        if [[ -x "$candidate" ]]; then
            PHP="$candidate"
            break
        fi
    done
fi

if [[ -z "$PHP" ]]; then
    echo "PHP was not found. Make your PHP CLI available on PATH or install PHP." >&2
    exit 1
fi

if [[ ! -f "$VITE_CLI" ]]; then
    echo "Vite was not found at $VITE_CLI. Run 'npm install' inside frontend first." >&2
    exit 1
fi

mkdir -p "$RUN_LOGS"

process_matches() {
    local pid="$1"
    local expected="$2"
    local command

    [[ "$pid" =~ ^[0-9]+$ ]] || return 1
    kill -0 "$pid" 2>/dev/null || return 1
    command="$(ps -p "$pid" -o command= 2>/dev/null)" || return 1
    [[ "$command" == *"$expected"* ]]
}

frontend_pid=""
backend_pid=""
if [[ -f "$FRONTEND_PID_FILE" ]]; then
    frontend_pid="$(<"$FRONTEND_PID_FILE")"
fi
if [[ -f "$BACKEND_PID_FILE" ]]; then
    backend_pid="$(<"$BACKEND_PID_FILE")"
fi

frontend_running=false
backend_running=false
process_matches "$frontend_pid" "$VITE_CLI" && frontend_running=true
process_matches "$backend_pid" "$ROUTER" && backend_running=true

if [[ "$frontend_running" == true || "$backend_running" == true ]]; then
    echo "Dentiplus servers are already running or partially running."
    [[ "$frontend_running" == true ]] && echo "Frontend: http://localhost:5176 (PID $frontend_pid)"
    [[ "$backend_running" == true ]] && echo "Backend:  http://127.0.0.1:8000/api/v1 (PID $backend_pid)"
    echo "Run 'bash ./stop-dentiplus.sh' before starting again."
    exit 1
fi

rm -f "$FRONTEND_PID_FILE" "$BACKEND_PID_FILE"

nohup "$NODE" "$VITE_CLI" "$FRONTEND_ROOT" --host 0.0.0.0 --port 5176 --strictPort \
    >"$RUN_LOGS/frontend.out.log" 2>"$RUN_LOGS/frontend.err.log" \
    </dev/null &
frontend_pid=$!
printf '%s\n' "$frontend_pid" >"$FRONTEND_PID_FILE"

nohup "$PHP" -S 127.0.0.1:8000 -t "$ROOT/backend/public" "$ROUTER" \
    >"$RUN_LOGS/backend.out.log" 2>"$RUN_LOGS/backend.err.log" \
    </dev/null &
backend_pid=$!
printf '%s\n' "$backend_pid" >"$BACKEND_PID_FILE"

sleep 1
if ! process_matches "$frontend_pid" "$VITE_CLI" || ! process_matches "$backend_pid" "$ROUTER"; then
    process_matches "$frontend_pid" "$VITE_CLI" && kill "$frontend_pid" 2>/dev/null || true
    process_matches "$backend_pid" "$ROUTER" && kill "$backend_pid" 2>/dev/null || true
    rm -f "$FRONTEND_PID_FILE" "$BACKEND_PID_FILE"
    echo "One or more Dentiplus servers failed to start. Check logs in $RUN_LOGS." >&2
    exit 1
fi

echo "Dentiplus servers started."
echo "Frontend: http://localhost:5176"
echo "Backend:  http://127.0.0.1:8000/api/v1"
echo "Logs: $RUN_LOGS"
