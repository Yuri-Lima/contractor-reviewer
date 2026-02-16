#!/bin/sh
# Migrate and start — runs DB migrations then starts the API server.
# Used as API container entrypoint. Worker uses: command: ["node", "dist/worker.js"]

set -e

echo "Running database migrations..."
node dist/run-migration.js

echo "Starting API server..."
exec node dist/main.js
