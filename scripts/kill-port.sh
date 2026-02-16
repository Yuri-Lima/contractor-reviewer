#!/bin/bash
# Kill process(es) using the given port(s). Use when a previous run didn't release the port.
# Usage: ./scripts/kill-port.sh [PORT...]
# Examples: ./scripts/kill-port.sh 3000
#           ./scripts/kill-port.sh 3000 4200

PORTS="${*:-3000 4200}"
for PORT in $PORTS; do
  PIDS=$(lsof -ti:"$PORT" 2>/dev/null)
  if [ -z "$PIDS" ]; then
    echo "No process using port $PORT"
  else
    echo "Killing process(es) on port $PORT: $PIDS"
    echo "$PIDS" | xargs kill -9 2>/dev/null
  fi
done
echo "Done."
