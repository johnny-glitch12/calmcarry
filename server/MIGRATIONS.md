# Database migrations

**Dev (SQLite):** nothing to do. Dev auto-creates the schema (`synchronize: true`).

**Production (Postgres):** the server **never auto-synchronizes** in prod (that can silently
`ALTER`/`DROP` columns on a populated DB). Instead it applies committed migrations on boot
(`migrationsRun`). Migrations are dialect-specific, so the initial one must be generated
against **your real Postgres** (e.g. Neon) - once:

```bash
cd server

# point the CLI at your prod database (do NOT commit this; use your shell/secret manager)
export DATABASE_URL="postgresql://USER:PASS@HOST/DB?sslmode=require"

# 1) generate the initial migration from the current entities
npm run migration:generate -- src/migrations/Init

# 2) (optional) preview / apply locally
npm run migration:show
npm run migration:run

# 3) commit the generated file
git add src/migrations && git commit -m "db: initial migration"
```

On deploy, the server runs pending migrations automatically (`migrationsRun: isProd`).
For later schema changes: edit entities → `npm run migration:generate -- src/migrations/<Name>`
→ commit → deploy.

## Commands
- `npm run migration:generate -- src/migrations/<Name>` - diff entities vs DB → new migration
- `npm run migration:run` - apply pending migrations
- `npm run migration:revert` - roll back the last migration
- `npm run migration:show` - list applied / pending

## First-deploy escape hatch (fresh empty DB only)
`DB_SYNC=true` lets a brand-new empty DB bootstrap its schema via `synchronize` once
(then `migrationsRun` is skipped). Use only on an empty DB; never on one with real data.
Prefer generating the Init migration above.
