#!/usr/bin/env bash
#
# Build a throwaway database, apply the schema, and run every assertion.
# Requires a local PostgreSQL. Override the connection with PGHOST/PGPORT/PGUSER.
set -euo pipefail

DB="${WHRD_TEST_DB:-whrd_schema_test}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/supabase"
export PGOPTIONS='-c client_min_messages=warning'

psql -q -c "drop database if exists $DB;" -c "create database $DB;" postgres

run() {
  printf '  %-34s' "$(basename "$1")"
  if psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$1" > /tmp/whrd-db-test.log 2>&1; then
    echo "ok"
  else
    echo "FAILED"
    grep -v '^NOTICE' /tmp/whrd-db-test.log | head -20
    exit 1
  fi
}

# The Supabase SQL editor wraps a pasted script in ONE transaction, and psql
# does not unless told to. That difference hides a whole class of bug -- most
# painfully `ALTER TYPE ... ADD VALUE`, whose new value PostgreSQL refuses to
# let the same transaction use. So the script is proved both ways: statement by
# statement, and as a single transaction the way an operator will actually run
# it.
run_txn() {
  printf '  %-34s' "$(basename "$1") (one transaction)"
  if psql -q -1 -v ON_ERROR_STOP=1 -d "$DB" -f "$1" > /tmp/whrd-db-test.log 2>&1; then
    echo "ok"
  else
    echo "FAILED"
    grep -v '^NOTICE' /tmp/whrd-db-test.log | head -20
    exit 1
  fi
}

echo "Schema:"
run "$DIR/tests/00_supabase_shim.sql"
run_txn "$DIR/install.sql"   # exactly how the Supabase SQL editor runs it
run "$DIR/install.sql"       # again: the whole script must be idempotent
run_txn "$DIR/install.sql"   # and again, in one transaction, because twice is not a pattern

echo "Assertions:"
# The assertion files change state as they go (they delete and purge rows), so
# each one runs exactly once. psql's status is read from PIPESTATUS rather than
# by re-running, which would fail against the state the first run left behind.
for f in "$DIR"/tests/[0-9][0-9]_*.sql; do
  # 00 is the Supabase shim, applied above; everything else is assertions.
  case "$(basename "$f")" in 00_*) continue ;; esac
  printf '  %s\n' "$(basename "$f")"
  set +e
  psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$f" 2>&1 \
    | sed -e 's/^psql[^ ]* NOTICE:  /    /' -e 's/^NOTICE:  /    /' \
    | grep -v '^$'
  status=${PIPESTATUS[0]}
  set -e
  if [ "$status" -ne 0 ]; then
    echo "    FAILED in $(basename "$f")"
    exit 1
  fi
done

echo
echo "All database tests passed."
