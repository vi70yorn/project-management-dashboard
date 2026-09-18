import { getPool } from '../db';

export async function purgeExpiredRecycleBinItems(pool: any): Promise<void> {
  try {
    const tasksRes = await pool.query(`
      DELETE FROM tasks 
      WHERE deleted_at IS NOT NULL AND deleted_at < CURRENT_TIMESTAMP - INTERVAL '7 days'
      RETURNING id, title
    `);
    const projectsRes = await pool.query(`
      DELETE FROM projects 
      WHERE deleted_at IS NOT NULL AND deleted_at < CURRENT_TIMESTAMP - INTERVAL '7 days'
      RETURNING id, name
    `);
    const totalPurged = (tasksRes.rowCount || 0) + (projectsRes.rowCount || 0);
    if (totalPurged > 0) {
      console.log(`[Recycle Bin Auto-Purge] Permanently deleted ${tasksRes.rowCount || 0} tasks and ${projectsRes.rowCount || 0} projects older than 7 days.`);
    }
  } catch (err: any) {
    console.error('[Recycle Bin Auto-Purge Error]:', err.message);
  }
}

export function startRecycleBinPurgeScheduler(): void {
  const pool = getPool();
  // Run once on startup
  purgeExpiredRecycleBinItems(pool);
  // Run every 1 hour (3600000 ms)
  setInterval(() => {
    purgeExpiredRecycleBinItems(pool);
  }, 3600000);
  console.log('[Recycle Bin Auto-Purge] 7-day retention scheduler registered (checks every 1 hour).');
}

