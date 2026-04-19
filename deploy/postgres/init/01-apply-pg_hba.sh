#!/bin/sh
# Apply production pg_hba.conf after initdb (blocks external scanners)
set -e
cp /mnt/postgres-config/pg_hba.conf "$PGDATA/pg_hba.conf"
