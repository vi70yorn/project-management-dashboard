import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getPool } from '../db';
import {
  JWT_SECRET,
  JWT_EXPIRES_IN,
  BCRYPT_ROUNDS,
  loginRateLimiter,
  changePasswordRateLimiter,
  requireAuth,
  requireAdmin,
  JwtPayload,
} from '../middleware/auth';

const router = Router();

// POST /api/auth/login — bcrypt verify + JWT issue
router.post('/login', loginRateLimiter, async (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT id, username, name, role, system_role AS "systemRole", department, email, avatar, color, password
       FROM team_members
       WHERE LOWER(username) = LOWER($1)
       LIMIT 1`,
      [username.trim()]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const member = result.rows[0];
    const storedPassword: string = member.password || '';

    // Detect if password is plaintext (not a bcrypt hash) and migrate it on-the-fly
    let isMatch = false;
    const isBcryptHash = storedPassword.startsWith('$2a$') || storedPassword.startsWith('$2b$');

    if (isBcryptHash) {
      isMatch = await bcrypt.compare(password, storedPassword);
    } else {
      // Plaintext comparison + migrate to bcrypt
      isMatch = storedPassword === password;
      if (isMatch) {
        const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
        await pool.query('UPDATE team_members SET password = $1 WHERE id = $2', [hash, member.id]);
        console.log(`[Auth] Migrated plaintext password for user: ${member.username}`);
      }
    }

    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const systemRole = (member.systemRole || 'staff').toLowerCase();

    const token = jwt.sign(
      { memberId: member.id, username: member.username, role: systemRole, name: member.name },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN } as any
    );

    return res.json({
      token,
      user: {
        id: `usr-${member.id}`,
        memberId: member.id,
        username: member.username,
        name: member.name,
        role: systemRole, // 'admin' or 'staff'
        jobRole: member.role,
        department: member.department,
        email: member.email,
        avatar: member.avatar,
        color: member.color,
      },
    });
  } catch (err: any) {
    console.error('[Auth] Login error:', err.message);
    return res.status(500).json({ error: 'Internal server error during login.' });
  }
});

// POST /api/auth/change-password — staff/admin change own password
router.post('/change-password', changePasswordRateLimiter, requireAuth, async (req: Request, res: Response) => {
  const jwtUser = (req as any).jwtUser as JwtPayload | undefined;
  const { memberId, currentPassword, newPassword } = req.body;
  if (!memberId || !currentPassword || !newPassword) {
    return res.status(400).json({ error: 'memberId, currentPassword, and newPassword are required.' });
  }
  if (newPassword.length < 4) {
    return res.status(400).json({ error: 'New password must be at least 4 characters.' });
  }

  // Prevent changing another member's password unless caller has admin role
  if (jwtUser && jwtUser.memberId !== memberId && jwtUser.role !== 'admin') {
    return res.status(403).json({ error: 'Permission denied. You can only change your own password.' });
  }

  try {
    const pool = getPool();
    const result = await pool.query(
      'SELECT id, password FROM team_members WHERE id = $1 LIMIT 1',
      [memberId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Member not found.' });
    }

    const member = result.rows[0];
    const storedPassword: string = member.password || '';
    const isBcryptHash = storedPassword.startsWith('$2a$') || storedPassword.startsWith('$2b$');

    let isMatch = false;
    if (isBcryptHash) {
      isMatch = await bcrypt.compare(currentPassword, storedPassword);
    } else {
      isMatch = storedPassword === currentPassword;
    }

    if (!isMatch) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }

    const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await pool.query('UPDATE team_members SET password = $1 WHERE id = $2', [newHash, memberId]);
    console.log(`[Auth] Password changed for memberId: ${memberId}`);

    return res.json({ message: 'Password updated successfully.' });
  } catch (err: any) {
    console.error('[Auth] Change password error:', err.message);
    return res.status(500).json({ error: 'Internal server error during password change.' });
  }
});

// POST /api/auth/admin-reset-password — admin resets any member's password
router.post('/admin-reset-password', requireAdmin, async (req: Request, res: Response) => {
  const { memberId, newPassword } = req.body;
  if (!memberId || !newPassword) {
    return res.status(400).json({ error: 'memberId and newPassword are required.' });
  }
  if (newPassword.length < 4) {
    return res.status(400).json({ error: 'New password must be at least 4 characters.' });
  }

  try {
    const pool = getPool();
    const result = await pool.query('SELECT id FROM team_members WHERE id = $1 LIMIT 1', [memberId]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Member not found.' });
    }

    const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await pool.query('UPDATE team_members SET password = $1 WHERE id = $2', [newHash, memberId]);
    console.log(`[Auth] Admin reset password for memberId: ${memberId}`);

    return res.json({ message: 'Password reset successfully.' });
  } catch (err: any) {
    console.error('[Auth] Admin reset password error:', err.message);
    return res.status(500).json({ error: 'Internal server error during password reset.' });
  }
});

export default router;

