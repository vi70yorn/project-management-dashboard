import { Router, Request, Response } from 'express';
import { getPool } from '../db';
import { requireAuth } from '../middleware/auth';
import { recordActivity } from '../services/activityService';

const router = Router();

// GET /api/activities — recent team activities
router.get('/', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const pool = getPool();
    const query = `
      SELECT 
        a.id,
        a.user_id AS "userId",
        COALESCE(tm.name, a.user_name) AS "userName",
        COALESCE(tm.avatar, a.user_avatar) AS "userAvatar",
        tm.color AS "userColor",
        tm.role AS "userRole",
        a.action_type AS "actionType",
        a.entity_type AS "entityType",
        a.entity_id AS "entityId",
        a.entity_name AS "entityName",
        a.project_id AS "projectId",
        COALESCE(p.name, a.project_name) AS "projectName",
        a.details,
        a.created_at AS "createdAt"
      FROM activity_logs a
      LEFT JOIN team_members tm ON a.user_id = tm.id
      LEFT JOIN projects p ON a.project_id = p.id
      ORDER BY a.created_at DESC
      LIMIT $1;
    `;
    const result = await pool.query(query, [limit]);
    res.json(result.rows);
  } catch (err: any) {
    console.error('Error fetching activities:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/activities — create custom activity
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    await recordActivity(pool, req.body, req);
    res.status(201).json({ success: true, message: 'Activity recorded' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

