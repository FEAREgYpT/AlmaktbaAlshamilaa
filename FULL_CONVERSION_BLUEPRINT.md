# Full Conversion Blueprint: **The Sovereign Theology Hub (STH)** → Offline Windows `.exe`

## 0) Target End-State (Recommended)

- **Desktop shell**: Electron (best fit for Node.js + Drizzle + React/Next-style UI).
- **Embedded database**: SQLite (`data/sth.db`) managed with Drizzle ORM.
- **Local assets**: user-writable media folder (`%APPDATA%/STH/media`) plus optional read-only seed assets bundled with app.
- **Runtime model**:
  1. Electron **main process** starts.
  2. Initializes writable folders + SQLite DB.
  3. Runs Drizzle migrations and optional first-run data import.
  4. Starts internal API server (`127.0.0.1:<dynamic_port>`).
  5. Opens BrowserWindow to local server UI.
- **Output**: signed NSIS installer generating Windows app; optional portable build. (A strict *single-file* `.exe` is possible but not ideal for updates/assets. Prefer installer + app folder.)

---

## 1) Architecture Migration (MySQL → Embedded SQLite)

## 1.1 Driver Strategy in Drizzle

Maintain one schema definition and switch driver by environment:

```ts
// src/db/client.ts
import { drizzle as drizzleMysql } from 'drizzle-orm/mysql2';
import { drizzle as drizzleSqlite } from 'drizzle-orm/better-sqlite3';
import mysql from 'mysql2/promise';
import Database from 'better-sqlite3';

export async function createDbClient() {
  if (process.env.SOURCE_DB === 'mysql') {
    const pool = mysql.createPool({ uri: process.env.MYSQL_URL! });
    return drizzleMysql(pool);
  }

  const sqlite = new Database(process.env.SQLITE_PATH!, {
    fileMustExist: false,
  });
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  return drizzleSqlite(sqlite);
}
```

Recommended packages:

- `drizzle-orm`
- `drizzle-kit`
- `better-sqlite3`
- `mysql2` (for one-time export tooling or dual runtime during migration)

## 1.2 Schema Portability Guidance

MySQL and SQLite differences to resolve in Drizzle schema:

- `AUTO_INCREMENT` → SQLite `integer primary key`.
- `datetime/timestamp` defaults: normalize to explicit app-side timestamps where possible.
- `json` columns: SQLite stores as `text` (serialize/deserialize in app layer).
- Enum types: use text + TypeScript union validations.
- Unsigned numeric assumptions: enforce in app constraints.

Generate SQLite migrations from Drizzle schema:

```bash
npx drizzle-kit generate --config=drizzle.sqlite.config.ts
npx drizzle-kit migrate --config=drizzle.sqlite.config.ts
```

Example config:

```ts
// drizzle.sqlite.config.ts
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema.ts',
  out: './drizzle/sqlite',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.SQLITE_PATH || './data/sth.db',
  },
} satisfies Config;
```

## 1.3 Production Data Migration Strategy

Do migration as **ETL** (Extract/Transform/Load), not raw SQL dump replay.

### Phase A – Extract

- Read MySQL data by table in deterministic order (parents before children).
- Export each table to JSON/NDJSON/CSV snapshots with checksum.

```ts
// scripts/export-mysql.ts (concept)
for (const table of orderedTables) {
  const rows = await mysql.query(`SELECT * FROM ${table} ORDER BY id ASC`);
  fs.writeFileSync(`./export/${table}.json`, JSON.stringify(rows));
}
```

### Phase B – Transform

- Normalize date strings (`UTC ISO 8601`).
- Convert numeric booleans (`0/1`) to booleans if your app expects boolean.
- Flatten/serialize JSON columns.

### Phase C – Load into SQLite

- Run SQLite migrations first.
- Insert within transactions per table batch.
- Rebuild indexes after bulk load (optional speed-up).

