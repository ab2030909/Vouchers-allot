import * as fs from 'fs';
import * as path from 'path';
import { getPool } from '../src/lib/db';

async function initDb() {
  console.log('Initializing PostgreSQL database schema...');
  const pool = getPool();

  const schemaPath = path.join(process.cwd(), 'src', 'lib', 'db', 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  try {
    await pool.query(schemaSql);
    console.log('Successfully applied schema migrations.');
  } catch (error) {
    console.error('Database initialization failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

initDb();
