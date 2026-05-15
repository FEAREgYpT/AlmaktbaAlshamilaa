import Database from 'better-sqlite3'; import fs from 'fs'; import path from 'path'; import { seedDatabase } from './seed';
let db: Database.Database;
export function getDb(dataPath: string) { if (db) return db; fs.mkdirSync(dataPath,{recursive:true}); const p=path.join(dataPath,'theology-library.db'); db=new Database(p); const schema=fs.readFileSync(path.join(__dirname,'schema.sql'),'utf-8'); db.exec(schema); const c=(db.prepare('SELECT COUNT(*) as count FROM testaments').get() as any).count; if (c===0) seedDatabase(db); return db; }
