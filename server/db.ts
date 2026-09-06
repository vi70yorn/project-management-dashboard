import { Pool, PoolClient } from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const PGHOST = process.env.PGHOST || 'localhost';
const PGPORT = parseInt(process.env.PGPORT || '5432', 10);
const PGUSER = process.env.PGUSER || 'postgres';
const PGPASSWORD = process.env.PGPASSWORD || 'postgres';
const PGDATABASE = process.env.PGDATABASE || 'project_management';

export const dbConfig = {
  host: PGHOST,
  port: PGPORT,
  user: PGUSER,
  password: PGPASSWORD,
  database: PGDATABASE,
};

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    if (process.env.DATABASE_URL) {
      const isLocal = process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.includes('127.0.0.1');
      pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: isLocal ? false : { rejectUnauthorized: false },
      });
    } else {
      pool = new Pool({
        host: PGHOST,
        port: PGPORT,
        user: PGUSER,
        password: PGPASSWORD,
        database: PGDATABASE,
      });
    }

    pool.on('error', (err) => {
      console.error('[PostgreSQL Pool Error]:', err.message);
    });
  }
  return pool;
}

/**
 * Ensures the target database exists. If it doesn't, connects to the default 'postgres' database and creates it.
 */
export async function ensureDatabaseExists(): Promise<void> {
  // If a full connection string with external host is used, skip local auto-create
  if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost') && !process.env.DATABASE_URL.includes('127.0.0.1')) {
    return;
  }

  const defaultDbPool = new Pool({
    host: PGHOST,
    port: PGPORT,
    user: PGUSER,
    password: PGPASSWORD,
    database: 'postgres',
  });

  try {
    const res = await defaultDbPool.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [PGDATABASE]
    );

    if (res.rowCount === 0) {
      console.log(`[PostgreSQL] Database "${PGDATABASE}" does not exist. Creating it now...`);
      // CREATE DATABASE cannot run inside a transaction block or parameterized query
      await defaultDbPool.query(`CREATE DATABASE "${PGDATABASE}"`);
      console.log(`[PostgreSQL] Database "${PGDATABASE}" created successfully.`);
    } else {
      console.log(`[PostgreSQL] Database "${PGDATABASE}" already exists.`);
    }
  } catch (err: any) {
    console.warn(`[PostgreSQL] Notice during ensureDatabaseExists: ${err.message}`);
  } finally {
    await defaultDbPool.end().catch(() => {});
  }
}

/**
 * Runs the database/init.sql migration to create tables and seed default records.
 */
export async function runMigrationsAndSeed(): Promise<void> {
  const currentPool = getPool();
  const initSqlPath = path.resolve(process.cwd(), 'database/init.sql');

  if (!fs.existsSync(initSqlPath)) {
    throw new Error(`Init SQL script not found at ${initSqlPath}`);
  }

  const sql = fs.readFileSync(initSqlPath, 'utf8');
  const client: PoolClient = await currentPool.connect();

  try {
    console.log('[PostgreSQL] Executing database/init.sql schema and seed data...');
    await client.query(sql);

    // Apply migrations for username and password columns if existing table didn't have them
    await client.query(`
      ALTER TABLE team_members ADD COLUMN IF NOT EXISTS username VARCHAR(64) UNIQUE;
      ALTER TABLE team_members ADD COLUMN IF NOT EXISTS password VARCHAR(255) DEFAULT '123456';
    `);

    // Ensure known existing members have clean usernames and passwords
    await client.query(`
      UPDATE team_members
      SET username = 'vichet', password = COALESCE(password, '123456')
      WHERE (LOWER(name) LIKE '%vichet%' OR LOWER(email) LIKE '%vichet%') AND (username IS NULL OR username = '');

      UPDATE team_members
      SET username = 'david', password = COALESCE(password, '123456')
      WHERE (LOWER(name) LIKE '%david%' OR LOWER(email) LIKE '%david%') AND (username IS NULL OR username = '');

      UPDATE team_members
      SET username = 'likka', password = COALESCE(password, '1234')
      WHERE (LOWER(name) LIKE '%likka%' OR LOWER(email) LIKE '%likka%') AND (username IS NULL OR username = '');

      -- Fallback for any other members with empty username
      UPDATE team_members
      SET username = LOWER(REGEXP_REPLACE(SPLIT_PART(email, '@', 1), '[^a-zA-Z0-9]', '', 'g'))
      WHERE username IS NULL OR username = '';

      -- Ensure default passwords are not null
      UPDATE team_members
      SET password = '123456'
      WHERE password IS NULL OR password = '';
    `);

    console.log('[PostgreSQL] Database schema, credentials & initial seeds verified successfully.');
  } finally {
    client.release();
  }
}

/**
 * Health check to verify active PostgreSQL connection.
 */
export async function checkConnection(): Promise<{ ok: boolean; message: string; database: string }> {
  try {
    const currentPool = getPool();
    const result = await currentPool.query('SELECT NOW() as now, current_database() as db_name');
    return {
      ok: true,
      message: `Connected to PostgreSQL successfully at ${result.rows[0].now}`,
      database: result.rows[0].db_name,
    };
  } catch (err: any) {
    return {
      ok: false,
      message: err.message,
      database: PGDATABASE,
    };
  }
}
