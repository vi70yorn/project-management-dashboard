import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { getPool, ensureDatabaseExists, runMigrationsAndSeed, checkConnection, dbConfig } from './db';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// ==========================================
// Health & Diagnostic Endpoints
// ==========================================

app.get('/api/health', async (_req: Request, res: Response) => {
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

// ==========================================
// Team Activity Logs Helper & Endpoints
// ==========================================

interface ActivityPayload {
  userId?: string | null;
  userName?: string;
  userAvatar?: string | null;
  actionType: string;
  entityType: 'task' | 'project';
  entityId: string;
  entityName: string;
  projectId?: string | null;
  projectName?: string | null;
  details?: Record<string, any>;
}

async function recordActivity(pool: any, data: ActivityPayload, req?: Request): Promise<void> {
  try {
    const id = `act-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    
    // Check if this is an automated system event (e.g. auto_complete_project)
    const isSystemAction = data.userName === 'System Automation';

    // The user who took action: ALWAYS prioritize the authenticated actor from request headers!
    const headerMemberId = (req?.headers['x-user-member-id'] as string) || null;
    const headerName = req?.headers['x-user-name'] ? decodeURIComponent(req.headers['x-user-name'] as string) : '';
    const headerAvatar = req?.headers['x-user-avatar'] ? decodeURIComponent(req.headers['x-user-avatar'] as string) : null;

    let userId: string | null = null;
    let userName: string = '';
    let userAvatar: string | null = null;

    if (isSystemAction) {
      userName = 'System Automation';
      userAvatar = null;
      userId = null;
    } else if (headerMemberId) {
      // Prioritize the user who performed this action via HTTP request
      userId = headerMemberId;
      userName = headerName;
      userAvatar = headerAvatar;
    } else if (data.userId) {
      userId = data.userId;
      userName = data.userName || '';
      userAvatar = data.userAvatar || null;
    } else {
      userName = data.userName || headerName || '';
      userAvatar = data.userAvatar || headerAvatar || null;
    }

    // Lookup latest profile from team_members if we have a userId
    if (userId) {
      const uRes = await pool.query('SELECT name, avatar FROM team_members WHERE id = $1', [userId]);
      if (uRes.rowCount > 0) {
        userName = uRes.rows[0].name || userName;
        userAvatar = uRes.rows[0].avatar !== undefined && uRes.rows[0].avatar !== null ? uRes.rows[0].avatar : userAvatar;
      }
    }

    if (!userName) {
      userName = 'Team Member';
    }

    let projectId = data.projectId;
    let projectName = data.projectName;

    if (data.entityType === 'task' && projectId && !projectName) {
      const pRes = await pool.query('SELECT name FROM projects WHERE id = $1', [projectId]);
      if (pRes.rowCount > 0) {
        projectName = pRes.rows[0].name;
      }
    }

    await pool.query(
      `INSERT INTO activity_logs (id, user_id, user_name, user_avatar, action_type, entity_type, entity_id, entity_name, project_id, project_name, details, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)`,
      [
        id,
        userId,
        userName,
        userAvatar,
        data.actionType,
        data.entityType,
        data.entityId,
        data.entityName,
        projectId || null,
        projectName || null,
        JSON.stringify(data.details || {}),
      ]
    );
  } catch (err: any) {
    console.error('[recordActivity exception]:', err.message);
  }
}

// GET recent team activities
app.get('/api/activities', async (req: Request, res: Response) => {
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

// POST create custom activity
app.post('/api/activities', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    await recordActivity(pool, req.body, req);
    res.status(201).json({ success: true, message: 'Activity recorded' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// Projects Endpoints
// ==========================================

// Helper: fetch full project with creator, updater, and memberIds
async function getProjectById(pool: any, id: string) {
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

// Helper: fetch full task with creator, updater, and project details
async function getTaskById(pool: any, id: string) {
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
      t.created_by AS "createdBy",
      COALESCE(cb_m.name, cb_u.name, 'Team Member') AS "createdByName",
      COALESCE(cb_m.avatar, cb_u.avatar) AS "createdByAvatar",
      t.updated_by AS "updatedBy",
      COALESCE(ub_m.name, ub_u.name, 'Team Member') AS "updatedByName",
      COALESCE(ub_m.avatar, ub_u.avatar) AS "updatedByAvatar",
      t.start_date AS "startDate",
      t.due_date AS "dueDate",
      t.created_at AS "createdAt",
      t.updated_at AS "updatedAt"
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

// GET all projects with their memberIds array and audit info
app.get('/api/projects', async (_req: Request, res: Response) => {
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
app.post('/api/projects', async (req: Request, res: Response) => {
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
    createdBy,
  } = req.body;

  const headerMemberId = (req.headers['x-user-member-id'] as string) || null;
  const effectiveCreatedBy = createdBy || headerMemberId || managerId || null;
  const projectId = id || `proj-${Date.now()}`;
  const pool = getPool();
  const dbClient = await pool.connect();

  try {
    await dbClient.query('BEGIN');

    const insertProjectQuery = `
      INSERT INTO projects (id, name, description, client, status, start_date, target_deadline, manager_id, tags, color, created_by, updated_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)
      RETURNING *;
    `;
    await dbClient.query(insertProjectQuery, [
      projectId,
      name,
      description,
      client,
      status,
      startDate,
      targetDeadline,
      managerId || null,
      tags,
      color,
      effectiveCreatedBy,
    ]);

    // Insert project members
    if (Array.isArray(memberIds) && memberIds.length > 0) {
      for (const memberId of memberIds) {
        await dbClient.query(
          `INSERT INTO project_members (project_id, member_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [projectId, memberId]
        );
      }
    }

    await dbClient.query('COMMIT');

    recordActivity(pool, {
      actionType: 'create_project',
      entityType: 'project',
      entityId: projectId,
      entityName: name,
      projectId: projectId,
      projectName: name,
      details: { status, client, managerId },
    }, req);

    const fullProject = await getProjectById(pool, projectId);
    res.status(201).json(fullProject || {
      id: projectId,
      name,
      description,
      client,
      status,
      startDate,
      targetDeadline,
      managerId,
      tags,
      color,
      memberIds,
      createdBy: effectiveCreatedBy,
      updatedBy: effectiveCreatedBy,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    await dbClient.query('ROLLBACK');
    console.error('Error creating project:', err);
    res.status(500).json({ error: err.message });
  } finally {
    dbClient.release();
  }
});

// PUT update project
app.put('/api/projects/:id', async (req: Request, res: Response) => {
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
    memberIds,
    updatedBy,
  } = req.body;

  const headerMemberId = (req.headers['x-user-member-id'] as string) || null;
  const effectiveUpdatedBy = updatedBy || headerMemberId || null;

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
        updated_by = COALESCE($10, updated_by),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $11
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
app.patch('/api/projects/:id/status', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;
  const actorMemberId = (req.headers['x-user-member-id'] as string) || null;
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
app.patch('/api/projects/:id/members', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { memberIds } = req.body;
  const actorMemberId = (req.headers['x-user-member-id'] as string) || null;
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
app.delete('/api/projects/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const actorMemberId = (req.headers['x-user-member-id'] as string) || null;
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

// ==========================================
// Tasks Endpoints
// ==========================================

// GET all tasks
app.get('/api/tasks', async (_req: Request, res: Response) => {
  try {
    const pool = getPool();
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
        t.created_by AS "createdBy",
        COALESCE(cb_m.name, cb_u.name, 'Team Member') AS "createdByName",
        COALESCE(cb_m.avatar, cb_u.avatar) AS "createdByAvatar",
        t.updated_by AS "updatedBy",
        COALESCE(ub_m.name, ub_u.name, 'Team Member') AS "updatedByName",
        COALESCE(ub_m.avatar, ub_u.avatar) AS "updatedByAvatar",
        t.start_date AS "startDate",
        t.due_date AS "dueDate",
        t.created_at AS "createdAt",
        t.updated_at AS "updatedAt"
      FROM tasks t
      LEFT JOIN projects p ON p.id = t.project_id
      LEFT JOIN team_members cb_m ON cb_m.id = t.created_by
      LEFT JOIN users cb_u ON cb_u.member_id = t.created_by
      LEFT JOIN team_members ub_m ON ub_m.id = t.updated_by
      LEFT JOIN users ub_u ON ub_u.member_id = t.updated_by
      WHERE t.deleted_at IS NULL
      ORDER BY t.created_at DESC;
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err: any) {
    console.error('Error fetching tasks:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Automatically synchronizes a project's status based on its task completion states:
 * - If all tasks are 'Completed' (and task count > 0) -> update project status to 'Completed'.
 * - If project is 'Completed' but has non-completed tasks -> revert project to 'In Progress' or 'Blocked'.
 * - If project is 'Blocked' and has 0 blocked tasks remaining -> unblock to 'In Progress'.
 */
async function syncProjectStatus(pool: any, projectId: string) {
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

// POST create task
app.post('/api/tasks', async (req: Request, res: Response) => {
  const {
    id,
    projectId,
    title,
    description = '',
    status = 'In Progress',
    priority = 'Medium',
    assigneeId,
    createdBy,
    startDate,
    dueDate,
  } = req.body;

  const actorMemberId = (req.headers['x-user-member-id'] as string) || null;
  const effectiveCreatedBy = createdBy || actorMemberId || assigneeId || null;
  const taskId = id || `task-${Date.now()}`;
  try {
    const pool = getPool();
    const query = `
      INSERT INTO tasks (id, project_id, title, description, status, priority, assignee_id, created_by, updated_by, start_date, due_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, $9, $10)
      RETURNING id;
    `;
    await pool.query(query, [
      taskId,
      projectId,
      title,
      description,
      status,
      priority,
      assigneeId || null,
      effectiveCreatedBy,
      startDate || null,
      dueDate,
    ]);

    const createdTask = await getTaskById(pool, taskId);
    if (createdTask?.projectId) {
      await syncProjectStatus(pool, createdTask.projectId);
    }

    recordActivity(pool, {
      actionType: 'create_task',
      entityType: 'task',
      entityId: taskId,
      entityName: title,
      projectId: projectId,
      details: { status, priority, assigneeId },
    }, req);

    res.status(201).json(createdTask || {
      id: taskId,
      projectId,
      title,
      description,
      status,
      priority,
      assigneeId,
      createdBy: effectiveCreatedBy,
      updatedBy: effectiveCreatedBy,
      startDate,
      dueDate,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Error creating task:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT update task
app.put('/api/tasks/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    projectId,
    title,
    description,
    status,
    priority,
    assigneeId,
    createdBy,
    startDate,
    dueDate,
    updatedBy,
  } = req.body;

  const actorMemberId = (req.headers['x-user-member-id'] as string) || null;
  const effectiveUpdatedBy = updatedBy || actorMemberId || null;

  try {
    const pool = getPool();
    const query = `
      UPDATE tasks
      SET 
        project_id = COALESCE($1, project_id),
        title = COALESCE($2, title),
        description = COALESCE($3, description),
        status = COALESCE($4, status),
        priority = COALESCE($5, priority),
        assignee_id = $6,
        created_by = COALESCE($7, created_by),
        start_date = $8,
        due_date = COALESCE($9, due_date),
        updated_by = COALESCE($10, updated_by),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $11
      RETURNING id, project_id AS "projectId";
    `;
    const result = await pool.query(query, [
      projectId,
      title,
      description,
      status,
      priority,
      assigneeId || null,
      createdBy,
      startDate || null,
      dueDate,
      effectiveUpdatedBy,
      id,
    ]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Task not found' });
    
    const updatedTask = await getTaskById(pool, id);
    if (updatedTask?.projectId) {
      await syncProjectStatus(pool, updatedTask.projectId);
    }

    recordActivity(pool, {
      actionType: 'update_task',
      entityType: 'task',
      entityId: id,
      entityName: updatedTask?.title || title,
      projectId: updatedTask?.projectId || projectId,
      details: { status: updatedTask?.status || status, priority: updatedTask?.priority || priority, assigneeId: updatedTask?.assigneeId || assigneeId },
    }, req);

    res.json(updatedTask);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH task status
app.patch('/api/tasks/:id/status', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;
  const actorMemberId = (req.headers['x-user-member-id'] as string) || null;
  try {
    const pool = getPool();
    const result = await pool.query(
      `UPDATE tasks 
       SET status = $1, 
           updated_by = COALESCE($2, updated_by), 
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = $3 
       RETURNING id, project_id AS "projectId", title, status, updated_at AS "updatedAt"`,
      [status, actorMemberId, id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Task not found' });
    
    const updatedTask = await getTaskById(pool, id);
    if (updatedTask?.projectId) {
      await syncProjectStatus(pool, updatedTask.projectId);
    }

    recordActivity(pool, {
      actionType: 'update_task_status',
      entityType: 'task',
      entityId: id,
      entityName: updatedTask?.title || result.rows[0].title,
      projectId: updatedTask?.projectId || result.rows[0].projectId,
      details: { newStatus: status },
    }, req);

    res.json(updatedTask || result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE task (Soft delete / Move to Recycle Bin)
app.delete('/api/tasks/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const actorMemberId = (req.headers['x-user-member-id'] as string) || null;
  try {
    const pool = getPool();
    const result = await pool.query(
      `UPDATE tasks SET deleted_at = CURRENT_TIMESTAMP, deleted_by = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND deleted_at IS NULL RETURNING id, title, project_id AS "projectId"`,
      [id, actorMemberId]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Task not found or already in Recycle Bin' });
    const deletedTask = result.rows[0];
    if (deletedTask?.projectId) {
      await syncProjectStatus(pool, deletedTask.projectId);
    }

    recordActivity(pool, {
      actionType: 'delete_task',
      entityType: 'task',
      entityId: id,
      entityName: deletedTask.title,
      projectId: deletedTask.projectId,
    }, req);

    res.json({ message: 'Task moved to Recycle Bin', id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// Recycle Bin Endpoints
// ==========================================

// GET all items in the recycle bin
app.get('/api/recycle-bin', async (_req: Request, res: Response) => {
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
          p.name AS "projectName",
          t.title,
          t.description,
          t.status,
          t.priority,
          t.assignee_id AS "assigneeId",
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
app.post('/api/recycle-bin/restore', async (req: Request, res: Response) => {
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

// DELETE permanently delete a single item from recycle bin
app.delete('/api/recycle-bin/:type/:id', async (req: Request, res: Response) => {
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

// DELETE empty entire recycle bin
app.delete('/api/recycle-bin', async (_req: Request, res: Response) => {
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

// ==========================================
// Team Members Endpoints
// ==========================================

// ==========================================
// Authentication & Password Management Endpoints
// ==========================================

// POST login
app.post('/api/auth/login', async (req: Request, res: Response) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const pool = getPool();
    const query = `
      SELECT 
        id,
        name,
        username,
        password,
        email,
        role,
        system_role AS "systemRole",
        avatar,
        color,
        status,
        department,
        created_at AS "createdAt"
      FROM team_members 
      WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1);
    `;
    const result = await pool.query(query, [username.trim()]);

    if (result.rowCount === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const member = result.rows[0];

    if (!member.password || member.password !== password) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const authUser = {
      id: `usr-${member.id}`,
      name: member.name,
      username: member.username,
      email: member.email,
      role: member.systemRole || 'staff',
      memberId: member.id,
      avatar: member.avatar,
      department: member.department,
      jobRole: member.role,
    };

    res.json({ status: 'ok', user: authUser });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST change password (for any user role with current password verification)
app.post('/api/auth/change-password', async (req: Request, res: Response) => {
  const { memberId, currentPassword, newPassword } = req.body;

  if (!memberId || !currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Member ID, current password, and new password are required' });
  }

  if (newPassword.length < 4) {
    return res.status(400).json({ error: 'New password must be at least 4 characters' });
  }

  try {
    const pool = getPool();
    const checkRes = await pool.query(`SELECT id, password FROM team_members WHERE id = $1`, [memberId]);

    if (checkRes.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (checkRes.rows[0].password !== currentPassword) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    await pool.query(`UPDATE team_members SET password = $1 WHERE id = $2`, [newPassword, memberId]);
    res.json({ status: 'ok', message: 'Password updated successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST admin reset password for staff member (or any member)
app.post('/api/auth/admin-reset-password', async (req: Request, res: Response) => {
  const callerRole = (req.headers['x-user-role'] as string) || '';
  if (callerRole !== 'admin') {
    return res.status(403).json({ error: 'Permission denied. Only admins can modify other members\' passwords.' });
  }

  const { memberId, newPassword } = req.body;
  if (!memberId || !newPassword) {
    return res.status(400).json({ error: 'Member ID and new password are required' });
  }

  if (newPassword.length < 4) {
    return res.status(400).json({ error: 'New password must be at least 4 characters' });
  }

  try {
    const pool = getPool();
    const result = await pool.query(`UPDATE team_members SET password = $1 WHERE id = $2 RETURNING id, name, username`, [
      newPassword,
      memberId,
    ]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Member not found' });
    }

    res.json({ status: 'ok', message: 'Password updated successfully by admin', member: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// Team Members Endpoints
// ==========================================

// GET all team members
app.get('/api/members', async (req: Request, res: Response) => {
  const callerRole = (req.headers['x-user-role'] as string) || '';
  const isAdmin = callerRole === 'admin';

  try {
    const pool = getPool();
    const query = `
      SELECT 
        id,
        name,
        username,
        ${isAdmin ? 'password,' : ''}
        email,
        role,
        system_role AS "systemRole",
        avatar,
        color,
        status,
        department,
        created_at AS "createdAt"
      FROM team_members
      ORDER BY name ASC;
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST create team member (admin only)
app.post('/api/members', async (req: Request, res: Response) => {
  const callerRole = (req.headers['x-user-role'] as string) || '';
  if (callerRole !== 'admin') {
    return res.status(403).json({ error: 'Permission denied. Team members can only be created by admin.' });
  }

  const {
    id,
    name,
    username,
    password,
    email,
    role,
    systemRole = 'staff',
    avatar,
    color = '#2563eb',
    status = 'active',
    department,
  } = req.body;

  if (!username || !username.trim()) {
    return res.status(400).json({ error: 'Username is required' });
  }

  if (!password || !password.trim()) {
    return res.status(400).json({ error: 'Password is required' });
  }

  const memberId = id || `mem-${Date.now()}`;
  const cleanUsername = username.trim().toLowerCase();

  try {
    const pool = getPool();

    // Check duplicate username
    const existing = await pool.query(`SELECT id FROM team_members WHERE LOWER(username) = $1`, [cleanUsername]);
    if (existing.rowCount && existing.rowCount > 0) {
      return res.status(400).json({ error: `Username "${cleanUsername}" is already taken.` });
    }

    const query = `
      INSERT INTO team_members (id, name, username, password, email, role, system_role, avatar, color, status, department)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING 
        id, name, username, password, email, role, system_role AS "systemRole", avatar, color, status, department, created_at AS "createdAt";
    `;
    const result = await pool.query(query, [
      memberId,
      name,
      cleanUsername,
      password,
      email,
      role,
      systemRole,
      avatar || null,
      color,
      status,
      department,
    ]);
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    console.error('Error creating member:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT update team member
app.put('/api/members/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const callerRole = (req.headers['x-user-role'] as string) || '';
  const callerMemberId = (req.headers['x-user-member-id'] as string) || '';
  const isAdmin = callerRole === 'admin';
  const isSelf = callerMemberId === id;

  if (!isAdmin && !isSelf) {
    return res.status(403).json({ error: 'Permission denied. You can only update your own user info.' });
  }

  const { name, username, password, email, role, systemRole, avatar, color, status, department } = req.body;

  try {
    const pool = getPool();

    // Check if username is being changed and conflicts
    if (username) {
      const conflictCheck = await pool.query(
        `SELECT id FROM team_members WHERE LOWER(username) = LOWER($1) AND id != $2`,
        [username.trim(), id]
      );
      if (conflictCheck.rowCount && conflictCheck.rowCount > 0) {
        return res.status(400).json({ error: `Username "${username}" is already in use.` });
      }
    }

    // Only Admin can change systemRole or update password directly here
    const query = `
      UPDATE team_members
      SET 
        name = COALESCE($1, name),
        username = COALESCE($2, username),
        ${isAdmin && password ? 'password = $3,' : ''}
        email = COALESCE($4, email),
        role = COALESCE($5, role),
        ${isAdmin ? 'system_role = COALESCE($6, system_role),' : ''}
        avatar = COALESCE($7, avatar),
        color = COALESCE($8, color),
        status = COALESCE($9, status),
        department = COALESCE($10, department)
      WHERE id = $11
      RETURNING 
        id, name, username, ${isAdmin ? 'password,' : ''} email, role, system_role AS "systemRole", avatar, color, status, department, created_at AS "createdAt";
    `;

    const result = await pool.query(query, [
      name,
      username ? username.trim().toLowerCase() : null,
      password || null,
      email,
      role,
      systemRole,
      avatar,
      color,
      status,
      department,
      id,
    ]);

    if (result.rowCount === 0) return res.status(404).json({ error: 'Member not found' });
    res.json(result.rows[0]);
  } catch (err: any) {
    console.error('Error updating member:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE team member (admin only)
app.delete('/api/members/:id', async (req: Request, res: Response) => {
  const callerRole = (req.headers['x-user-role'] as string) || '';
  if (callerRole !== 'admin') {
    return res.status(403).json({ error: 'Permission denied. Only admin can delete team members.' });
  }

  const { id } = req.params;
  try {
    const pool = getPool();
    const result = await pool.query(`DELETE FROM team_members WHERE id = $1 RETURNING id`, [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Member not found' });
    res.json({ message: 'Team member deleted', id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// Telegram Automated Weekly Report Endpoints
// ==========================================

function escapeTelegramHtml(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function splitTelegramMessage(text: string, maxLength = 3900): string[] {
  if (text.length <= maxLength) return [text];
  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }
    let splitIdx = remaining.lastIndexOf('\n\n', maxLength);
    if (splitIdx === -1 || splitIdx < maxLength / 2) {
      splitIdx = remaining.lastIndexOf('\n', maxLength);
    }
    if (splitIdx === -1 || splitIdx < maxLength / 2) {
      splitIdx = maxLength;
    }
    chunks.push(remaining.slice(0, splitIdx).trim());
    remaining = remaining.slice(splitIdx).trim();
  }
  return chunks;
}

async function sendTelegramMessage(botToken: string, chatId: string, text: string): Promise<{ ok: boolean; message?: string }> {
  if (!botToken || !chatId) {
    return { ok: false, message: 'Telegram Bot Token and Chat ID are required.' };
  }
  const cleanToken = botToken.trim();
  const cleanChatId = chatId.trim();
  const url = `https://api.telegram.org/bot${cleanToken}/sendMessage`;
  const chunks = splitTelegramMessage(text, 3900);

  try {
    for (const chunk of chunks) {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: cleanChatId,
          text: chunk,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
      });
      const data: any = await res.json();
      if (!data.ok) {
        return { ok: false, message: data.description || 'Telegram API rejected message' };
      }
      if (chunks.length > 1) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, message: err.message || 'Network error reaching Telegram API' };
  }
}

async function generateTelegramWeeklyReport(pool: any): Promise<string> {
  const [projectsRes, tasksRes, membersRes] = await Promise.all([
    pool.query('SELECT * FROM projects WHERE deleted_at IS NULL ORDER BY created_at ASC'),
    pool.query('SELECT * FROM tasks WHERE deleted_at IS NULL ORDER BY created_at ASC'),
    pool.query('SELECT * FROM team_members ORDER BY name ASC'),
  ]);

  const projects = projectsRes.rows;
  const tasks = tasksRes.rows;
  const members = membersRes.rows;

  const now = new Date();
  const day = now.getDay();
  const isoDay = day === 0 ? 7 : day;
  const monday = new Date(now);
  monday.setDate(now.getDate() - (isoDay - 1) - 7);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);

  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const periodLabel = `${fmt(monday)} – ${fmt(friday)}`;

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t: any) => t.status === 'Completed').length;
  const blockedTasks = tasks.filter((t: any) => t.status === 'Blocked').length;
  const overallRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  let text = `📊 <b>WEEKLY PROJECT STATUS REPORT</b>\n`;
  text += `📅 <b>Working Week:</b> ${periodLabel} (Mon – Fri)\n`;
  text += `📈 <b>Overall Completion:</b> ${overallRate}% (${completedTasks}/${totalTasks} Tasks)\n`;
  if (blockedTasks > 0) {
    text += `⚠️ <b>Blocked Items:</b> ${blockedTasks} (Attention Needed)\n`;
  }
  text += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

  projects.forEach((p: any, idx: number) => {
    const pTasks = tasks.filter((t: any) => t.project_id === p.id);
    const pCompleted = pTasks.filter((t: any) => t.status === 'Completed');
    const pInProgress = pTasks.filter((t: any) => t.status === 'In Progress');
    const pReadyReview = pTasks.filter((t: any) => t.status === 'Ready Review' || t.status === 'Pending');
    const pBlocked = pTasks.filter((t: any) => t.status === 'Blocked');
    const pOther = pTasks.filter((t: any) => !['Completed', 'In Progress', 'Ready Review', 'Pending', 'Blocked'].includes(t.status));
    const pPercent = pTasks.length > 0 ? Math.round((pCompleted.length / pTasks.length) * 100) : 0;

    const statusEmoji = p.status === 'Completed' ? '✅' : p.status === 'Blocked' ? '🛑' : '🚀';

    text += `${idx + 1}. ${statusEmoji} <b>${escapeTelegramHtml(p.name.toUpperCase())}</b>\n`;
    text += `   • <b>Status:</b> ${escapeTelegramHtml(p.status)} | <b>Progress:</b> ${pPercent}%\n`;
    if (p.client) {
      text += `   • <b>Client:</b> ${escapeTelegramHtml(p.client)}\n`;
    }

    // 1. Done / Completed tasks (All)
    if (pCompleted.length > 0) {
      text += `   • <b>Done:</b>\n`;
      pCompleted.forEach((t: any) => {
        const assignee = members.find((m: any) => m.id === t.assignee_id)?.name || 'Unassigned';
        text += `     ✓ ${escapeTelegramHtml(t.title)} (${escapeTelegramHtml(assignee)})\n`;
      });
    }

    // 2. In Progress tasks (All)
    if (pInProgress.length > 0) {
      text += `   • <b>In Progress:</b>\n`;
      pInProgress.forEach((t: any) => {
        const assignee = members.find((m: any) => m.id === t.assignee_id)?.name || 'Unassigned';
        text += `     ⏳ ${escapeTelegramHtml(t.title)} [In Progress] (${escapeTelegramHtml(assignee)})\n`;
      });
    }

    // 3. Ready Review tasks (All)
    if (pReadyReview.length > 0) {
      text += `   • <b>Ready Review:</b>\n`;
      pReadyReview.forEach((t: any) => {
        const assignee = members.find((m: any) => m.id === t.assignee_id)?.name || 'Unassigned';
        text += `     📋 ${escapeTelegramHtml(t.title)} [Ready Review] (${escapeTelegramHtml(assignee)})\n`;
      });
    }

    // 4. Blocked tasks (All)
    if (pBlocked.length > 0) {
      text += `   • <b>Blocked:</b>\n`;
      pBlocked.forEach((t: any) => {
        const assignee = members.find((m: any) => m.id === t.assignee_id)?.name || 'Unassigned';
        text += `     ⚠️ ${escapeTelegramHtml(t.title)} [Blocked] (${escapeTelegramHtml(assignee)})\n`;
      });
    }

    // 5. Other custom statuses (if any exist)
    if (pOther.length > 0) {
      text += `   • <b>Other:</b>\n`;
      pOther.forEach((t: any) => {
        const assignee = members.find((m: any) => m.id === t.assignee_id)?.name || 'Unassigned';
        text += `     • ${escapeTelegramHtml(t.title)} [${escapeTelegramHtml(t.status)}] (${escapeTelegramHtml(assignee)})\n`;
      });
    }

    if (pTasks.length === 0) {
      text += `   • <i>No tasks</i>\n`;
    }

    text += `\n`;
  });

  text += `━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `<i>Sent automatically by Project Management Dashboard</i>`;
  return text;
}

// GET Telegram Settings
app.get('/api/telegram/settings', async (_req: Request, res: Response) => {
  try {
    const pool = getPool();
    const result = await pool.query('SELECT * FROM telegram_settings WHERE id = $1', ['default']);
    const now = new Date();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const serverCurrentDay = dayNames[now.getDay()];
    const serverCurrentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    if (result.rowCount === 0) {
      return res.json({
        enabled: false,
        hasToken: false,
        botTokenMasked: '',
        chatId: '',
        sendDay: 'Monday',
        sendTime: '08:00',
        lastSentAt: null,
        lastAutoSentDate: null,
        serverCurrentDay,
        serverCurrentTime,
      });
    }
    const row = result.rows[0];
    const hasToken = !!(row.bot_token && row.bot_token.trim().length > 0);
    const botTokenMasked = hasToken
      ? `${row.bot_token.slice(0, 6)}••••••••${row.bot_token.slice(-4)}`
      : '';

    res.json({
      enabled: !!row.enabled,
      hasToken,
      botTokenMasked,
      chatId: row.chat_id || '',
      sendDay: row.send_day || 'Monday',
      sendTime: row.send_time || '08:00',
      lastSentAt: row.last_sent_at || null,
      lastAutoSentDate: row.last_auto_sent_date || null,
      serverCurrentDay,
      serverCurrentTime,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST update Telegram Settings
app.post('/api/telegram/settings', async (req: Request, res: Response) => {
  const { botToken, chatId, enabled, sendDay, sendTime } = req.body;
  try {
    const pool = getPool();
    let query: string;
    let params: any[];

    if (botToken !== undefined && botToken.trim().length > 0) {
      query = `
        INSERT INTO telegram_settings (id, bot_token, chat_id, enabled, send_day, send_time, last_auto_sent_date, updated_at)
        VALUES ('default', $1, $2, $3, $4, $5, NULL, CURRENT_TIMESTAMP)
        ON CONFLICT (id) DO UPDATE SET
          bot_token = EXCLUDED.bot_token,
          chat_id = EXCLUDED.chat_id,
          enabled = EXCLUDED.enabled,
          send_day = EXCLUDED.send_day,
          send_time = EXCLUDED.send_time,
          last_auto_sent_date = NULL,
          updated_at = CURRENT_TIMESTAMP
        RETURNING id, chat_id AS "chatId", enabled, send_day AS "sendDay", send_time AS "sendTime", last_sent_at AS "lastSentAt", last_auto_sent_date AS "lastAutoSentDate"
      `;
      params = [botToken.trim(), (chatId || '').trim(), !!enabled, sendDay || 'Monday', sendTime || '08:00'];
    } else {
      query = `
        UPDATE telegram_settings
        SET 
          chat_id = COALESCE($1, chat_id),
          enabled = COALESCE($2, enabled),
          send_day = COALESCE($3, send_day),
          send_time = COALESCE($4, send_time),
          last_auto_sent_date = NULL,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = 'default'
        RETURNING id, chat_id AS "chatId", enabled, send_day AS "sendDay", send_time AS "sendTime", last_sent_at AS "lastSentAt", last_auto_sent_date AS "lastAutoSentDate"
      `;
      params = [(chatId || '').trim(), !!enabled, sendDay || 'Monday', sendTime || '08:00'];
    }

    const result = await pool.query(query, params);
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST test Telegram connection
app.post('/api/telegram/test', async (req: Request, res: Response) => {
  const { botToken, chatId } = req.body;
  try {
    const pool = getPool();
    let token = botToken?.trim();
    let chat = chatId?.trim();

    if (!token || !chat) {
      const dbSettings = await pool.query('SELECT bot_token, chat_id FROM telegram_settings WHERE id = $1', ['default']);
      if (dbSettings.rowCount > 0) {
        if (!token) token = dbSettings.rows[0].bot_token;
        if (!chat) chat = dbSettings.rows[0].chat_id;
      }
    }

    if (!token || !chat) {
      return res.status(400).json({ error: 'Both Telegram Bot Token and Chat ID are required to send a test message.' });
    }

    const testMsg = `🚀 <b>Telegram Connection Verified!</b>\n\nYour Project Management Dashboard is now connected to Telegram.\n\n📅 <b>Schedule:</b> Automated Weekly Reports will be sent every Monday at the configured time.`;
    const sendResult = await sendTelegramMessage(token, chat, testMsg);

    if (!sendResult.ok) {
      return res.status(400).json({ error: sendResult.message });
    }

    res.json({ success: true, message: 'Test message sent successfully to Telegram!' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST trigger instant weekly report delivery
app.post('/api/telegram/send-report', async (_req: Request, res: Response) => {
  try {
    const pool = getPool();
    const result = await pool.query('SELECT bot_token, chat_id FROM telegram_settings WHERE id = $1', ['default']);
    if (result.rowCount === 0 || !result.rows[0].bot_token || !result.rows[0].chat_id) {
      return res.status(400).json({ error: 'Telegram is not configured yet. Please configure your Bot Token and Chat ID first.' });
    }

    const { bot_token, chat_id } = result.rows[0];
    const reportText = await generateTelegramWeeklyReport(pool);
    const sendResult = await sendTelegramMessage(bot_token, chat_id, reportText);

    if (!sendResult.ok) {
      return res.status(400).json({ error: sendResult.message });
    }

    await pool.query('UPDATE telegram_settings SET last_sent_at = CURRENT_TIMESTAMP WHERE id = $1', ['default']);
    res.json({ success: true, message: 'Weekly Project Summary sent to Telegram successfully!' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Background Automated Telegram Scheduler
function startTelegramWeeklyScheduler() {
  console.log('[Telegram Scheduler] Automated Telegram weekly report scheduler initialized.');

  setInterval(async () => {
    try {
      const pool = getPool();
      const res = await pool.query('SELECT * FROM telegram_settings WHERE id = $1', ['default']);
      if (res.rowCount === 0) return;

      const settings = res.rows[0];
      if (!settings.enabled || !settings.bot_token || !settings.chat_id) return;

      const now = new Date();
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const currentDayName = dayNames[now.getDay()]; // e.g. "Monday"
      const targetDay = settings.send_day || 'Monday';

      // Day check: matches if Daily/Everyday OR if day name matches (case-insensitive)
      const isDaily = targetDay.toLowerCase() === 'daily' || targetDay.toLowerCase() === 'everyday';
      const isScheduledDay = isDaily || currentDayName.toLowerCase() === targetDay.toLowerCase();
      if (!isScheduledDay) return;

      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      const todayDateStr = `${y}-${m}-${d}`; // e.g. "2026-09-07"

      // Avoid duplicate auto-send if already sent on this calendar date
      if (settings.last_auto_sent_date === todayDateStr) {
        return;
      }

      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const currentTime = `${hours}:${minutes}`;
      const targetTime = settings.send_time || '08:00';

      // Check if current time has reached or passed the target time
      if (currentTime < targetTime) return;

      // Calculate time difference in minutes between current and target
      const [currH, currM] = currentTime.split(':').map(Number);
      const [targetH, targetM] = targetTime.split(':').map(Number);
      const diffMinutes = (currH * 60 + currM) - (targetH * 60 + targetM);

      // Only catch up if within 180 minutes (3 hours) of the target time
      if (diffMinutes > 180) {
        return;
      }

      console.log(`[Telegram Scheduler] Scheduled trigger: ${currentDayName} ${currentTime} (Target: ${targetDay} ${targetTime}). Dispatching automated report...`);
      const reportText = await generateTelegramWeeklyReport(pool);
      const sendRes = await sendTelegramMessage(settings.bot_token, settings.chat_id, reportText);

      if (sendRes.ok) {
        console.log(`[Telegram Scheduler] Auto-report sent successfully to Telegram chat ${settings.chat_id}.`);
        await pool.query(
          'UPDATE telegram_settings SET last_sent_at = CURRENT_TIMESTAMP, last_auto_sent_date = $1 WHERE id = $2',
          [todayDateStr, 'default']
        );
      } else {
        console.error('[Telegram Scheduler] Failed to send report to Telegram:', sendRes.message);
      }
    } catch (err: any) {
      console.error('[Telegram Scheduler Exception]:', err.message);
    }
  }, 15000);
}

// ==========================================
// Recycle Bin 7-Day Auto-Purge Scheduler
// ==========================================

async function purgeExpiredRecycleBinItems(pool: any): Promise<void> {
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

function startRecycleBinPurgeScheduler() {
  const pool = getPool();
  // Run once on startup
  purgeExpiredRecycleBinItems(pool);
  // Run every 1 hour (3600000 ms)
  setInterval(() => {
    purgeExpiredRecycleBinItems(pool);
  }, 3600000);
  console.log('[Recycle Bin Auto-Purge] 7-day retention scheduler registered (checks every 1 hour).');
}

// ==========================================
// Serve Static Frontend (Single-Service Deployment)
// ==========================================

const distPath = path.resolve(process.cwd(), 'dist');
if (fs.existsSync(distPath)) {
  console.log(`[Server] Serving static frontend from: ${distPath}`);
  app.use(express.static(distPath));
  app.get('*', (req: Request, res: Response) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(distPath, 'index.html'));
    }
  });
}

// ==========================================
// Start Server & Bootstrap Database
// ==========================================

async function startServer() {
  try {
    console.log('[Server] Checking PostgreSQL database initialization...');
    await ensureDatabaseExists();
    await runMigrationsAndSeed();
    console.log('[Server] Database initialization completed successfully.');

    // Start background schedulers
    startTelegramWeeklyScheduler();
    startRecycleBinPurgeScheduler();
  } catch (err: any) {
    console.error('[Server] Warning: Failed to auto-initialize database on startup:', err.message);
    console.error('[Server] If PostgreSQL credentials are needed, please verify your .env file.');
  }

  app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`🚀 API Server running at: http://localhost:${PORT}`);
    console.log(`🐘 PostgreSQL Host: ${dbConfig.host}:${dbConfig.port}`);
    console.log(`🗄️ Database: ${dbConfig.database}`);
    console.log(`🛠️ DBeaver can connect to this same database now!`);
    console.log(`=======================================================`);
  });
}

startServer();
