import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { getPool } from '../db';
import { requireAuth, requireAdmin, BCRYPT_ROUNDS, JwtPayload } from '../middleware/auth';

const router = Router();

// GET all team members
router.get('/', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const query = `
      SELECT 
        id,
        name,
        username,
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
router.post('/', requireAdmin, async (req: Request, res: Response) => {
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
    projectIds,
  } = req.body;

  if (!username || !username.trim()) {
    return res.status(400).json({ error: 'Username is required' });
  }

  const rawPassword = (password && typeof password === 'string' && password.trim()) ? password.trim() : '123456';
  const isBcrypt = rawPassword.startsWith('$2a$') || rawPassword.startsWith('$2b$');
  const memberPassword = isBcrypt ? rawPassword : await bcrypt.hash(rawPassword, BCRYPT_ROUNDS);

  const memberId = id || `mem-${Date.now()}`;
  const cleanUsername = username.trim().toLowerCase();

  const pool = getPool();
  const dbClient = await pool.connect();

  try {
    await dbClient.query('BEGIN');

    // Check duplicate username
    const existing = await dbClient.query(`SELECT id FROM team_members WHERE LOWER(username) = $1`, [cleanUsername]);
    if (existing.rowCount && existing.rowCount > 0) {
      await dbClient.query('ROLLBACK');
      return res.status(400).json({ error: `Username "${cleanUsername}" is already taken.` });
    }

    const query = `
      INSERT INTO team_members (id, name, username, password, email, role, system_role, avatar, color, status, department)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING 
        id, name, username, email, role, system_role AS "systemRole", avatar, color, status, department, created_at AS "createdAt";
    `;
    const result = await dbClient.query(query, [
      memberId,
      name,
      cleanUsername,
      memberPassword,
      email,
      role,
      systemRole,
      avatar || null,
      color,
      status,
      department,
    ]);

    // Insert project assignments if provided
    if (Array.isArray(projectIds) && projectIds.length > 0) {
      for (const pId of projectIds) {
        if (typeof pId === 'string' && pId.trim()) {
          await dbClient.query(
            `INSERT INTO project_members (project_id, member_id)
             SELECT id, $2::varchar
             FROM projects
             WHERE id = $1 AND deleted_at IS NULL
             ON CONFLICT (project_id, member_id) DO NOTHING`,
            [pId.trim(), memberId]
          );
        }
      }
    }

    await dbClient.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    await dbClient.query('ROLLBACK');
    console.error('Error creating member:', err);
    res.status(500).json({ error: err.message });
  } finally {
    dbClient.release();
  }
});

// PUT update team member
router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const jwtUser = (req as any).jwtUser as JwtPayload | undefined;
  const callerRole = jwtUser?.role || (req.headers['x-user-role'] as string) || '';
  const callerMemberId = jwtUser?.memberId || (req.headers['x-user-member-id'] as string) || '';
  const isAdmin = callerRole === 'admin';
  const isSelf = callerMemberId === id;

  if (!isAdmin && !isSelf) {
    return res.status(403).json({ error: 'Permission denied. You can only update your own user info.' });
  }

  const { name, username, password, email, role, systemRole, avatar, color, status, department, projectIds } = req.body;

  const pool = getPool();
  const dbClient = await pool.connect();

  try {
    await dbClient.query('BEGIN');

    // Check if username is being changed and conflicts
    if (username) {
      const conflictCheck = await dbClient.query(
        `SELECT id FROM team_members WHERE LOWER(username) = LOWER($1) AND id != $2`,
        [username.trim(), id]
      );
      if (conflictCheck.rowCount && conflictCheck.rowCount > 0) {
        await dbClient.query('ROLLBACK');
        return res.status(400).json({ error: `Username "${username}" is already in use.` });
      }
    }

    // Build update fields dynamically with strictly indexed parameters
    const updates: string[] = [];
    const params: any[] = [];

    if (name !== undefined) {
      params.push(name);
      updates.push(`name = $${params.length}`);
    }
    if (username !== undefined) {
      params.push(username.trim().toLowerCase());
      updates.push(`username = $${params.length}`);
    }
    if (isAdmin && password !== undefined && password.trim() !== '') {
      const isBcrypt = password.startsWith('$2a$') || password.startsWith('$2b$');
      const hashedPassword = isBcrypt ? password : await bcrypt.hash(password.trim(), BCRYPT_ROUNDS);
      params.push(hashedPassword);
      updates.push(`password = $${params.length}`);
    }
    if (email !== undefined) {
      params.push(email);
      updates.push(`email = $${params.length}`);
    }
    if (role !== undefined) {
      params.push(role);
      updates.push(`role = $${params.length}`);
    }
    if (isAdmin && systemRole !== undefined) {
      params.push(systemRole);
      updates.push(`system_role = $${params.length}`);
    }
    if (avatar !== undefined) {
      params.push(avatar);
      updates.push(`avatar = $${params.length}`);
    }
    if (color !== undefined) {
      params.push(color);
      updates.push(`color = $${params.length}`);
    }
    if (status !== undefined) {
      params.push(status);
      updates.push(`status = $${params.length}`);
    }
    if (department !== undefined) {
      params.push(department);
      updates.push(`department = $${params.length}`);
    }

    let memberRow = null;
    if (updates.length > 0) {
      params.push(id);
      const query = `
        UPDATE team_members
        SET ${updates.join(', ')}
        WHERE id = $${params.length}
        RETURNING 
          id, name, username, email, role, system_role AS "systemRole", avatar, color, status, department, created_at AS "createdAt";
      `;
      const result = await dbClient.query(query, params);
      if (result.rowCount === 0) {
        await dbClient.query('ROLLBACK');
        return res.status(404).json({ error: 'Member not found' });
      }
      memberRow = result.rows[0];
    } else {
      const existing = await dbClient.query(
        `SELECT id, name, username, email, role, system_role AS "systemRole", avatar, color, status, department, created_at AS "createdAt" FROM team_members WHERE id = $1`,
        [id]
      );
      if (existing.rowCount === 0) {
        await dbClient.query('ROLLBACK');
        return res.status(404).json({ error: 'Member not found' });
      }
      memberRow = existing.rows[0];
    }

    // Only Admin can update member project assignments
    if (isAdmin && Array.isArray(projectIds)) {
      await dbClient.query(`DELETE FROM project_members WHERE member_id = $1`, [id]);
      for (const pId of projectIds) {
        if (typeof pId === 'string' && pId.trim()) {
          await dbClient.query(
            `INSERT INTO project_members (project_id, member_id)
             SELECT id, $2::varchar
             FROM projects
             WHERE id = $1 AND deleted_at IS NULL
             ON CONFLICT (project_id, member_id) DO NOTHING`,
            [pId.trim(), id]
          );
        }
      }
    }

    await dbClient.query('COMMIT');
    res.json(memberRow);
  } catch (err: any) {
    await dbClient.query('ROLLBACK');
    console.error('Error updating member:', err);
    res.status(500).json({ error: err.message });
  } finally {
    dbClient.release();
  }
});

// PUT update member's project assignments (admin only)
router.put('/:id/projects', requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { projectIds } = req.body;

  if (!Array.isArray(projectIds)) {
    return res.status(400).json({ error: 'projectIds must be an array of strings.' });
  }

  const pool = getPool();
  const dbClient = await pool.connect();

  try {
    await dbClient.query('BEGIN');
    await dbClient.query(`DELETE FROM project_members WHERE member_id = $1`, [id]);
    for (const pId of projectIds) {
      if (typeof pId === 'string' && pId.trim()) {
        await dbClient.query(
          `INSERT INTO project_members (project_id, member_id)
           SELECT id, $2::varchar
           FROM projects
           WHERE id = $1 AND deleted_at IS NULL
           ON CONFLICT (project_id, member_id) DO NOTHING`,
          [pId.trim(), id]
        );
      }
    }
    await dbClient.query('COMMIT');
    res.json({ memberId: id, projectIds });
  } catch (err: any) {
    await dbClient.query('ROLLBACK');
    console.error('Error updating member projects:', err);
    res.status(500).json({ error: err.message });
  } finally {
    dbClient.release();
  }
});

// DELETE team member (admin only)
router.delete('/:id', requireAdmin, async (req: Request, res: Response) => {
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

export default router;

