#!/bin/sh
set -e
# Migrations run in the separate Compose migrate service.
: "${DATABASE_URL:?DATABASE_URL is required}"
: "${AUTH_SECRET:?AUTH_SECRET is required}"
exec node server.js
