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
      pool.query('SELECT COUNT(*) FROM projects'),
      pool.query('SELECT COUNT(*) FROM tasks'),
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

// GET all projects with their memberIds array
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
        p.created_at AS "createdAt",
        p.updated_at AS "updatedAt",
        COALESCE(
          (SELECT array_agg(pm.member_id) FROM project_members pm WHERE pm.project_id = p.id),
          '{}'
        ) AS "memberIds"
      FROM projects p
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
    status = 'Pending',
    startDate,
    targetDeadline,
    managerId,
    tags = [],
    color = '#2563eb',
    memberIds = [],
  } = req.body;

  const projectId = id || `proj-${Date.now()}`;
  const pool = getPool();
  const dbClient = await pool.connect();

  try {
    await dbClient.query('BEGIN');

    const insertProjectQuery = `
      INSERT INTO projects (id, name, description, client, status, start_date, target_deadline, manager_id, tags, color)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
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

    res.status(201).json({
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
      createdAt: new Date().toISOString(),
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
  } = req.body;

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
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $10
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
    const updatedProj = result.rows[0];

    recordActivity(pool, {
      actionType: 'update_project',
      entityType: 'project',
      entityId: id,
      entityName: updatedProj?.name || name,
      projectId: id,
      projectName: updatedProj?.name || name,
      details: { status: updatedProj?.status, managerId },
    }, req);

    res.json({ ...updatedProj, memberIds });
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
  try {
    const pool = getPool();
    const result = await pool.query(
      `UPDATE projects SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
      [status, id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Project not found' });
    const updated = result.rows[0];

    recordActivity(pool, {
      actionType: 'update_project_status',
      entityType: 'project',
      entityId: id,
      entityName: updated.name,
      projectId: id,
      projectName: updated.name,
      details: { newStatus: status },
    }, req);

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH project members
app.patch('/api/projects/:id/members', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { memberIds } = req.body;
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
    await dbClient.query('COMMIT');
    res.json({ projectId: id, memberIds });
  } catch (err: any) {
    await dbClient.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    dbClient.release();
  }
});

