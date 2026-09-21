import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { getPool } from '../db';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Helper to calculate days remaining
function calculateDaysRemaining(targetDeadline?: string): { daysLeft: number | null; isOverdue: boolean } {
  if (!targetDeadline) return { daysLeft: null, isOverdue: false };
  const due = new Date(targetDeadline);
  if (isNaN(due.getTime())) return { daysLeft: null, isOverdue: false };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  const diffTime = due.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return {
    daysLeft: diffDays,
    isOverdue: diffDays < 0,
  };
}

// =========================================================================
// 1. PUBLIC: GET /api/share/:token - Fetch Client Read-Only Project Data
// =========================================================================
router.get('/:token', async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.params;
    const providedPasscode = (req.headers['x-client-passcode'] as string) || (req.query.passcode as string);
    const pool = getPool();

    // 1. Fetch share link record
    const shareQuery = `
      SELECT 
        sl.id,
        sl.project_id AS "projectId",
        sl.share_token AS "shareToken",
        sl.is_enabled AS "isEnabled",
        sl.password_hash AS "passwordHash",
        sl.expires_at AS "expiresAt",
        sl.show_tasks AS "showTasks",
        sl.show_attachments AS "showAttachments",
        sl.view_count AS "viewCount",
        p.name AS "projectName",
        p.client AS "clientName",
        p.deleted_at AS "deletedAt"
      FROM project_share_links sl
      JOIN projects p ON p.id = sl.project_id
      WHERE sl.share_token = $1
    `;
    const shareRes = await pool.query(shareQuery, [token]);

    if (shareRes.rowCount === 0) {
      res.status(404).json({ error: 'This shared project link was not found or is invalid.' });
      return;
    }

    const shareConfig = shareRes.rows[0];

    // Check if project was deleted
    if (shareConfig.deletedAt) {
      res.status(404).json({ error: 'The requested project is no longer available.' });
      return;
    }

    // Check if share link is enabled
    if (!shareConfig.isEnabled) {
      res.status(403).json({
        error: 'This client share link has been disabled by the project manager.',
        disabled: true,
      });
      return;
    }

    // Check if expired
    if (shareConfig.expiresAt && new Date(shareConfig.expiresAt).getTime() < Date.now()) {
      res.status(410).json({
        error: 'This client share link expired on ' + new Date(shareConfig.expiresAt).toLocaleDateString() + '.',
        expired: true,
      });
      return;
    }

    // Check passcode protection
    const hasPassword = Boolean(shareConfig.passwordHash);
    if (hasPassword) {
      if (!providedPasscode) {
        res.json({
          requiresPassword: true,
          projectName: shareConfig.projectName,
          clientName: shareConfig.clientName,
        });
        return;
      }

      const isMatch = await bcrypt.compare(providedPasscode, shareConfig.passwordHash);
      if (!isMatch) {
        res.status(401).json({
          error: 'Incorrect client passcode. Please check and try again.',
          requiresPassword: true,
        });
        return;
      }
    }

    // Async increment view stats
    pool.query(
      `UPDATE project_share_links SET view_count = view_count + 1, last_viewed_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [shareConfig.id]
    ).catch((err) => console.warn('[Share View Count Update Error]', err.message));

    // 2. Fetch Sanitized Project Data
    const projectQuery = `
      SELECT 
        p.id,
        p.name,
        p.description,
        p.client,
        p.status,
        p.start_date AS "startDate",
        p.target_deadline AS "targetDeadline",
        p.tags,
        p.color,
        COALESCE(p.links, '[]'::jsonb) AS links,
        COALESCE(p.project_for, ARRAY['Mobile App UI', 'Web UI']::text[]) AS "projectFor",
        p.created_at AS "createdAt",
        p.updated_at AS "updatedAt",
        m.name AS "managerName",
        m.role AS "managerRole",
        m.avatar AS "managerAvatar"
      FROM projects p
      LEFT JOIN team_members m ON m.id = p.manager_id
      WHERE p.id = $1 AND p.deleted_at IS NULL
    `;
    const projectRes = await pool.query(projectQuery, [shareConfig.projectId]);
    if (projectRes.rowCount === 0) {
      res.status(404).json({ error: 'Project not found or removed.' });
      return;
    }
    const project = projectRes.rows[0];

    // 3. Fetch Sanitized Tasks (if showTasks is true)
    let tasks: any[] = [];
    if (shareConfig.showTasks) {
      const tasksQuery = `
        SELECT 
          t.id,
          t.title,
          t.description,
          t.status,
          t.priority,
          t.task_for AS "taskFor",
          t.start_date AS "startDate",
          t.due_date AS "dueDate",
          t.created_at AS "createdAt",
          COALESCE(t.links, '[]'::jsonb) AS links,
          COALESCE(
            (
              SELECT json_agg(
                json_build_object(
                  'id', s.id,
                  'title', s.title,
                  'completed', s.completed,
                  'position', s.position
                ) ORDER BY s.position ASC
              )
              FROM task_subtasks s
              WHERE s.task_id = t.id
            ),
            '[]'::json
          ) AS subtasks
        FROM tasks t
        WHERE t.project_id = $1 AND t.deleted_at IS NULL
        ORDER BY 
          CASE t.status
            WHEN 'In Progress' THEN 1
            WHEN 'Ready Review' THEN 2
            WHEN 'Blocked' THEN 3
            WHEN 'Draft' THEN 4
            WHEN 'Completed' THEN 5
            ELSE 6
          END,
          t.due_date ASC NULLS LAST,
          t.created_at DESC
      `;
      const tasksRes = await pool.query(tasksQuery, [shareConfig.projectId]);
      tasks = tasksRes.rows;
    }

    // 4. Fetch Client-Visible Attachments (if showAttachments is true)
    let attachments: any[] = [];
    if (shareConfig.showAttachments) {
      const attachQuery = `
        SELECT 
          id,
          file_name AS "fileName",
          file_size AS "fileSize",
          mime_type AS "mimeType",
          file_type AS "fileType",
          web_view_link AS "webViewLink",
          download_link AS "downloadLink",
          created_at AS "createdAt"
        FROM attachments
        WHERE project_id = $1
        ORDER BY created_at DESC
      `;
      const attachRes = await pool.query(attachQuery, [shareConfig.projectId]);
      attachments = attachRes.rows;
    }

    // 5. Calculate Metrics
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t) => t.status === 'Completed').length;
    const inProgressTasks = tasks.filter((t) => t.status === 'In Progress').length;
    const reviewTasks = tasks.filter((t) => t.status === 'Ready Review').length;
    const blockedTasks = tasks.filter((t) => t.status === 'Blocked').length;
    const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const deadlineStatus = calculateDaysRemaining(project.targetDeadline);

    res.json({
      requiresPassword: false,
      project,
      metrics: {
        totalTasks,
        completedTasks,
        inProgressTasks,
        reviewTasks,
        blockedTasks,
        progressPercent,
        daysLeft: deadlineStatus.daysLeft,
        isOverdue: deadlineStatus.isOverdue,
      },
      tasks,
      attachments,
      shareSettings: {
        showTasks: shareConfig.showTasks,
        showAttachments: shareConfig.showAttachments,
        expiresAt: shareConfig.expiresAt,
      },
    });
  } catch (err: any) {
    console.error('[Client Share GET error]', err);
    res.status(500).json({ error: 'Failed to load client project portal' });
  }
});

// =========================================================================
// 2. PUBLIC: POST /api/share/:token/verify - Verify Passcode
// =========================================================================
router.post('/:token/verify', async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.params;
    const { passcode } = req.body;

    if (!passcode) {
      res.status(400).json({ error: 'Passcode is required.' });
      return;
    }

    const pool = getPool();
    const query = `
      SELECT password_hash AS "passwordHash", is_enabled AS "isEnabled", expires_at AS "expiresAt"
      FROM project_share_links
      WHERE share_token = $1
    `;
    const result = await pool.query(query, [token]);
    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Share link not found.' });
      return;
    }

    const link = result.rows[0];
    if (!link.isEnabled) {
      res.status(403).json({ error: 'This share link has been disabled.' });
      return;
    }

    if (link.expiresAt && new Date(link.expiresAt).getTime() < Date.now()) {
      res.status(410).json({ error: 'This share link has expired.' });
      return;
    }

    if (!link.passwordHash) {
      res.json({ success: true, message: 'No password required.' });
      return;
    }

    const isMatch = await bcrypt.compare(passcode, link.passwordHash);
    if (!isMatch) {
      res.status(401).json({ error: 'Incorrect client passcode.' });
      return;
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error('[Client Share Verify error]', err);
    res.status(500).json({ error: 'Failed to verify passcode' });
  }
});

// =========================================================================
// 3. AUTHENTICATED: GET /api/share/manage/:projectId - Get Share Config for PM
// =========================================================================
router.get('/manage/:projectId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params;
    const pool = getPool();

    const query = `
      SELECT 
        sl.id,
        sl.project_id AS "projectId",
        sl.share_token AS "shareToken",
        sl.is_enabled AS "isEnabled",
        (sl.password_hash IS NOT NULL AND sl.password_hash <> '') AS "hasPassword",
        sl.expires_at AS "expiresAt",
        sl.show_tasks AS "showTasks",
        sl.show_attachments AS "showAttachments",
        sl.view_count AS "viewCount",
        sl.last_viewed_at AS "lastViewedAt",
        sl.created_at AS "createdAt",
        sl.updated_at AS "updatedAt"
      FROM project_share_links sl
      WHERE sl.project_id = $1
    `;
    const result = await pool.query(query, [projectId]);

    if (result.rowCount === 0) {
      res.json({
        exists: false,
        config: null,
      });
      return;
    }

    res.json({
      exists: true,
      config: result.rows[0],
    });
  } catch (err: any) {
    console.error('[Share Manage GET error]', err);
    res.status(500).json({ error: 'Failed to retrieve project share configuration' });
  }
});

// =========================================================================
// 4. AUTHENTICATED: POST /api/share/manage/:projectId - Save/Update Share Config
// =========================================================================
router.post('/manage/:projectId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params;
    const {
      isEnabled = true,
      passcode,
      removePassword = false,
      expiresAt = null,
      showTasks = true,
      showAttachments = true,
      regenerateToken = false,
    } = req.body;

    const pool = getPool();

    // Verify project exists
    const projCheck = await pool.query(`SELECT id, name FROM projects WHERE id = $1 AND deleted_at IS NULL`, [projectId]);
    if (projCheck.rowCount === 0) {
      res.status(404).json({ error: 'Project not found.' });
      return;
    }

    // Check if share link record already exists
    const existingRes = await pool.query(`SELECT id, share_token, password_hash FROM project_share_links WHERE project_id = $1`, [projectId]);

    let shareToken: string;
    let passwordHash: string | null = null;

    if (existingRes.rowCount! > 0) {
      const existing = existingRes.rows[0];
      shareToken = regenerateToken ? crypto.randomBytes(16).toString('hex') : existing.share_token;

      if (passcode && passcode.trim()) {
        passwordHash = await bcrypt.hash(passcode.trim(), 10);
      } else if (removePassword) {
        passwordHash = null;
      } else {
        passwordHash = existing.password_hash;
      }

      const updateQuery = `
        UPDATE project_share_links
        SET 
          share_token = $1,
          is_enabled = $2,
          password_hash = $3,
          expires_at = $4,
          show_tasks = $5,
          show_attachments = $6,
          updated_at = CURRENT_TIMESTAMP
        WHERE project_id = $7
        RETURNING 
          id,
          project_id AS "projectId",
          share_token AS "shareToken",
          is_enabled AS "isEnabled",
          (password_hash IS NOT NULL AND password_hash <> '') AS "hasPassword",
          expires_at AS "expiresAt",
          show_tasks AS "showTasks",
          show_attachments AS "showAttachments",
          view_count AS "viewCount",
          last_viewed_at AS "lastViewedAt",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `;
      const updateRes = await pool.query(updateQuery, [
        shareToken,
        isEnabled,
        passwordHash,
        expiresAt || null,
        showTasks,
        showAttachments,
        projectId,
      ]);

      res.json({
        success: true,
        message: 'Share configuration updated successfully.',
        config: updateRes.rows[0],
      });
    } else {
      // Create new share link
      const newId = `share-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
      shareToken = crypto.randomBytes(16).toString('hex');

      if (passcode && passcode.trim()) {
        passwordHash = await bcrypt.hash(passcode.trim(), 10);
      }

      const insertQuery = `
        INSERT INTO project_share_links (
          id, project_id, share_token, is_enabled, password_hash, expires_at, show_tasks, show_attachments
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING 
          id,
          project_id AS "projectId",
          share_token AS "shareToken",
          is_enabled AS "isEnabled",
          (password_hash IS NOT NULL AND password_hash <> '') AS "hasPassword",
          expires_at AS "expiresAt",
          show_tasks AS "showTasks",
          show_attachments AS "showAttachments",
          view_count AS "viewCount",
          last_viewed_at AS "lastViewedAt",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `;
      const insertRes = await pool.query(insertQuery, [
        newId,
        projectId,
        shareToken,
        isEnabled,
        passwordHash,
        expiresAt || null,
        showTasks,
        showAttachments,
      ]);

      res.json({
        success: true,
        message: 'Client share link generated successfully.',
        config: insertRes.rows[0],
      });
    }
  } catch (err: any) {
    console.error('[Share Manage POST error]', err);
    res.status(500).json({ error: 'Failed to save project share configuration' });
  }
});

// =========================================================================
// 5. AUTHENTICATED: DELETE /api/share/manage/:projectId - Revoke/Disable Link
// =========================================================================
router.delete('/manage/:projectId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params;
    const pool = getPool();

    await pool.query(`UPDATE project_share_links SET is_enabled = false, updated_at = CURRENT_TIMESTAMP WHERE project_id = $1`, [projectId]);
    res.json({ success: true, message: 'Client share link has been disabled.' });
  } catch (err: any) {
    console.error('[Share Manage DELETE error]', err);
    res.status(500).json({ error: 'Failed to disable share link' });
  }
});

export default router;

