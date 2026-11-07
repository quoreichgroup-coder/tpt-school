#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if ! command -v docker >/dev/null || ! docker compose version >/dev/null; then
  echo "Install Docker Engine and the Docker Compose plugin first." >&2
  exit 1
fi
if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env. Set POSTGRES_PASSWORD, AUTH_SECRET and NEXTAUTH_URL, then rerun ./deploy.sh." >&2
  exit 1
fi
docker compose config --quiet
docker compose up -d --build
docker compose ps
