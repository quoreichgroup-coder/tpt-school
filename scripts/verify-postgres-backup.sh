#!/usr/bin/env sh
set -eu
umask 077

if [ "$#" -ne 1 ] || [ ! -f "$1" ]; then
  echo "Usage: $0 path/to/postgres-backup.dump" >&2
  exit 2
fi

backup_file=$(realpath "$1")
restore_db="qschool_restore_verify_$(date -u +%Y%m%d%H%M%S)_$$"
created=0

cleanup() {
  if [ "$created" -eq 1 ]; then
    docker compose exec -T db sh -ec 'PGPASSWORD="$POSTGRES_PASSWORD" dropdb --if-exists -U "$POSTGRES_USER" "$1"' sh "$restore_db" >/dev/null || {
      echo "Warning: could not remove temporary database $restore_db" >&2
    }
  fi
}
trap cleanup EXIT
trap 'exit 1' HUP INT TERM

docker compose exec -T db pg_restore --list < "$backup_file" >/dev/null
docker compose exec -T db sh -ec 'PGPASSWORD="$POSTGRES_PASSWORD" createdb -U "$POSTGRES_USER" "$1"' sh "$restore_db"
created=1
docker compose exec -T db sh -ec 'PGPASSWORD="$POSTGRES_PASSWORD" pg_restore --single-transaction --exit-on-error --no-owner --no-privileges -U "$POSTGRES_USER" -d "$1"' sh "$restore_db" < "$backup_file"

check_sql="SELECT (to_regclass('public.\"User\"') IS NOT NULL AND to_regclass('public.\"SchoolSettings\"') IS NOT NULL AND to_regclass('public.\"_prisma_migrations\"') IS NOT NULL)::text"
result=$(docker compose exec -T -e Q_SCHOOL_CHECK_SQL="$check_sql" db sh -ec 'PGPASSWORD="$POSTGRES_PASSWORD" psql -U "$POSTGRES_USER" -d "$1" -Atqc "$Q_SCHOOL_CHECK_SQL"' sh "$restore_db" | tr -d '\r')
if [ "$result" != 'true' ]; then
  echo 'Restored database is missing one or more required QSCHOOL tables.' >&2
  exit 1
fi

printf 'Backup restored and validated successfully in temporary database %s.\n' "$restore_db"
