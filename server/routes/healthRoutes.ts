import { Router, Request, Response } from 'express';
import { getPool, checkConnection, dbConfig } from '../db';

const router = Router();

// GET /api/health
router.get('/', async (_req: Request, res: Response) => {
  const conn = await checkConnection();
  if (!conn.ok) {
    return res.status(503).json({
      status: 'error',
      connected: false,
      message: conn.message,
      config: {
        host: dbConfig.host,
        port: dbConfig.port,
        database: dbConfig.database,
        user: dbConfig.user,
      },
    });
  }

  try {
    const pool = getPool();
    const [projCount, taskCount, memberCount] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM projects WHERE deleted_at IS NULL'),
      pool.query('SELECT COUNT(*) FROM tasks WHERE deleted_at IS NULL'),
      pool.query('SELECT COUNT(*) FROM team_members'),
    ]);

    return res.json({
      status: 'ok',
      connected: true,
      database: conn.database,
      serverTime: new Date().toISOString(),
      counts: {
        projects: parseInt(projCount.rows[0].count, 10),
        tasks: parseInt(taskCount.rows[0].count, 10),
        members: parseInt(memberCount.rows[0].count, 10),
      },
      dbeaverConnection: {
        host: dbConfig.host,
        port: dbConfig.port,
        database: conn.database,
        user: dbConfig.user,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

export default router;

