# STH Re-platforming Implementation

## 1) Database Schema Refactor
- Prefer **Electron** over Tauri for this codebase because the backend is already Node.js/Express and can be embedded directly without rewriting the API layer in Rust.
- Convert `drizzle/schema.ts` to SQLite by running:
  - `npm run db:migrate:mysql-to-sqlite -- drizzle/schema.ts drizzle/sqlite-schema.ts`
- ETL from production MySQL into local SQLite:
  - `MYSQL_URL='mysql://user:pass@host:3306/db' npm run db:etl:mysql-to-sqlite -- ./local-data`

## 2) Main Process Orchestration Code
- Main process initializes DB, allocates random port in `5000-6000`, starts Express, opens BrowserWindow to local endpoint, and closes DB/server cleanly.

## 3) Build Pipeline Configuration
- `electron-builder.yml` bundles:
  - renderer (`dist/**`)
  - electron/server runtime (`dist-electron/**`)
  - node modules
  - extra resources (`assets/`)
- Runtime data path uses `app.getPath('userData')` and SQLite file `sth.db` is created there at first boot.

## 4) System Integrity
- Boot-time validation in `connection.ts`:
  - checks if `sth.db` exists.
  - if missing, initializes using `server/db/schema.sql` blueprint.
  - verifies required tables exist.
  - seeds theology baseline if empty.
