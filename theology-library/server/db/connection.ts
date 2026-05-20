import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { seedDatabase } from './seed';

let dbInstance: Database.Database | null = null;

function loadSchemaBlueprint(): string {
  return fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
}

function verifySchema(db: Database.Database): void {
  db.pragma('foreign_keys = ON');

  const requiredTables = [
    'categories',
    'sub_topics',
    'testaments',
    'books',
    'chapters',
    'image_sets',
    'images',
    'videos',
    'texts',
    'cross_links',
    'search_index',
    'fts_index',
  ];

  const found = new Set(
    (db.prepare("SELECT name FROM sqlite_master WHERE type IN ('table', 'virtual table')").all() as Array<{ name: string }>).map((r) => r.name),
  );

  const missing = requiredTables.filter((table) => !found.has(table));
  if (missing.length > 0) {
    throw new Error(`Schema verification failed. Missing tables: ${missing.join(', ')}`);
  }
}

export function initializeDb(dataPath: string): Database.Database {
  if (dbInstance) return dbInstance;

  fs.mkdirSync(dataPath, { recursive: true });
  const databasePath = path.join(dataPath, 'sth.db');
  const dbExists = fs.existsSync(databasePath);

  dbInstance = new Database(databasePath, { fileMustExist: false });
  dbInstance.pragma('journal_mode = WAL');
  dbInstance.pragma('foreign_keys = ON');

  if (!dbExists) {
    dbInstance.exec(loadSchemaBlueprint());
  }

  verifySchema(dbInstance);

  const row = dbInstance.prepare('SELECT COUNT(*) as count FROM testaments').get() as { count: number };
  if (row.count === 0) {
    seedDatabase(dbInstance);
  }

  return dbInstance;
}

export function getDb(dataPath: string): Database.Database {
  return initializeDb(dataPath);
}

export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
