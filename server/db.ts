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
    // Pre-migration: ensure deleted_at, deleted_by, created_by, and updated_by columns exist on any pre-existing projects/tasks tables
    await client.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'projects') THEN
          ALTER TABLE projects ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
          ALTER TABLE projects ADD COLUMN IF NOT EXISTS deleted_by VARCHAR(64);
          ALTER TABLE projects ADD COLUMN IF NOT EXISTS created_by VARCHAR(64);
          ALTER TABLE projects ADD COLUMN IF NOT EXISTS updated_by VARCHAR(64);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tasks') THEN
          ALTER TABLE tasks ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
          ALTER TABLE tasks ADD COLUMN IF NOT EXISTS deleted_by VARCHAR(64);
          ALTER TABLE tasks ADD COLUMN IF NOT EXISTS created_by VARCHAR(64);
          ALTER TABLE tasks ADD COLUMN IF NOT EXISTS updated_by VARCHAR(64);
        END IF;
      END $$;
    `).catch(() => {});

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

      -- 6. Telegram Automated Weekly Report Settings Table
      CREATE TABLE IF NOT EXISTS telegram_settings (
          id VARCHAR(32) PRIMARY KEY DEFAULT 'default',
          bot_token TEXT,
          chat_id TEXT,
          enabled BOOLEAN DEFAULT false,
          send_day VARCHAR(16) DEFAULT 'Monday',
          send_time VARCHAR(8) DEFAULT '08:00',
          last_sent_at TIMESTAMPTZ,
          last_auto_sent_date VARCHAR(16),
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE telegram_settings ADD COLUMN IF NOT EXISTS last_auto_sent_date VARCHAR(16);

      INSERT INTO telegram_settings (id, enabled, send_day, send_time)
      VALUES ('default', false, 'Monday', '08:00')
      ON CONFLICT (id) DO NOTHING;

      -- AI Settings Table (Google Gemini)
      CREATE TABLE IF NOT EXISTS ai_settings (
          id VARCHAR(32) PRIMARY KEY DEFAULT 'default',
          api_key TEXT,
          model VARCHAR(64) DEFAULT 'gemini-2.5-flash',
          enabled BOOLEAN DEFAULT true,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );

      INSERT INTO ai_settings (id, model, enabled)
      VALUES ('default', 'gemini-2.5-flash', true)
      ON CONFLICT (id) DO NOTHING;

      -- 7. Team Activity Logs Table
      CREATE TABLE IF NOT EXISTS activity_logs (
          id VARCHAR(64) PRIMARY KEY,
          user_id VARCHAR(64) REFERENCES team_members(id) ON DELETE SET NULL,
          user_name VARCHAR(255) NOT NULL,
          user_avatar TEXT,
          action_type VARCHAR(64) NOT NULL,
          entity_type VARCHAR(32) NOT NULL,
          entity_id VARCHAR(64) NOT NULL,
          entity_name VARCHAR(255) NOT NULL,
          project_id VARCHAR(64),
          project_name VARCHAR(255),
          details JSONB DEFAULT '{}',
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_activity_logs_project_id ON activity_logs(project_id);

      INSERT INTO activity_logs (id, user_id, user_name, action_type, entity_type, entity_id, entity_name, project_id, project_name, details, created_at)
      VALUES
          ('act-1', 'mem-1788624800573', 'Likka', 'update_task_status', 'task', 'task-1788624838718', 'Report Screen', 'proj-1788624651745', 'Merchant 5.0', '{"fromStatus": "In Progress", "toStatus": "Completed"}', '2026-09-05T16:55:13.264Z'),
          ('act-2', 'mem-1788624380119', 'David', 'update_task_status', 'task', 'task-1788624689153', 'Home', 'proj-1788624651745', 'Merchant 5.0', '{"fromStatus": "Ready Review", "toStatus": "In Progress"}', '2026-09-06T05:42:02.918Z'),
          ('act-3', 'mem-1788624319284', 'Y.VICHET', 'create_project', 'project', 'proj-1788624651745', 'Merchant 5.0', 'proj-1788624651745', 'Merchant 5.0', '{"status": "In Progress"}', '2026-09-05T16:10:52.120Z')
      ON CONFLICT (id) DO NOTHING;

      -- Recycle Bin migrations: soft-delete columns, deleted_by actor, and indexes
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS deleted_by VARCHAR(64);
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS deleted_by VARCHAR(64);
      CREATE INDEX IF NOT EXISTS idx_projects_deleted_at ON projects(deleted_at);
      CREATE INDEX IF NOT EXISTS idx_tasks_deleted_at ON tasks(deleted_at);

      -- Backfill deleted_by from activity_logs for any tasks or projects soft-deleted previously
      UPDATE tasks t
      SET deleted_by = sub.user_id
      FROM (
        SELECT DISTINCT ON (entity_id) entity_id, user_id
        FROM activity_logs
        WHERE action_type = 'delete_task' AND user_id IS NOT NULL
        ORDER BY entity_id, created_at DESC
      ) sub
      WHERE t.id = sub.entity_id AND t.deleted_by IS NULL;

      UPDATE projects p
      SET deleted_by = sub.user_id
      FROM (
        SELECT DISTINCT ON (entity_id) entity_id, user_id
        FROM activity_logs
        WHERE action_type = 'delete_project' AND user_id IS NOT NULL
        ORDER BY entity_id, created_at DESC
      ) sub
      WHERE p.id = sub.entity_id AND p.deleted_by IS NULL;

      -- Audit fields migration: created_by and updated_by for projects and tasks
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS created_by VARCHAR(64);
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS updated_by VARCHAR(64);
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS updated_by VARCHAR(64);
      CREATE INDEX IF NOT EXISTS idx_projects_created_by ON projects(created_by);
      CREATE INDEX IF NOT EXISTS idx_projects_updated_by ON projects(updated_by);
      CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON tasks(created_by);
      CREATE INDEX IF NOT EXISTS idx_tasks_updated_by ON tasks(updated_by);

      -- Backfill created_by for projects
      UPDATE projects p
      SET created_by = sub.user_id
      FROM (
        SELECT DISTINCT ON (entity_id) entity_id, user_id
        FROM activity_logs
        WHERE action_type = 'create_project' AND user_id IS NOT NULL
        ORDER BY entity_id, created_at ASC
      ) sub
      WHERE p.id = sub.entity_id AND p.created_by IS NULL;

      UPDATE projects
      SET created_by = COALESCE(manager_id, (SELECT member_id FROM project_members WHERE project_id = projects.id LIMIT 1), 'mem-1788624319284')
      WHERE created_by IS NULL;

      -- Backfill updated_by for projects
      UPDATE projects p
      SET updated_by = sub.user_id
      FROM (
        SELECT DISTINCT ON (entity_id) entity_id, user_id
        FROM activity_logs
        WHERE entity_type = 'project' AND user_id IS NOT NULL
        ORDER BY entity_id, created_at DESC
      ) sub
      WHERE p.id = sub.entity_id AND p.updated_by IS NULL;

      UPDATE projects
      SET updated_by = COALESCE(created_by, manager_id, 'mem-1788624319284')
      WHERE updated_by IS NULL;

      -- Backfill created_by for tasks
      UPDATE tasks t
      SET created_by = COALESCE(
        (SELECT user_id FROM activity_logs WHERE entity_id = t.id AND action_type = 'create_task' ORDER BY created_at ASC LIMIT 1),
        assignee_id,
        (SELECT created_by FROM projects WHERE id = t.project_id),
        'mem-1788624319284'
      )
      WHERE created_by IS NULL;

      -- Backfill updated_by for tasks
      UPDATE tasks t
      SET updated_by = sub.user_id
      FROM (
        SELECT DISTINCT ON (entity_id) entity_id, user_id
        FROM activity_logs
        WHERE entity_type = 'task' AND user_id IS NOT NULL
        ORDER BY entity_id, created_at DESC
      ) sub
      WHERE t.id = sub.entity_id AND t.updated_by IS NULL;

      UPDATE tasks
      SET updated_by = COALESCE(created_by, assignee_id, 'mem-1788624319284')
      WHERE updated_by IS NULL;

      -- Status migration: convert 'Pending' to 'Ready Review'
      UPDATE tasks SET status = 'Ready Review' WHERE status = 'Pending';
      UPDATE projects SET status = 'Ready Review' WHERE status = 'Pending';
      ALTER TABLE projects ALTER COLUMN status SET DEFAULT 'Ready Review';
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
