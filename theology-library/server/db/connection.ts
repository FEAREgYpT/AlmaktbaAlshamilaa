import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { seedDatabase } from './seed';

let dbInstance: Database.Database | null = null;

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
    'fts_index'
  ];

  const found = new Set(
    (db.prepare("SELECT name FROM sqlite_master WHERE type IN ('table', 'virtual table')").all() as Array<{ name: string }>).map((r) => r.name)
  );

  const missing = requiredTables.filter((table) => !found.has(table));
  if (missing.length > 0) {
    throw new Error(`Schema verification failed. Missing tables: ${missing.join(', ')}`);
  }

  const categoryFks = db.prepare("PRAGMA foreign_key_list('categories')").all() as Array<{ from: string; table: string }>;
  const hasSelfReference = categoryFks.some((fk) => fk.from === 'parent_id' && fk.table === 'categories');
  if (!hasSelfReference) {
    throw new Error('Schema verification failed. categories.parent_id must reference categories(id).');
  }
}

export function getDb(dataPath: string): Database.Database {
  if (dbInstance) return dbInstance;

  fs.mkdirSync(dataPath, { recursive: true });
  const databasePath = path.join(dataPath, 'theology-library.db');
  dbInstance = new Database(databasePath, { fileMustExist: false });

  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
  dbInstance.exec(schema);
  verifySchema(dbInstance);

  const row = dbInstance.prepare('SELECT COUNT(*) as count FROM testaments').get() as { count: number };
  if (row.count === 0) {
    seedDatabase(dbInstance);
  }

  return dbInstance;
}
