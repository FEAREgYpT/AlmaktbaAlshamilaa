import fs from 'fs';
import path from 'path';

/**
 * Converts a MySQL-oriented Drizzle schema file to a SQLite Drizzle schema scaffold.
 * Input default: drizzle/schema.ts
 * Output default: drizzle/sqlite-schema.ts
 */

const inFile = process.argv[2] ?? path.resolve(process.cwd(), 'drizzle/schema.ts');
const outFile = process.argv[3] ?? path.resolve(process.cwd(), 'drizzle/sqlite-schema.ts');

const source = fs.readFileSync(inFile, 'utf8');

const transformed = source
  .replace(/from ['"]drizzle-orm\/mysql-core['"]/g, "from 'drizzle-orm/sqlite-core'")
  .replace(/mysqlTable/g, 'sqliteTable')
  .replace(/serial\(/g, 'integer(')
  .replace(/\.autoincrement\(\)/g, '')
  .replace(/timestamp\(([^)]*)\)/g, 'text($1)')
  .replace(/datetime\(([^)]*)\)/g, 'text($1)')
  .replace(/\bjson\(/g, 'text(')
  .replace(/\.onUpdateNow\(\)/g, '')
  .replace(/\.unsigned\(\)/g, '');

const header = `// Auto-generated conversion scaffold. Review constraints/indexes before production use.\n`;
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, header + transformed, 'utf8');

console.log(`SQLite Drizzle schema scaffold written to: ${outFile}`);
