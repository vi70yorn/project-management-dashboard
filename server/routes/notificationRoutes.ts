import { Router, Request, Response } from 'express';
import { getPool } from '../db';
import { requireAuth, JwtPayload } from '../middleware/auth';
import { createServerNotification } from '../services/notificationService';

const router = Router();

// GET all in-app notifications
router.get('/', async (_req: Request, res: Response) => {
  try {
    const pool = getPool();
    const result = await pool.query(`
      SELECT 
        id,
        type,
        title,
        message,
        task_id AS "taskId",
        task_title AS "taskTitle",
        project_id AS "projectId",
        project_name AS "projectName",
        target_user_ids AS "targetUserIds",
        target_roles AS "targetRoles",
        actor_id AS "actorId",
        actor_name AS "actorName",
        actor_avatar AS "actorAvatar",
        read_by AS "readBy",
        created_at AS "createdAt"
      FROM in_app_notifications
      ORDER BY created_at DESC
      LIMIT 60;
    `);
    res.json(result.rows);
  } catch (err: any) {
    console.error('Error fetching notifications:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST create notification
router.post('/', requireAuth, async (req: Request, res: Response) => {
  const {
    type,
    title,
    message,
    taskId,
    taskTitle,
    projectId,
    projectName,
    targetUserIds = [],
    targetRoles = [],
  } = req.body;

  const jwtUser = (req as any).jwtUser as JwtPayload | undefined;
  const actorMemberId = jwtUser?.memberId || (req.headers['x-user-member-id'] as string) || null;
  const actorName = jwtUser?.name || (req.headers['x-user-name'] ? decodeURIComponent(req.headers['x-user-name'] as string) : 'A team member');
  const actorAvatar = req.headers['x-user-avatar'] ? decodeURIComponent(req.headers['x-user-avatar'] as string) : null;

  try {
    const pool = getPool();
    await createServerNotification(pool, {
      type,
      title,
      message,
      taskId,
      taskTitle,
      projectId,
      projectName,
      targetUserIds,
      targetRoles,
      actorId: actorMemberId,
      actorName,
      actorAvatar,
    });
    res.status(201).json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH mark single notification as read
router.patch('/:id/read', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const memberId = (req as any).jwtUser?.memberId || (req.headers['x-user-member-id'] as string) || req.body.memberId;
  if (!memberId) {
    return res.status(400).json({ error: 'User member ID is required' });
  }

  try {
    const pool = getPool();
    await pool.query(
      `UPDATE in_app_notifications
       SET read_by = CASE 
         WHEN $1 = ANY(read_by) THEN read_by 
         ELSE array_append(read_by, $1) 
       END
       WHERE id = $2`,
      [memberId, id]
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST mark all notifications as read
router.post('/mark-all-read', requireAuth, async (req: Request, res: Response) => {
  const memberId = (req as any).jwtUser?.memberId || (req.headers['x-user-member-id'] as string) || req.body.memberId;
  if (!memberId) {
    return res.status(400).json({ error: 'User member ID is required' });
  }

  try {
    const pool = getPool();
    await pool.query(
      `UPDATE in_app_notifications
       SET read_by = CASE 
         WHEN $1 = ANY(read_by) THEN read_by 
         ELSE array_append(read_by, $1) 
       END`,
      [memberId]
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE dismiss notification
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const pool = getPool();
    await pool.query(`DELETE FROM in_app_notifications WHERE id = $1`, [id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

