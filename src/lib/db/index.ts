import { Pool, PoolClient } from 'pg';
import { newDb, IMemoryDb } from 'pg-mem';
import * as fs from 'fs';
import * as path from 'path';

let pool: Pool | null = null;
let memDbInstance: IMemoryDb | null = null;
let memDbAdapter: any = null;

// Initialize or get pg-mem database for tests
function getMemDb() {
  if (!memDbInstance) {
    memDbInstance = newDb();

    memDbInstance.public.registerFunction({
      name: 'gen_random_uuid',
      returns: 'uuid' as any,
      impure: true,
      implementation: () => crypto.randomUUID(),
    });

    memDbAdapter = memDbInstance.adapters.createPg();

    // Load and execute schema.sql in memory
    const schemaPath = path.join(process.cwd(), 'src', 'lib', 'db', 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      let schemaSql = fs.readFileSync(schemaPath, 'utf8');
      // Strip CREATE EXTENSION for pg-mem compatibility
      schemaSql = schemaSql.replace(/CREATE EXTENSION[^\n]*;/gi, '');
      memDbInstance.public.none(schemaSql);
    }
  }
  return memDbAdapter;
}

export function getPool(): Pool {
  if (!pool) {
    if (process.env.NODE_ENV === 'test' || process.env.USE_IN_MEMORY_DB === 'true') {
      const memAdapter = getMemDb();
      pool = new memAdapter.Pool();
    } else {
      const connectionString = process.env.DATABASE_URL;
      if (!connectionString) {
        throw new Error('DATABASE_URL environment variable is not defined.');
      }
      pool = new Pool({
        connectionString,
        ssl: connectionString.includes('neon.tech') || connectionString.includes('sslmode=require') 
          ? { rejectUnauthorized: false } 
          : false,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      });
    }
  }
  return pool!;
}

export interface DbClient {
  query: <T = any>(text: string, params?: any[]) => Promise<{ rows: T[]; rowCount: number | null }>;
}

export async function query<T = any>(text: string, params: any[] = []): Promise<T[]> {
  const p = getPool();
  const sqlText = (process.env.NODE_ENV === 'test' || process.env.USE_IN_MEMORY_DB === 'true')
    ? text.replace(/SKIP LOCKED/gi, '')
    : text;
  const res = await p.query(sqlText, params);
  return res.rows as T[];
}

export async function queryOne<T = any>(text: string, params: any[] = []): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] || null;
}

/**
 * Executes a set of operations in a strict database transaction with automatic rollback on error.
 */
export async function withTransaction<T>(
  callback: (client: {
    query: <R = any>(text: string, params?: any[]) => Promise<R[]>;
    queryOne: <R = any>(text: string, params?: any[]) => Promise<R | null>;
    rawClient: PoolClient;
  }) => Promise<T>
): Promise<T> {
  const p = getPool();
  const client = await p.connect();

  try {
    await client.query('BEGIN');

    const txHelper = {
      query: async <R = any>(text: string, params: any[] = []): Promise<R[]> => {
        const sqlText = (process.env.NODE_ENV === 'test' || process.env.USE_IN_MEMORY_DB === 'true')
          ? text.replace(/SKIP LOCKED/gi, '')
          : text;
        const res = await client.query(sqlText, params);
        return res.rows as R[];
      },
      queryOne: async <R = any>(text: string, params: any[] = []): Promise<R | null> => {
        const sqlText = (process.env.NODE_ENV === 'test' || process.env.USE_IN_MEMORY_DB === 'true')
          ? text.replace(/SKIP LOCKED/gi, '')
          : text;
        const res = await client.query(sqlText, params);
        return (res.rows[0] as R) || null;
      },
      rawClient: client,
    };

    const result = await callback(txHelper);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
