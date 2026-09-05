import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
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
    res.json({ ...result.rows[0], memberIds });
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
    res.json(result.rows[0]);
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
    const result = await pool.query(`DELETE FROM projects WHERE id = $1 RETURNING id`, [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Project not found' });
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
    res.status(201).json(result.rows[0]);
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
    res.json(result.rows[0]);
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
       RETURNING id, project_id AS "projectId", status, updated_at AS "updatedAt"`,
      [status, id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Task not found' });
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE task
app.delete('/api/tasks/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const pool = getPool();
    const result = await pool.query(`DELETE FROM tasks WHERE id = $1 RETURNING id`, [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Task not found' });
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
// Start Server & Bootstrap Database
// ==========================================

async function startServer() {
  try {
    console.log('[Server] Checking PostgreSQL database initialization...');
    await ensureDatabaseExists();
    await runMigrationsAndSeed();
    console.log('[Server] Database initialization completed successfully.');
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
