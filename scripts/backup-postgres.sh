#!/usr/bin/env sh
set -eu
umask 077

backup_dir=${BACKUP_DIR:-backups}
mkdir -p "$backup_dir"
timestamp=$(date -u +%Y%m%dT%H%M%SZ)
backup_file="$backup_dir/tpt-school-$timestamp.dump"
if [ -e "$backup_file" ]; then
  echo "Backup already exists: $backup_file" >&2
  exit 1
fi

tmp_file=$(mktemp "$backup_dir/.tpt-school-$timestamp.XXXXXX.tmp")
trap 'rm -f "$tmp_file"' EXIT HUP INT TERM

docker compose exec -T db sh -ec 'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$tmp_file"
if [ ! -s "$tmp_file" ]; then
  echo 'Backup is empty.' >&2
  exit 1
fi
docker compose exec -T db pg_restore --list - < "$tmp_file" >/dev/null
mv "$tmp_file" "$backup_file"
trap - EXIT HUP INT TERM
printf 'Backup created: %s\n' "$backup_file"
