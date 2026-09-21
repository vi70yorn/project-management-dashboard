import { recordActivity } from './activityService';

/**
 * Helper: fetch full project with creator, updater, and memberIds
 */
export async function getProjectById(pool: any, id: string) {
  const query = `
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
      COALESCE(p.links, '[]'::jsonb) AS links,
      COALESCE(p.project_for, ARRAY['Mobile App UI', 'Web UI']::text[]) AS "projectFor",
      p.created_by AS "createdBy",
      COALESCE(cb_m.name, cb_u.name, 'Admin') AS "createdByName",
      COALESCE(cb_m.avatar, cb_u.avatar) AS "createdByAvatar",
      p.updated_by AS "updatedBy",
      COALESCE(ub_m.name, ub_u.name, 'Admin') AS "updatedByName",
      COALESCE(ub_m.avatar, ub_u.avatar) AS "updatedByAvatar",
      p.created_at AS "createdAt",
      p.updated_at AS "updatedAt",
      COALESCE(
        (SELECT array_agg(pm.member_id) FROM project_members pm WHERE pm.project_id = p.id),
        '{}'
      ) AS "memberIds"
    FROM projects p
    LEFT JOIN team_members cb_m ON cb_m.id = p.created_by
    LEFT JOIN users cb_u ON cb_u.member_id = p.created_by
    LEFT JOIN team_members ub_m ON ub_m.id = p.updated_by
    LEFT JOIN users ub_u ON ub_u.member_id = p.updated_by
    WHERE p.id = $1;
  `;
  const result = await pool.query(query, [id]);
  return result.rows[0] || null;
}

/**
 * Helper: dynamically sync project status based on task completions and blockers:
 * - If ALL non-deleted tasks are 'Completed' -> auto-set project to 'Completed'.
 * - If tasks are not all completed and project is currently 'Completed' -> move back to 'In Progress' (or 'Blocked' if any task is blocked).
 * - If project is 'Blocked' and has 0 blocked tasks remaining -> unblock to 'In Progress'.
 */
export async function syncProjectStatus(pool: any, projectId: string): Promise<void> {
  if (!projectId) return;
  try {
    const res = await pool.query(
      `SELECT 
         COUNT(*) AS total,
         COUNT(*) FILTER (WHERE status = 'Completed') AS completed,
         COUNT(*) FILTER (WHERE status = 'Blocked') AS blocked
       FROM tasks 
       WHERE project_id = $1 AND deleted_at IS NULL`,
      [projectId]
    );
    if (res.rowCount === 0) return;
    const total = parseInt(res.rows[0].total, 10);
    const completed = parseInt(res.rows[0].completed, 10);
    const blocked = parseInt(res.rows[0].blocked, 10);

    if (total > 0 && completed === total) {
      const upd = await pool.query(
        `UPDATE projects SET status = 'Completed', updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND status != 'Completed' RETURNING name`,
        [projectId]
      );
      if (upd.rowCount > 0) {
        const pName = upd.rows[0].name;
        recordActivity(pool, {
          actionType: 'auto_complete_project',
          entityType: 'project',
          entityId: projectId,
          entityName: pName,
          projectId,
          projectName: pName,
          userName: 'System Automation',
          details: { reason: 'All deliverables completed' },
        });
      }
    } else if (total > 0 && completed < total) {
      const nextStatus = blocked > 0 ? 'Blocked' : 'In Progress';
      await pool.query(
        `UPDATE projects SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND status = 'Completed'`,
        [nextStatus, projectId]
      );
    } else if (blocked === 0) {
      await pool.query(
        `UPDATE projects SET status = 'In Progress', updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND status = 'Blocked'`,
        [projectId]
      );
    }
  } catch (err: any) {
    console.error(`[syncProjectStatus error for ${projectId}]:`, err.message);
  }
}

