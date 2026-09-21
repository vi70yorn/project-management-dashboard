import { Router, Request, Response } from 'express';
import { getPool } from '../db';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { recordActivity } from '../services/activityService';
import { syncProjectStatus } from '../services/projectService';

const router = Router();

// GET all items in the recycle bin
router.get('/', requireAuth, async (_req: Request, res: Response) => {
  try {
    const pool = getPool();
    const [projectsRes, tasksRes] = await Promise.all([
      pool.query(`
        SELECT 
          p.id,
          p.name,
          p.description,
          p.client,
          p.status,
          p.start_date AS "startDate",
          p.target_deadline AS "targetDeadline",
          p.manager_id AS "managerId",
          p.tags,
          p.color,
          COALESCE(p.project_for, ARRAY['Mobile App UI', 'Web UI']::text[]) AS "projectFor",
          p.created_by AS "createdBy",
          COALESCE(cb_m.name, cb_u.name, 'Admin') AS "createdByName",
          COALESCE(cb_m.avatar, cb_u.avatar) AS "createdByAvatar",
          p.updated_by AS "updatedBy",
          COALESCE(ub_m.name, ub_u.name, 'Admin') AS "updatedByName",
          COALESCE(ub_m.avatar, ub_u.avatar) AS "updatedByAvatar",
          p.created_at AS "createdAt",
          p.updated_at AS "updatedAt",
          p.deleted_at AS "deletedAt",
          p.deleted_by AS "deletedById",
          COALESCE(
            del_m.name, 
            del_u.name, 
            (SELECT user_name FROM activity_logs WHERE entity_id = p.id AND action_type = 'delete_project' ORDER BY created_at DESC LIMIT 1),
            'Admin'
          ) AS "deletedByName",
          COALESCE(
            del_m.avatar, 
            del_u.avatar, 
            (SELECT user_avatar FROM activity_logs WHERE entity_id = p.id AND action_type = 'delete_project' ORDER BY created_at DESC LIMIT 1),
            NULL
          ) AS "deletedByAvatar",
          (p.deleted_at + INTERVAL '7 days') AS "expiresAt",
          GREATEST(0, CEIL(EXTRACT(EPOCH FROM ((p.deleted_at + INTERVAL '7 days') - CURRENT_TIMESTAMP)) / 86400))::int AS "daysLeft",
          COALESCE(
            (SELECT array_agg(pm.member_id) FROM project_members pm WHERE pm.project_id = p.id),
            '{}'
          ) AS "memberIds"
        FROM projects p
        LEFT JOIN team_members del_m ON del_m.id = p.deleted_by
        LEFT JOIN users del_u ON del_u.member_id = p.deleted_by
        LEFT JOIN team_members cb_m ON cb_m.id = p.created_by
        LEFT JOIN users cb_u ON cb_u.member_id = p.created_by
        LEFT JOIN team_members ub_m ON ub_m.id = p.updated_by
        LEFT JOIN users ub_u ON ub_u.member_id = p.updated_by
        WHERE p.deleted_at IS NOT NULL
        ORDER BY p.deleted_at DESC
      `),
      pool.query(`
        SELECT 
          t.id,
          t.project_id AS "projectId",
          COALESCE(p.name, 'Unknown Project') AS "projectName",
          t.title,
          t.description,
          t.status,
          t.priority,
          t.assignee_id AS "assigneeId",
          COALESCE(tm.name, u.name, 'Unassigned') AS "assigneeName",
          COALESCE(tm.avatar, u.avatar) AS "assigneeAvatar",
          t.task_for AS "taskFor",
          t.links,
          t.created_by AS "createdBy",
          COALESCE(cb_m.name, cb_u.name, 'Team Member') AS "createdByName",
          COALESCE(cb_m.avatar, cb_u.avatar) AS "createdByAvatar",
          t.updated_by AS "updatedBy",
          COALESCE(ub_m.name, ub_u.name, 'Team Member') AS "updatedByName",
          COALESCE(ub_m.avatar, ub_u.avatar) AS "updatedByAvatar",
          t.start_date AS "startDate",
          t.due_date AS "dueDate",
          t.created_at AS "createdAt",
          t.updated_at AS "updatedAt",
          t.deleted_at AS "deletedAt",
          t.deleted_by AS "deletedById",
          COALESCE(
            del_m.name, 
            del_u.name, 
            (SELECT user_name FROM activity_logs WHERE entity_id = t.id AND action_type = 'delete_task' ORDER BY created_at DESC LIMIT 1),
            'Team Member'
          ) AS "deletedByName",
          COALESCE(
            del_m.avatar, 
            del_u.avatar, 
            (SELECT user_avatar FROM activity_logs WHERE entity_id = t.id AND action_type = 'delete_task' ORDER BY created_at DESC LIMIT 1),
            NULL
          ) AS "deletedByAvatar",
          (t.deleted_at + INTERVAL '7 days') AS "expiresAt",
          GREATEST(0, CEIL(EXTRACT(EPOCH FROM ((t.deleted_at + INTERVAL '7 days') - CURRENT_TIMESTAMP)) / 86400))::int AS "daysLeft"
        FROM tasks t
        LEFT JOIN projects p ON p.id = t.project_id
        LEFT JOIN team_members tm ON tm.id = t.assignee_id
        LEFT JOIN users u ON u.member_id = t.assignee_id
        LEFT JOIN team_members del_m ON del_m.id = t.deleted_by
        LEFT JOIN users del_u ON del_u.member_id = t.deleted_by
        LEFT JOIN team_members cb_m ON cb_m.id = t.created_by
        LEFT JOIN users cb_u ON cb_u.member_id = t.created_by
        LEFT JOIN team_members ub_m ON ub_m.id = t.updated_by
        LEFT JOIN users ub_u ON ub_u.member_id = t.updated_by
        WHERE t.deleted_at IS NOT NULL
        ORDER BY t.deleted_at DESC
      `),
    ]);

    res.json({
      projects: projectsRes.rows,
      tasks: tasksRes.rows,
      totalCount: projectsRes.rows.length + tasksRes.rows.length,
    });
  } catch (err: any) {
    console.error('Error fetching recycle bin items:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST restore item from recycle bin
router.post('/restore', requireAuth, async (req: Request, res: Response) => {
  const { type, id } = req.body;
  if (!type || !id) {
    return res.status(400).json({ error: 'Type (project or task) and id are required' });
  }

  const pool = getPool();
  try {
    if (type === 'project') {
      const result = await pool.query(
        `UPDATE projects SET deleted_at = NULL, deleted_by = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND deleted_at IS NOT NULL RETURNING id, name`,
        [id]
      );
      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Project not found in Recycle Bin' });
      }
      const restoredProj = result.rows[0];

      // Restore associated tasks for this project
      await pool.query(
        `UPDATE tasks SET deleted_at = NULL, deleted_by = NULL, updated_at = CURRENT_TIMESTAMP WHERE project_id = $1`,
        [id]
      );

      recordActivity(pool, {
        actionType: 'restore_project',
        entityType: 'project',
        entityId: id,
        entityName: restoredProj.name,
        projectId: id,
        projectName: restoredProj.name,
      }, req);

      return res.json({ success: true, message: 'Project and associated tasks restored', id, type });
    } else if (type === 'task') {
      const result = await pool.query(
        `UPDATE tasks SET deleted_at = NULL, deleted_by = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND deleted_at IS NOT NULL RETURNING id, title, project_id AS "projectId"`,
        [id]
      );
      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Task not found in Recycle Bin' });
      }
      const restoredTask = result.rows[0];

      // Ensure parent project is restored if it was soft-deleted
      if (restoredTask.projectId) {
        await pool.query(
          `UPDATE projects SET deleted_at = NULL, deleted_by = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND deleted_at IS NOT NULL`,
          [restoredTask.projectId]
        );
        await syncProjectStatus(pool, restoredTask.projectId);
      }

      recordActivity(pool, {
        actionType: 'restore_task',
        entityType: 'task',
        entityId: id,
        entityName: restoredTask.title,
        projectId: restoredTask.projectId,
      }, req);

      return res.json({ success: true, message: 'Task restored successfully', id, type });
    } else {
      return res.status(400).json({ error: 'Invalid item type. Must be "project" or "task"' });
    }
  } catch (err: any) {
    console.error('Error restoring recycle bin item:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE permanently delete a single item from recycle bin (admin only)
router.delete('/:type/:id', requireAdmin, async (req: Request, res: Response) => {
  const { type, id } = req.params;
  const pool = getPool();

  try {
    if (type === 'project') {
      const result = await pool.query(
        `DELETE FROM projects WHERE id = $1 RETURNING id, name`,
        [id]
      );
      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Project not found' });
      }
      return res.json({ success: true, message: 'Project permanently deleted', id, type });
    } else if (type === 'task') {
      const result = await pool.query(
        `DELETE FROM tasks WHERE id = $1 RETURNING id, title, project_id AS "projectId"`,
        [id]
      );
      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Task not found' });
      }
      const deletedTask = result.rows[0];
      if (deletedTask?.projectId) {
        await syncProjectStatus(pool, deletedTask.projectId);
      }
      return res.json({ success: true, message: 'Task permanently deleted', id, type });
    } else {
      return res.status(400).json({ error: 'Invalid type parameter' });
    }
  } catch (err: any) {
    console.error('Error permanently deleting item:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE empty entire recycle bin (admin only)
router.delete('/', requireAdmin, async (_req: Request, res: Response) => {
  const pool = getPool();
  try {
    await pool.query(`DELETE FROM tasks WHERE deleted_at IS NOT NULL`);
    await pool.query(`DELETE FROM projects WHERE deleted_at IS NOT NULL`);
    res.json({ success: true, message: 'Recycle bin emptied permanently' });
  } catch (err: any) {
    console.error('Error emptying recycle bin:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;