```ts
// scripts/import-sqlite.ts (concept)
const db = new Database('./data/sth.db');
const insert = db.prepare('INSERT INTO chapters (id, title, body) VALUES (?, ?, ?)');
const tx = db.transaction((rows) => {
  for (const r of rows) insert.run(r.id, r.title, r.body);
});
tx(rows);
```

### Phase D – Verify

- row-count parity per table
- random row hash comparisons
- referential integrity checks
- smoke tests from app API endpoints

---

## 2) Application Packaging (Runtime + UI + Assets)

## 2.1 Framework Recommendation

### Choose **Electron** for this project

Why:

- Native Node.js runtime support (no rewrite of backend logic).
- Mature packaging ecosystem (`electron-builder`).
- Easy orchestration of embedded API server + BrowserWindow.
- Strong Windows support (installer, updates, code signing).

When Tauri is better: if you want smaller binary and are willing to move backend orchestration into Rust or sidecar complexities. For current stack, Electron is lower-risk.

## 2.2 Bundling Strategy

Use two bundles:

- **Main process** (Electron startup + internal server manager)
- **Renderer** (React/Next/Vite front-end)

Typical tools:

- `electron`
- `electron-builder`
- `esbuild` or `tsup` for main/preload
- `vite` (or next export/serve model) for renderer
- `concurrently`, `wait-on`, `cross-env` for scripts

`package.json` snippet:

```json
{
  "main": "dist-electron/main.js",
  "scripts": {
    "dev": "concurrently \"vite\" \"npm:dev:electron\"",
    "dev:electron": "wait-on tcp:5173 && cross-env DEV_SERVER_URL=http://localhost:5173 electron .",
    "build:renderer": "vite build",
    "build:main": "esbuild electron/main.ts --bundle --platform=node --external:electron --outfile=dist-electron/main.js",
    "build": "npm run build:renderer && npm run build:main",
    "dist:win": "npm run build && electron-builder --win nsis"
  }
}
```

## 2.3 Asset Handling (Images/Videos)

Do **not** rely on writing inside `app.asar` (read-only).

Design:

- Bundled read-only assets: `resources/seed-media` via `extraResources`.
- User-generated/imported assets: `%APPDATA%/STH/media`.
- Store asset metadata in SQLite using relative keys; resolve absolute paths at runtime.

Electron Builder config sample:

```yaml
# electron-builder.yml
appId: com.sth.desktop
productName: Sovereign Theology Hub
files:
  - dist/**
  - dist-electron/**
extraResources:
  - from: media-seed
    to: seed-media
asar: true
win:
  target:
    - nsis
```

Path resolution bridge:

```ts
// electron/path-service.ts
import path from 'node:path';
import { app } from 'electron';

export function getMediaRoot() {
  return path.join(app.getPath('appData'), 'STH', 'media');
}

export function resolveMedia(relative: string) {
  return path.join(getMediaRoot(), relative);
}
```

---

## 3) Execution Flow (Entrypoint/Main Process Design)

```ts
// electron/main.ts
import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { startInternalServer } from './server-bootstrap';
import { runMigrations, seedIfEmpty } from './db-bootstrap';

let mainWindow: BrowserWindow | null = null;

async function bootstrap() {
  const appData = path.join(app.getPath('appData'), 'STH');
  const dbDir = path.join(appData, 'data');
  const mediaDir = path.join(appData, 'media');

  fs.mkdirSync(dbDir, { recursive: true });
  fs.mkdirSync(mediaDir, { recursive: true });

  const sqlitePath = path.join(dbDir, 'sth.db');
  process.env.SQLITE_PATH = sqlitePath;

  await runMigrations(sqlitePath);
  await seedIfEmpty(sqlitePath);

  const { port, stop } = await startInternalServer({
    dbPath: sqlitePath,
    mediaDir,
    host: '127.0.0.1',
    port: 0
  });

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  await mainWindow.loadURL(`http://127.0.0.1:${port}`);

  app.on('before-quit', async () => {
    await stop();
  });
}

