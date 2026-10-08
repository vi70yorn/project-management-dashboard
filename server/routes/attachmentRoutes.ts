import { Router, Request, Response } from 'express';
import path from 'path';
import { getPool } from '../db';
import { requireAuth } from '../middleware/auth';
import { recordActivity } from '../services/activityService';
import {
  deleteDocumentFile,
  getGoogleDriveStatus,
} from '../storage/googleDrive';

const router = Router();

// GET Google Drive configuration and storage provider status
router.get('/config-status', (_req: Request, res: Response) => {
  res.json(getGoogleDriveStatus());
});

// GET attachments by projectId or taskId
router.get('/', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const { projectId, taskId } = req.query;

    let query = `
      SELECT
        id,
        project_id AS "projectId",
        task_id AS "taskId",
        file_name AS "fileName",
        file_size AS "fileSize",
        mime_type AS "mimeType",
        file_type AS "fileType",
        storage_provider AS "storageProvider",
        drive_file_id AS "driveFileId",
        drive_file_name AS "driveFileName",
        web_view_link AS "webViewLink",
        download_link AS "downloadLink",
        uploaded_by AS "uploadedBy",
        uploaded_by_name AS "uploadedByName",
        uploaded_by_avatar AS "uploadedByAvatar",
        created_at AS "createdAt"
      FROM attachments
    `;

    const conditions: string[] = [];
    const values: any[] = [];

    if (taskId) {
      values.push(taskId);
      conditions.push(`task_id = $${values.length}`);
    } else if (projectId) {
      values.push(projectId);
      conditions.push(`project_id = $${values.length}`);
    }

    if (conditions.length > 0) {
      query += ` WHERE ` + conditions.join(' AND ');
    }

    query += ` ORDER BY created_at DESC`;

    const result = await pool.query(query, values);
    res.json(result.rows);
  } catch (err: any) {
    console.error('[GET /api/attachments] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST upload attachment (file + metadata) - DISABLED
router.post('/upload', requireAuth, (_req: Request, res: Response) => {
  return res.status(403).json({ error: 'File uploads have been disabled.' });
});


// DELETE attachment by ID
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const pool = getPool();
    const findRes = await pool.query('SELECT * FROM attachments WHERE id = $1', [id]);
    if (findRes.rowCount === 0) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    const attachment = findRes.rows[0];

    // Extract local file name if stored locally
    let localFileName: string | null = null;
    if (attachment.storage_provider === 'local' && attachment.web_view_link) {
      localFileName = path.basename(decodeURIComponent(attachment.web_view_link));
    }

    // Delete from storage (Google Drive or local disk)
    await deleteDocumentFile({
      storageProvider: attachment.storage_provider,
      driveFileId: attachment.drive_file_id,
      localFileName,
    });

    // Delete from database
    await pool.query('DELETE FROM attachments WHERE id = $1', [id]);

    // Record activity
    await recordActivity(
      pool,
      {
        actionType: 'delete_document',
        entityType: attachment.task_id ? 'task' : 'project',
        entityId: attachment.task_id || attachment.project_id,
        entityName: attachment.file_name,
        projectId: attachment.project_id,
        details: {
          fileName: attachment.file_name,
        },
      },
      req
    );

    res.json({ success: true, message: 'Document deleted successfully.' });
  } catch (err: any) {
    console.error('[DELETE /api/attachments/:id] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;