// DELETE project
app.delete('/api/projects/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const pool = getPool();
    const result = await pool.query(`DELETE FROM projects WHERE id = $1 RETURNING id, name`, [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Project not found' });
    const deletedProj = result.rows[0];

    recordActivity(pool, {
      actionType: 'delete_project',
      entityType: 'project',
      entityId: id,
      entityName: deletedProj.name,
      projectId: id,
      projectName: deletedProj.name,
    }, req);

    res.json({ message: 'Project deleted successfully', id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
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
        t.title,
        t.description,
        t.status,
        t.priority,
        t.assignee_id AS "assigneeId",
        t.created_by AS "createdBy",
        t.start_date AS "startDate",
        t.due_date AS "dueDate",
        t.created_at AS "createdAt",
        t.updated_at AS "updatedAt"
      FROM tasks t
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
       WHERE project_id = $1`,
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

  const taskId = id || `task-${Date.now()}`;
  try {
    const pool = getPool();
    const query = `
      INSERT INTO tasks (id, project_id, title, description, status, priority, assignee_id, created_by, start_date, due_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING 
        id,
        project_id AS "projectId",
        title,
        description,
        status,
        priority,
        assignee_id AS "assigneeId",
        created_by AS "createdBy",
        start_date AS "startDate",
        due_date AS "dueDate",
        created_at AS "createdAt",
        updated_at AS "updatedAt";
    `;
    const result = await pool.query(query, [
      taskId,
      projectId,
      title,
      description,
      status,
      priority,
      assigneeId || null,
      createdBy || null,
      startDate || null,
      dueDate,
    ]);
    const createdTask = result.rows[0];
    if (createdTask?.projectId) {
      await syncProjectStatus(pool, createdTask.projectId);
    }

    recordActivity(pool, {
      actionType: 'create_task',
      entityType: 'task',
      entityId: createdTask.id,
      entityName: createdTask.title,
      projectId: createdTask.projectId,
      details: { status: createdTask.status, priority: createdTask.priority, assigneeId: createdTask.assigneeId },
    }, req);

    res.status(201).json(createdTask);
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
  } = req.body;

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
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $10
      RETURNING 
        id,
        project_id AS "projectId",
        title,
        description,
        status,
        priority,
        assignee_id AS "assigneeId",
        created_by AS "createdBy",
        start_date AS "startDate",
        due_date AS "dueDate",
        created_at AS "createdAt",
        updated_at AS "updatedAt";
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
      id,
    ]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Task not found' });
    const updatedTask = result.rows[0];
    if (updatedTask?.projectId) {
      await syncProjectStatus(pool, updatedTask.projectId);
    }

    recordActivity(pool, {
      actionType: 'update_task',
      entityType: 'task',
      entityId: updatedTask.id,
      entityName: updatedTask.title,
      projectId: updatedTask.projectId,
      details: { status: updatedTask.status, priority: updatedTask.priority, assigneeId: updatedTask.assigneeId },
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
  try {
    const pool = getPool();
    const result = await pool.query(
      `UPDATE tasks SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 
       RETURNING id, project_id AS "projectId", title, status, updated_at AS "updatedAt"`,
      [status, id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Task not found' });
    const updatedTask = result.rows[0];
    if (updatedTask?.projectId) {
      await syncProjectStatus(pool, updatedTask.projectId);
    }

    recordActivity(pool, {
      actionType: 'update_task_status',
      entityType: 'task',
      entityId: updatedTask.id,
      entityName: updatedTask.title,
      projectId: updatedTask.projectId,
      details: { newStatus: status },
    }, req);

    res.json(updatedTask);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE task
app.delete('/api/tasks/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const pool = getPool();
    const result = await pool.query(`DELETE FROM tasks WHERE id = $1 RETURNING id, title, project_id AS "projectId"`, [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Task not found' });
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

    res.json({ message: 'Task deleted', id });
  } catch (err: any) {
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

async function sendTelegramMessage(botToken: string, chatId: string, text: string): Promise<{ ok: boolean; message?: string }> {
  if (!botToken || !chatId) {
    return { ok: false, message: 'Telegram Bot Token and Chat ID are required.' };
  }
  const cleanToken = botToken.trim();
  const cleanChatId = chatId.trim();
  const url = `https://api.telegram.org/bot${cleanToken}/sendMessage`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: cleanChatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
    const data: any = await res.json();
    if (!data.ok) {
      return { ok: false, message: data.description || 'Telegram API rejected message' };
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, message: err.message || 'Network error reaching Telegram API' };
  }
}

async function generateTelegramWeeklyReport(pool: any): Promise<string> {
  const [projectsRes, tasksRes, membersRes] = await Promise.all([
    pool.query('SELECT * FROM projects ORDER BY created_at ASC'),
    pool.query('SELECT * FROM tasks ORDER BY created_at ASC'),
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
    const pOngoing = pTasks.filter((t: any) => t.status !== 'Completed');
    const pPercent = pTasks.length > 0 ? Math.round((pCompleted.length / pTasks.length) * 100) : 0;

    const statusEmoji = p.status === 'Completed' ? '✅' : p.status === 'Blocked' ? '🛑' : '🚀';

    text += `${idx + 1}. ${statusEmoji} <b>${p.name.toUpperCase()}</b>\n`;
    text += `   • <b>Status:</b> ${p.status} | <b>Progress:</b> ${pPercent}%\n`;
    if (p.client) {
      text += `   • <b>Client:</b> ${p.client}\n`;
    }

    if (pCompleted.length > 0) {
      text += `   • <b>Done:</b>\n`;
      pCompleted.forEach((t: any) => {
        const assignee = members.find((m: any) => m.id === t.assignee_id)?.name || 'Unassigned';
        text += `     ✓ ${t.title} (${assignee})\n`;
      });
    }

    if (pOngoing.length > 0) {
      text += `   • <b>In Progress:</b>\n`;
      pOngoing.slice(0, 4).forEach((t: any) => {
        const assignee = members.find((m: any) => m.id === t.assignee_id)?.name || 'Unassigned';
        const icon = t.status === 'Blocked' ? '⚠️' : '⏳';
        text += `     ${icon} ${t.title} [${t.status}] (${assignee})\n`;
      });
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
    if (result.rowCount === 0) {
      return res.json({
        enabled: false,
        hasToken: false,
        botTokenMasked: '',
        chatId: '',
        sendDay: 'Monday',
        sendTime: '08:00',
        lastSentAt: null,
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
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST update Telegram Settings
app.post('/api/telegram/settings', async (req: Request, res: Response) => {
  const { botToken, chatId, enabled, sendTime } = req.body;
  try {
    const pool = getPool();
    let query: string;
    let params: any[];

    if (botToken !== undefined && botToken.trim().length > 0) {
      query = `
        INSERT INTO telegram_settings (id, bot_token, chat_id, enabled, send_time, updated_at)
        VALUES ('default', $1, $2, $3, $4, CURRENT_TIMESTAMP)
        ON CONFLICT (id) DO UPDATE SET
          bot_token = EXCLUDED.bot_token,
          chat_id = EXCLUDED.chat_id,
          enabled = EXCLUDED.enabled,
          send_time = EXCLUDED.send_time,
          updated_at = CURRENT_TIMESTAMP
        RETURNING id, chat_id AS "chatId", enabled, send_time AS "sendTime", last_sent_at AS "lastSentAt"
      `;
      params = [botToken.trim(), (chatId || '').trim(), !!enabled, sendTime || '08:00'];
    } else {
      query = `
        UPDATE telegram_settings
        SET 
          chat_id = COALESCE($1, chat_id),
          enabled = COALESCE($2, enabled),
          send_time = COALESCE($3, send_time),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = 'default'
        RETURNING id, chat_id AS "chatId", enabled, send_time AS "sendTime", last_sent_at AS "lastSentAt"
      `;
      params = [(chatId || '').trim(), !!enabled, sendTime || '08:00'];
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

// Background Automated Monday Scheduler
function startTelegramWeeklyScheduler() {
  console.log('[Telegram Scheduler] Automated Monday weekly report scheduler initialized.');

  setInterval(async () => {
    try {
      const pool = getPool();
      const res = await pool.query('SELECT * FROM telegram_settings WHERE id = $1', ['default']);
      if (res.rowCount === 0) return;

      const settings = res.rows[0];
      if (!settings.enabled || !settings.bot_token || !settings.chat_id) return;

      const now = new Date();
      // Monday is day 1
      if (now.getDay() !== 1) return;

      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const currentTime = `${hours}:${minutes}`;

      const targetTime = settings.send_time || '08:00';
      if (currentTime !== targetTime) return;

      // Avoid duplicate sending if already sent in last 18 hours
      if (settings.last_sent_at) {
        const lastSent = new Date(settings.last_sent_at);
        const diffHours = (now.getTime() - lastSent.getTime()) / (1000 * 60 * 60);
        if (diffHours < 18) return;
      }

      console.log(`[Telegram Scheduler] Monday ${currentTime} reached! Dispatching automated report...`);
      const reportText = await generateTelegramWeeklyReport(pool);
      const sendRes = await sendTelegramMessage(settings.bot_token, settings.chat_id, reportText);

      if (sendRes.ok) {
        console.log('[Telegram Scheduler] Monday weekly report sent successfully to Telegram.');
        await pool.query('UPDATE telegram_settings SET last_sent_at = CURRENT_TIMESTAMP WHERE id = $1', ['default']);
      } else {
        console.error('[Telegram Scheduler] Failed to send report:', sendRes.message);
      }
    } catch (err: any) {
      console.error('[Telegram Scheduler Exception]:', err.message);
    }
  }, 30000);
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

    // Start background Telegram automated weekly scheduler
    startTelegramWeeklyScheduler();
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