app.whenReady().then(bootstrap);
```

Internal server bootstrap:

```ts
// electron/server-bootstrap.ts
import express from 'express';
import http from 'node:http';

export async function startInternalServer(opts: {
  dbPath: string;
  mediaDir: string;
  host: string;
  port: number;
}) {
  const app = express();

  // Inject db + media services here
  app.get('/health', (_req, res) => res.json({ ok: true }));

  // Secure static local media serving
  app.use('/media', express.static(opts.mediaDir, {
    fallthrough: false,
    index: false,
    etag: true,
    maxAge: '7d'
  }));

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(opts.port, opts.host, resolve));

  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : opts.port;

  return {
    port,
    stop: () => new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())))
  };
}
```

Preload bridge example:

```ts
// electron/preload.ts
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('sth', {
  selectMediaFile: () => ipcRenderer.invoke('media:pick'),
  appInfo: () => ipcRenderer.invoke('app:info')
});
```

---

## 4) Step-by-Step Implementation Checklist

1. **Create migration branch** (`desktop-conversion`).
2. **Refactor DB layer** to support dialect switch (MySQL + SQLite).
3. **Author Drizzle SQLite schema/migrations** and validate in local dev.
4. **Build ETL scripts**:
   - `scripts/export-mysql.ts`
   - `scripts/transform.ts`
   - `scripts/import-sqlite.ts`
5. **Run verification suite** for migrated DB parity.
6. **Isolate backend startup** into callable module (`startServer(opts)`).
7. **Add Electron main/preload** with secure `contextIsolation`.
8. **Wire renderer** to internal API base URL (env-based).
9. **Implement file/media service** using appData directories.
10. **Add desktop-specific config**:
    - `electron-builder.yml`
    - icons, metadata, appId.
11. **Harden security**:
    - disable `nodeIntegration`
    - strict CSP
    - validate IPC channels.
12. **Build scripts** in `package.json` for `build`, `dist:win`.
13. **Generate `.exe`** and test on clean Windows VM.
14. **Code-sign** executable and installer.
15. **Prepare upgrade strategy** (data folder persistence across app updates).

Recommended npm packages:

- Core desktop: `electron`, `electron-builder`
- Build: `esbuild` (or `tsup`), `vite`, `concurrently`, `wait-on`, `cross-env`
- DB: `drizzle-orm`, `drizzle-kit`, `better-sqlite3`, `mysql2`
- Server: `express`
- Optional hardening: `zod`, `helmet`

---

## 5) Build Pipeline (GitHub → Windows `.exe`)

## 5.1 GitHub Actions workflow

```yaml
# .github/workflows/build-desktop-win.yml
name: Build STH Windows Desktop

on:
  workflow_dispatch:
  push:
    tags:
      - 'v*.*.*'

jobs:
  build-win:
    runs-on: windows-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build app
        run: npm run build

      - name: Package Windows installer/exe
        run: npm run dist:win

      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: sth-win-build
          path: |
            dist/*.exe
            dist/*.msi
            dist/*.blockmap
            dist/latest.yml
```

## 5.2 Optional Release Automation

For tagged releases:

- publish artifacts to GitHub Releases
- optionally integrate auto-updates (`electron-updater`) pointing to GitHub Releases or private update endpoint.

---

## 6) Practical Notes for Offline Reliability

- Use **SQLite WAL mode** for better concurrency.
- Keep DB + media under `%APPDATA%/STH/` for non-admin writes.
- On first run, perform idempotent initialization (migrations + seed checks).
- Log startup lifecycle to file (`logs/main.log`) for support diagnostics.
- Add backup/restore utilities for `sth.db` and media folder.

---

## 7) Decision Summary

For STH’s stack and offline `.exe` target, the least-risk path is:

- Electron + internal Node server + Drizzle(SQLite) + appData media storage + electron-builder NSIS pipeline.

This preserves your existing architecture while making it portable and fully offline-capable on Windows.
