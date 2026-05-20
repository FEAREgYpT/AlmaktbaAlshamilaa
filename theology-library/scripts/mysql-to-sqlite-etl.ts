import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import Database from 'better-sqlite3';

const MYSQL_URL = process.env.MYSQL_URL;
if (!MYSQL_URL) {
  throw new Error('Set MYSQL_URL to run ETL export/import.');
}

const dataPath = process.argv[2] ?? path.resolve(process.cwd(), 'local-data');
const sqlitePath = path.join(dataPath, 'sth.db');
const schemaPath = path.resolve(process.cwd(), 'server/db/schema.sql');

const orderedTables = [
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
];

function normalize(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object') return JSON.stringify(value);
  if (Buffer.isBuffer(value)) return value.toString('utf8');
  return value;
}

async function main() {
  fs.mkdirSync(dataPath, { recursive: true });

  const mysqlConn = await mysql.createConnection(MYSQL_URL);
  const sqlite = new Database(sqlitePath);

  sqlite.pragma('foreign_keys = OFF');
  sqlite.exec(fs.readFileSync(schemaPath, 'utf8'));

  const trx = sqlite.transaction(async () => {
    for (const table of orderedTables) {
      const [rows] = await mysqlConn.query(`SELECT * FROM ${table}`);
      const typedRows = rows as Array<Record<string, unknown>>;
      if (typedRows.length === 0) continue;

      const cols = Object.keys(typedRows[0]);
      const stmt = sqlite.prepare(
        `INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`,
      );

      for (const row of typedRows) {
        const values = cols.map((c) => normalize(row[c]));
        stmt.run(...values);
      }
    }
  });

  await trx();
  sqlite.pragma('foreign_keys = ON');

  await mysqlConn.end();
  sqlite.close();
  console.log(`ETL complete: ${sqlitePath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
