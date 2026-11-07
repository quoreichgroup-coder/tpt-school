# QSCHOOL

QSCHOOL is a school management application: students, classes, attendance, grades, communication
and finance. Built with Next.js 16, React 19, TypeScript, Prisma 7 and PostgreSQL.
Authentication currently uses custom database sessions and bcrypt.

## Docker development

Install Docker Engine/Desktop with Docker Compose v2 or newer.

```bash
cp .env.example .env
openssl rand -hex 32  # POSTGRES_PASSWORD
openssl rand -hex 32  # AUTH_SECRET (use a different value)
```

Fill both variables in `.env`. Use a hexadecimal database password to avoid URL
escaping issues. Keep `AUTH_SECRET` stable: it also protects stored credentials.

```bash
docker compose -f compose.yaml -f compose.dev.yaml up --build
```

Open http://localhost:3000/setup to create the school and its first administrator.
Source changes in `src/` reload automatically. The development container mounts the
current Prisma schema and PostgreSQL migration history, and generates its client into
a private Docker volume at startup.
After changing `prisma/schema.prisma`, restart `web` to regenerate its container client
and run `npm run db:generate` on the host for local type-checking. Rebuild after changing
dependencies. The development override exposes PostgreSQL only on `127.0.0.1:5432`;
change `POSTGRES_PORT` if necessary.

To run Next.js directly on the host (Node.js 22.12+):

```bash
docker compose -f compose.yaml -f compose.dev.yaml up -d db
npm ci
# Set DATABASE_URL in .env with your database password and localhost port.
npm run db:generate
npm run db:migrate
npm run dev
```

## Mobile app

Install dependencies once from the repository root (`npm ci`); `apps/mobile` is an npm
workspace and shares the root React installation. Copy
`apps/mobile/.env.example` to `apps/mobile/.env` and set `EXPO_PUBLIC_API_URL` to the
reachable web API URL, then run `npm run mobile:start`.
Use `npm run mobile:android` or `npm run mobile:ios` to launch on a connected emulator.
Cloud EAS builds use `apps/mobile/eas.json` and require an Expo account. Create an
Android APK with `npx eas-cli build --platform android --profile preview` or an iOS
Simulator build with `npx eas-cli build --platform ios --profile simulator`. Installing
an iOS build on a physical iPhone requires Apple Developer signing credentials and a
registered test device; the `preview` profile is configured for ad hoc IPA distribution.
The app icon sources live in `apps/mobile/assets/qschool-*.svg`; regenerate platform
icons with `npm run mobile:icons`.

## Production deployment

Set `.env` secrets and `NEXTAUTH_URL=https://school.example.com`, then run:

```bash
docker compose up -d --build
# Equivalent helper:
./deploy.sh
```

The `db` service stores PostgreSQL data in a named volume. `migrate` applies the
PostgreSQL migrations once and must succeed before `web` starts. The web image
runs Next.js standalone as a non-root user. PostgreSQL has no published port in
this configuration. `/api/health` checks database connectivity without login.

Place an HTTPS reverse proxy in front of `127.0.0.1:3000`. Production session
cookies require HTTPS; use the development command for local HTTP testing.
`BIND_ADDRESS` and `PORT` control the web port binding. For a reverse proxy in
another container, configure a shared Docker network explicitly.

```bash
docker compose ps
docker compose logs --tail=100 web migrate
docker compose down  # Preserves the database volume
```

Do not use `down -v` unless you intend to delete the database.

## Backups and existing SQLite data

```bash
sh scripts/backup-postgres.sh
sh scripts/verify-postgres-backup.sh backups/tpt-school-YYYYMMDDTHHMMSSZ.dump
```

The backup command writes a mode-600 custom-format dump atomically and validates
its archive before publishing the filename. The verification command restores
it into a generated temporary database on the Compose PostgreSQL service,
checks the QSCHOOL tables, and drops the temporary database when it exits.
Keep dated backups outside the server. A Docker volume is not a backup.

New Compose volumes still start as an empty PostgreSQL database; initialization
does not import legacy data automatically. The existing `dev.db` was migrated
manually into the current local Compose database on 2026-11-05; see the
[SQLite inventory and migration report](docs/sqlite-inventory.md). The SQLite
source and its original migrations in `prisma/migrations/` remain preserved as
legacy material. Active migrations are in `prisma/migrations-postgresql/`.
For a different source/target pair, use `scripts/migrate-sqlite-to-postgres.py`
with a fresh target, verified backups, and a passing dry-run. Do not apply
SQLite SQL to PostgreSQL or point this version at a SQLite URL.

The existing Electron launcher now inherits `DATABASE_URL` and needs access to
PostgreSQL; standalone offline desktop distribution is not provided by this setup.
The Expo application and role-scoped mobile API are in `apps/mobile` and `src/app/api/v1`.
See `docs/mobile-api.md` for mobile auth, permissions, request bodies, and response
scope; `docs/plan-developpement-qschool.md` tracks delivered work and next phases.

## Commands and design system

- `npm run build`: production build with webpack for the existing PWA plugin.
- `npm start`: run a local production build.
- `npm run lint`: ESLint.
- `npm run test:e2e`: Playwright; requires `E2E_DATABASE_URL` for a dedicated local PostgreSQL database whose name contains `e2e` or `test`. The runner applies migrations there, uses port 3100 by default, and refuses remote databases or a reused server. For example, create `tpt_school_e2e` in local Compose and run `E2E_DATABASE_URL=postgresql://tpt:<password>@localhost:5432/tpt_school_e2e npm run test:e2e`.
- `npm run db:seed`: optional demo data with known demo passwords; development only.

See [the design system](docs/design-system.md) derived from `charte graphique.pdf`:
blue `#0062DB`, orange `#FF8A51`, Montserrat and Playfair Display. Fonts are bundled
locally. Shared design tokens are in `src/design-system/tokens.json`.

## License

[MIT](LICENSE)
