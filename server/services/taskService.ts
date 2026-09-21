/**
 * Helper: fetch full task with creator, updater, project details, comment count, and subtasks
 */
export async function getTaskById(pool: any, id: string) {
  const query = `
    SELECT 
      t.id,
      t.project_id AS "projectId",
      p.name AS "projectName",
      t.title,
      t.description,
      t.status,
      t.priority,
      t.assignee_id AS "assigneeId",
      t.task_for AS "taskFor",
      COALESCE(t.links, '[]'::jsonb) AS links,
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
      (SELECT COUNT(*)::int FROM task_comments WHERE task_id = t.id) AS "commentCount",
      COALESCE(
        (
          SELECT json_agg(
            json_build_object(
              'id', s.id,
              'taskId', s.task_id,
              'title', s.title,
              'completed', s.completed,
              'position', s.position,
              'createdAt', s.created_at,
              'updatedAt', s.updated_at
            ) ORDER BY s.position ASC, s.created_at ASC
          )
          FROM task_subtasks s
          WHERE s.task_id = t.id
        ),
        '[]'::json
      ) AS subtasks
    FROM tasks t
    LEFT JOIN projects p ON p.id = t.project_id
    LEFT JOIN team_members cb_m ON cb_m.id = t.created_by
    LEFT JOIN users cb_u ON cb_u.member_id = t.created_by
    LEFT JOIN team_members ub_m ON ub_m.id = t.updated_by
    LEFT JOIN users ub_u ON ub_u.member_id = t.updated_by
    WHERE t.id = $1;
  `;
  const result = await pool.query(query, [id]);
  return result.rows[0] || null;
}

