import { Router, Request, Response } from 'express';
import { getPool } from '../db';
import { requireAuth } from '../middleware/auth';
import { recordActivity } from '../services/activityService';
import { getProjectById } from '../services/projectService';

const router = Router();

// GET all projects with their memberIds array and audit info
router.get('/', async (_req: Request, res: Response) => {
  try {
    const pool = getPool();
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
      WHERE p.deleted_at IS NULL
      ORDER BY p.created_at DESC;
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err: any) {
    console.error('Error fetching projects:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST create project
router.post('/', requireAuth, async (req: Request, res: Response) => {
  const {
    id,
    name,
    description,
    client,
    status = 'Ready Review',
    startDate,
    targetDeadline,
    managerId,
    tags = [],
    color = '#2563eb',
    memberIds = [],
    links = [],
    createdBy,
  } = req.body;

  const jwtMemberId = (req as any).jwtUser?.memberId || null;
  const headerMemberId = (req.headers['x-user-member-id'] as string) || null;
  const effectiveCreatedBy = jwtMemberId || createdBy || headerMemberId || managerId || null;
  const projectId = id || `proj-${Date.now()}`;
  const pool = getPool();
  const dbClient = await pool.connect();

  try {
    await dbClient.query('BEGIN');

    const insertProjectQuery = `
      INSERT INTO projects (id, name, description, client, status, start_date, target_deadline, manager_id, tags, color, links, created_by, updated_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $12)
      RETURNING *;
    `;
    const result = await dbClient.query(insertProjectQuery, [
      projectId,
      name,
      description,
      client,
      status,
      startDate || null,
      targetDeadline || null,
      managerId || null,
      tags,
      color,
      JSON.stringify(links),
      effectiveCreatedBy,
    ]);

    const createdProject = result.rows[0];

    // Auto-assign project manager / lead to project members and promote them to Admin
    let allMemberIds = Array.isArray(memberIds) ? [...memberIds] : [];
    if (managerId && !allMemberIds.includes(managerId)) {
      allMemberIds.push(managerId);
    }

    if (managerId) {
      await dbClient.query(
        `UPDATE team_members
         SET system_role = 'admin', updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND (system_role IS NULL OR LOWER(system_role) != 'admin')`,
        [managerId]
      );
    }

    // Insert project members
    if (allMemberIds.length > 0) {
      for (const memberId of allMemberIds) {
        await dbClient.query(
          `INSERT INTO project_members (project_id, member_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [projectId, memberId]
        );
      }
    }

    await dbClient.query('COMMIT');

    const fullProject = await getProjectById(pool, projectId);

    recordActivity(pool, {
      actionType: 'create_project',
      entityType: 'project',
      entityId: projectId,
      entityName: name,
      projectId: projectId,
      projectName: name,
      details: { client, status },
    }, req);

    res.status(201).json(fullProject || createdProject);
  } catch (err: any) {
    await dbClient.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    dbClient.release();
  }
});

// PUT update project
router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    name,
    description,
    client,
    status,
    startDate,
    targetDeadline,
    managerId,
    tags,
    color,
    links,
    memberIds,
    updatedBy,
  } = req.body;

  const jwtMemberId = (req as any).jwtUser?.memberId || null;
  const headerMemberId = (req.headers['x-user-member-id'] as string) || null;
  const effectiveUpdatedBy = jwtMemberId || updatedBy || headerMemberId || null;

  const pool = getPool();
  const dbClient = await pool.connect();

  try {
    await dbClient.query('BEGIN');

    const updateQuery = `
      UPDATE projects
      SET 
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        client = COALESCE($3, client),
        status = COALESCE($4, status),
        start_date = COALESCE($5, start_date),
        target_deadline = COALESCE($6, target_deadline),
        manager_id = $7,
        tags = COALESCE($8, tags),
        color = COALESCE($9, color),
        links = COALESCE($10::jsonb, links),
        updated_by = COALESCE($11, updated_by),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $12
      RETURNING *;
    `;

    const result = await dbClient.query(updateQuery, [
      name,
      description,
      client,
      status,
      startDate,
      targetDeadline,
      managerId || null,
      tags,
      color,
      links !== undefined ? JSON.stringify(links) : null,
      effectiveUpdatedBy,
      id,
    ]);

    if (result.rowCount === 0) {
      await dbClient.query('ROLLBACK');
      return res.status(404).json({ error: 'Project not found' });
    }

    // Sync memberIds if provided
    if (Array.isArray(memberIds)) {
      await dbClient.query(`DELETE FROM project_members WHERE project_id = $1`, [id]);
      for (const memberId of memberIds) {
        await dbClient.query(
          `INSERT INTO project_members (project_id, member_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [id, memberId]
        );
      }
    }

    await dbClient.query('COMMIT');

    const fullProject = await getProjectById(pool, id);

    recordActivity(pool, {
      actionType: 'update_project',
      entityType: 'project',
      entityId: id,
      entityName: fullProject?.name || name,
      projectId: id,
      projectName: fullProject?.name || name,
      details: { status: fullProject?.status, managerId },
    }, req);

    res.json(fullProject);
  } catch (err: any) {
    await dbClient.query('ROLLBACK');
    console.error('Error updating project:', err);
    res.status(500).json({ error: err.message });
  } finally {
    dbClient.release();
  }
});

// PATCH project status
router.patch('/:id/status', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;
  const actorMemberId = (req as any).jwtUser?.memberId || (req.headers['x-user-member-id'] as string) || null;
  try {
    const pool = getPool();
    const result = await pool.query(
      `UPDATE projects 
       SET status = $1, 
           updated_by = COALESCE($2, updated_by), 
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = $3 RETURNING *`,
      [status, actorMemberId, id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Project not found' });

    const fullProject = await getProjectById(pool, id);

    recordActivity(pool, {
      actionType: 'update_project_status',
      entityType: 'project',
      entityId: id,
      entityName: fullProject?.name || result.rows[0].name,
      projectId: id,
      projectName: fullProject?.name || result.rows[0].name,
      details: { newStatus: status },
    }, req);

    res.json(fullProject || result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH project members
router.patch('/:id/members', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { memberIds } = req.body;
  const actorMemberId = (req as any).jwtUser?.memberId || (req.headers['x-user-member-id'] as string) || null;
  const pool = getPool();
  const dbClient = await pool.connect();

  try {
    await dbClient.query('BEGIN');
    await dbClient.query(`DELETE FROM project_members WHERE project_id = $1`, [id]);
    if (Array.isArray(memberIds)) {
      for (const memberId of memberIds) {
        await dbClient.query(
          `INSERT INTO project_members (project_id, member_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [id, memberId]
        );
      }
    }
    await dbClient.query(
      `UPDATE projects SET updated_by = COALESCE($1, updated_by), updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [actorMemberId, id]
    );
    await dbClient.query('COMMIT');

    const fullProject = await getProjectById(pool, id);
    res.json(fullProject || { projectId: id, memberIds });
  } catch (err: any) {
    await dbClient.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    dbClient.release();
  }
});

// DELETE project (Soft delete / Move to Recycle Bin)
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const actorMemberId = (req as any).jwtUser?.memberId || (req.headers['x-user-member-id'] as string) || null;
  const pool = getPool();
  const dbClient = await pool.connect();
  try {
    await dbClient.query('BEGIN');
    const result = await dbClient.query(
      `UPDATE projects SET deleted_at = CURRENT_TIMESTAMP, deleted_by = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND deleted_at IS NULL RETURNING id, name`,
      [id, actorMemberId]
    );
    if (result.rowCount === 0) {
      await dbClient.query('ROLLBACK');
      return res.status(404).json({ error: 'Project not found or already in Recycle Bin' });
    }
    const deletedProj = result.rows[0];

    // Cascade soft-delete active tasks belonging to this project
    await dbClient.query(
      `UPDATE tasks SET deleted_at = CURRENT_TIMESTAMP, deleted_by = $2, updated_at = CURRENT_TIMESTAMP WHERE project_id = $1 AND deleted_at IS NULL`,
      [id, actorMemberId]
    );

    await dbClient.query('COMMIT');

    recordActivity(pool, {
      actionType: 'delete_project',
      entityType: 'project',
      entityId: id,
      entityName: deletedProj.name,
      projectId: id,
      projectName: deletedProj.name,
    }, req);

    res.json({ message: 'Project moved to Recycle Bin', id });
  } catch (err: any) {
    await dbClient.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    dbClient.release();
  }
});

export default router;

