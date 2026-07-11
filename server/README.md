# CalmCarry API

NestJS backend for the CalmCarry sleep/wellness companion app. Implements the
build-plan architecture: auth, entitlement, content catalog, device warranty,
and session logs.

Uses **SQLite** (via TypeORM + `better-sqlite3`) as a local stand-in for the
planned Postgres, so it runs with **zero external setup**. The database file
lives at `data/calmcarry.sqlite` and is created + seeded automatically on first
boot.

## Stack

- **NestJS 10** (modular: `auth`, `users`, `content`, `devices`, `logs`)
- **TypeORM** with the **better-sqlite3** driver
- **@nestjs/jwt** + **bcryptjs** for auth (JWT, 30-day expiry)
- **class-validator** for request validation
- CORS enabled for all origins (the Expo web app runs on `http://localhost:8081`)

## Install

```bash
cd server
npm install
```

## Run

```bash
# production-style (compiles, then runs)
npm run start

# or watch mode for development
npm run start:dev
```

The server listens on **port 4000** → `http://localhost:4000`.

On first boot, if the database is empty it auto-seeds the demo data (see below).
You can also seed manually without starting the HTTP server:

```bash
npm run seed
```

## Accounts

No demo/seed account is created. The server seeds only the content catalogue and
programs; real owners are created via `POST /auth/register` (or a real purchase).
Register a throwaway account to smoke-test authenticated routes locally.

## Endpoints

| Method | Path                  | Auth   | Description |
| ------ | --------------------- | ------ | ----------- |
| GET    | `/health`             | —      | `{ ok: true }` liveness check |
| POST   | `/auth/register`      | —      | `{ email, password, name }` → `{ token, user }` (creates Owner + `free` entitlement) |
| POST   | `/auth/login`         | —      | `{ email, password }` → `{ token, user }` (JWT, 30d) |
| GET    | `/me`                 | Bearer | `{ user, entitlement: { tier, status } }` |
| GET    | `/content`            | —      | `{ tracks: ContentItem[], programs: Program[] }` (public; includes `locked`) |
| GET    | `/devices`            | Bearer | `Device[]` with their warranty claims |
| POST   | `/devices`            | Bearer | `{ serial, purchaseDate?, retailer? }` → `Device` (warranty `active`, 24mo) |
| POST   | `/devices/:id/claims` | Bearer | `{ type, description }` → `WarrantyClaim` (`submitted`, reference `GC-CLM-####`) |
| POST   | `/logs`               | Bearer | `{ contentId?, deviceId? }` → `SessionLog` (write-only; no mood/settle rating) |

Authenticated routes expect an `Authorization: Bearer <token>` header.

## Quick smoke test

```bash
# health
curl -s http://localhost:4000/health

# register a throwaway account (capture token)
TOKEN=$(curl -s -X POST http://localhost:4000/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","password":"testpass123","name":"Test"}' \
  | node -pe 'JSON.parse(require("fs").readFileSync(0)).token')

# current user + entitlement
curl -s http://localhost:4000/me -H "Authorization: Bearer $TOKEN"

# public content catalog
curl -s http://localhost:4000/content

# devices for the demo user
curl -s http://localhost:4000/devices -H "Authorization: Bearer $TOKEN"
```

## Configuration

All values have working defaults; override via environment variables if needed:

| Var             | Default                              |
| --------------- | ------------------------------------ |
| `PORT`          | `4000`                               |
| `JWT_SECRET`    | dev secret (change in production)    |
| `JWT_EXPIRES_IN`| `30d`                                |
| `DB_PATH`       | `data/calmcarry.sqlite`              |

## Notes

- `synchronize: true` is on for local dev (TypeORM auto-creates the schema).
  Switch to migrations before any real deployment.
- The seed runs only when the DB is empty, so restarts are safe.
