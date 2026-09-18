import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { getPool } from '../db';
import { requireAuth } from '../middleware/auth';
import { recordActivity } from '../services/activityService';
import {
  uploadDocumentFile,
  deleteDocumentFile,
  classifyFileType,
  getGoogleDriveStatus,
} from '../storage/googleDrive';

const router = Router();

// Multer upload middleware
const tempUploadsDir = path.resolve(process.cwd(), 'uploads', 'temp');
if (!fs.existsSync(tempUploadsDir)) {
  fs.mkdirSync(tempUploadsDir, { recursive: true });
}

const upload = multer({
  dest: tempUploadsDir,
  limits: {
    fileSize: 35 * 1024 * 1024, // 35 MB
  },
});

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

// POST upload attachment (file + metadata)
router.post('/upload', requireAuth, upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file was uploaded.' });
    }

    const {
      projectId,
      taskId,
      uploadedBy,
      uploadedByName,
      uploadedByAvatar,
      projectName,
      taskTitle,
      fileModifiedAt,
    } = req.body;

    if (!projectId && !taskId) {
      return res.status(400).json({ error: 'Either projectId or taskId must be provided.' });
    }

    const pool = getPool();
    let resolvedProjectName = projectName;
    let resolvedTaskTitle = taskTitle;

    // Auto-resolve project name and task title from DB if not provided
    if (!resolvedProjectName && projectId) {
      const pRes = await pool.query('SELECT name FROM projects WHERE id = $1', [projectId]);
      if (pRes.rows.length > 0) resolvedProjectName = pRes.rows[0].name;
    }

    if (taskId) {
      const tRes = await pool.query('SELECT title, project_id FROM tasks WHERE id = $1', [taskId]);
      if (tRes.rows.length > 0) {
        if (!resolvedTaskTitle) resolvedTaskTitle = tRes.rows[0].title;
        if (!resolvedProjectName && tRes.rows[0].project_id) {
          const pRes = await pool.query('SELECT name FROM projects WHERE id = $1', [tRes.rows[0].project_id]);
          if (pRes.rows.length > 0) resolvedProjectName = pRes.rows[0].name;
        }
      }
    }

    // Fix UTF-8 encoding in original filename
    const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    const mimeType = req.file.mimetype || 'application/octet-stream';
    const fileSize = req.file.size;
    const fileType = classifyFileType(originalName, mimeType);

    // Upload to Google Drive (with folder hierarchy and renaming in Google Drive only)
    const uploadRes = await uploadDocumentFile({
      fileName: originalName,
      filePath: req.file.path,
      mimeType,
      projectName: resolvedProjectName,
      taskId: taskId || null,
      taskTitle: resolvedTaskTitle,
      userName: uploadedByName || 'Team Member',
      fileModifiedAt: fileModifiedAt || new Date(),
    });

    const attachmentId = `att-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const insertQuery = `
      INSERT INTO attachments (
        id, project_id, task_id, file_name, file_size, mime_type, file_type,
        storage_provider, drive_file_id, drive_file_name, web_view_link, download_link,
        uploaded_by, uploaded_by_name, uploaded_by_avatar
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING
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
    `;

    const values = [
      attachmentId,
      projectId || null,
      taskId || null,
      originalName,
      fileSize,
      mimeType,
      fileType,
      uploadRes.storageProvider,
      uploadRes.driveFileId || null,
      uploadRes.driveFileName || null,
      uploadRes.webViewLink,
      uploadRes.downloadLink,
      uploadedBy || null,
      uploadedByName || 'Team Member',
      uploadedByAvatar || null,
    ];

    const dbResult = await pool.query(insertQuery, values);
    const createdAttachment = dbResult.rows[0];

    // Log in Team Activity timeline
    await recordActivity(
      pool,
      {
        userId: uploadedBy,
        userName: uploadedByName || 'Team Member',
        userAvatar: uploadedByAvatar,
        actionType: 'upload_document',
        entityType: taskId ? 'task' : 'project',
        entityId: taskId || projectId,
        entityName: originalName,
        projectId: projectId || null,
        projectName: resolvedProjectName || null,
        details: {
          fileName: originalName,
          driveFileName: uploadRes.driveFileName || null,
          fileSize,
          fileType,
          storageProvider: uploadRes.storageProvider,
          driveFileId: uploadRes.driveFileId,
          taskTitle: resolvedTaskTitle || null,
          projectName: resolvedProjectName || null,
        },
      },
      req
    );

    res.status(201).json(createdAttachment);
  } catch (err: any) {
    console.error('[POST /api/attachments/upload] Error:', err);
    res.status(500).json({ error: err.message || 'Upload failed' });
  }
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

