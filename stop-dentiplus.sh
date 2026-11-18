#!/bin/bash
set -euo pipefail

ROOT="$(cd -- "$(dirname -- "$0")" && pwd)"
RUN_LOGS="$ROOT/run-logs"

stop_process() {
    local label="$1"
    local pid_file="$2"
    local expected="$3"
    local pid
    local attempt
    local command

    if [[ ! -f "$pid_file" ]]; then
        echo "$label was not tracked as running."
        return
    fi

    pid="$(<"$pid_file")"
    if [[ ! "$pid" =~ ^[0-9]+$ ]] || ! kill -0 "$pid" 2>/dev/null; then
        echo "$label was not running."
        rm -f "$pid_file"
        return
    fi

    command="$(ps -p "$pid" -o command= 2>/dev/null || true)"
    if [[ "$command" != *"$expected"* ]]; then
        echo "$label PID $pid no longer belongs to Dentiplus; leaving it untouched."
        rm -f "$pid_file"
        return
    fi

    kill "$pid"
    for attempt in {1..25}; do
        kill -0 "$pid" 2>/dev/null || break
        sleep 0.2
    done

    if kill -0 "$pid" 2>/dev/null; then
        command="$(ps -p "$pid" -o command= 2>/dev/null || true)"
        if [[ "$command" == *"$expected"* ]]; then
            kill -KILL "$pid"
        fi
    fi

    rm -f "$pid_file"
    echo "$label stopped (PID $pid)."
}

stop_process "Frontend" "$RUN_LOGS/frontend.pid" "$ROOT/frontend/node_modules/vite/bin/vite.js"
stop_process "Backend" "$RUN_LOGS/backend.pid" "$ROOT/backend/public/router.php"
echo "Dentiplus stop routine completed."
