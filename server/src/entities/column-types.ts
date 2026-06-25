// Cross-dialect column types. SQLite (dev) uses 'datetime'; Postgres (prod) uses
// 'timestamp'. Chosen by whether a Postgres DATABASE_URL is configured. load-env
// runs before entities are imported (in both main.ts and data-source.ts), so
// process.env is populated by the time this evaluates.
export const TIMESTAMP_TYPE: 'timestamp' | 'datetime' = process.env.DATABASE_URL ? 'timestamp' : 'datetime';
