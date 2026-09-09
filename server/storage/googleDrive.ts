import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { google } from 'googleapis';

dotenv.config();

// Ensure local uploads directory exists
const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads', 'documents');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

export function classifyFileType(fileName: string, mimeType: string): 'pdf' | 'word' | 'excel' | 'image' | 'other' {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === '.pdf' || mimeType.includes('pdf')) return 'pdf';
  if (
    ext === '.docx' ||
    ext === '.doc' ||
    mimeType.includes('word') ||
    mimeType.includes('officedocument.wordprocessingml')
  ) {
    return 'word';
  }
  if (
    ext === '.xlsx' ||
    ext === '.xls' ||
    ext === '.csv' ||
    mimeType.includes('spreadsheet') ||
    mimeType.includes('excel') ||
    mimeType.includes('officedocument.spreadsheetml')
  ) {
    return 'excel';
  }
  if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(ext) || mimeType.startsWith('image/')) {
    return 'image';
  }
  return 'other';
}

/**
 * Checks if Google Drive is properly configured via environment variables or service-account.json
 */
export function isGoogleDriveConfigured(): boolean {
  dotenv.config();
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId || folderId.trim() === '') return false;

  // Check for OAuth 2.0 User credentials (Primary for Personal @gmail.com accounts!)
  if (process.env.GOOGLE_REFRESH_TOKEN && process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    return true;
  }

  // Check for inline JSON key
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY && process.env.GOOGLE_SERVICE_ACCOUNT_KEY.trim() !== '') {
    return true;
  }

  // Check for standard Google Application Credentials file path
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS && fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
    return true;
  }

  // Check for service-account.json in project root
  const rootKeyPath = path.resolve(process.cwd(), 'service-account.json');
  if (fs.existsSync(rootKeyPath)) {
    return true;
  }

  return false;
}

export function getGoogleDriveStatus(): {
  configured: boolean;
  provider: 'google_drive' | 'local';
  folderId?: string;
  message: string;
} {
  const configured = isGoogleDriveConfigured();
  if (configured) {
    return {
      configured: true,
      provider: 'google_drive',
      folderId: process.env.GOOGLE_DRIVE_FOLDER_ID,
      message: 'Connected to Google Drive folder.',
    };
  }
  return {
    configured: false,
    provider: 'local',
    message: 'Running in Local Storage mode. Add GOOGLE_SERVICE_ACCOUNT_KEY & GOOGLE_DRIVE_FOLDER_ID to .env to enable Google Drive.',
  };
}

/**
 * Initializes Google Drive v3 client using Service Account credentials
 */
function getDriveClient() {
  // 1. Primary for Personal @gmail.com accounts: OAuth 2.0 User Refresh Token
  if (process.env.GOOGLE_REFRESH_TOKEN && process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || 'http://localhost:8085/oauth2callback'
    );
    oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    });
    return google.drive({ version: 'v3', auth: oauth2Client });
  }

  let auth;

  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    try {
      const keyContent = process.env.GOOGLE_SERVICE_ACCOUNT_KEY.trim();
      if (keyContent.startsWith('{')) {
        const credentials = JSON.parse(keyContent);
        auth = new google.auth.GoogleAuth({
          credentials,
          scopes: ['https://www.googleapis.com/auth/drive'],
        });
      } else if (fs.existsSync(keyContent)) {
        auth = new google.auth.GoogleAuth({
          keyFile: keyContent,
          scopes: ['https://www.googleapis.com/auth/drive'],
        });
      }
    } catch (err: any) {
      console.warn('[Google Drive Auth] Failed to parse GOOGLE_SERVICE_ACCOUNT_KEY:', err.message);
    }
  }

  if (!auth) {
    const rootKeyPath = path.resolve(process.cwd(), 'service-account.json');
    if (fs.existsSync(rootKeyPath)) {
      auth = new google.auth.GoogleAuth({
        keyFile: rootKeyPath,
        scopes: ['https://www.googleapis.com/auth/drive'],
      });
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS && fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
      auth = new google.auth.GoogleAuth({
        keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
        scopes: ['https://www.googleapis.com/auth/drive'],
      });
    }
  }

  if (!auth) {
    throw new Error('Google Drive credentials not found or invalid.');
  }

  return google.drive({ version: 'v3', auth });
}

export interface UploadResult {
  storageProvider: 'google_drive' | 'local';
  driveFileId?: string | null;
  driveFileName?: string | null;
  webViewLink: string;
  downloadLink: string;
  localFileName?: string;
}

export interface UploadDocumentOptions {
  fileName: string;
  filePath: string;
  mimeType: string;
  projectName?: string | null;
  taskId?: string | null;
  taskTitle?: string | null;
  userName?: string | null;
  fileModifiedAt?: string | number | Date | null;
}

/**
 * Uploads file to Google Drive if configured, otherwise falls back smoothly to local storage
 * Strips illegal characters for folder and file names
 */
export function sanitizeForName(str: string): string {
  return str
    .replace(/[/\\:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Formats date as YYYY-MM-DD for file renaming
 */
export function formatDateForFileName(dateInput?: string | number | Date | null): string {
  let date: Date;
  if (!dateInput) {
    date = new Date();
  } else if (typeof dateInput === 'string' || typeof dateInput === 'number') {
    date = new Date(dateInput);
    if (isNaN(date.getTime())) date = new Date();
  } else if (dateInput instanceof Date) {
    date = dateInput;
  } else {
    date = new Date();
  }

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Builds Google Drive filename: original name + user name + date modify
 * Example: "Specification Document_Sophea Doe_2026-09-09.docx"
 */
export function buildDriveFileName({
  originalName,
  userName,
  fileModifiedAt,
}: {
  originalName: string;
  userName?: string | null;
  fileModifiedAt?: string | number | Date | null;
}): string {
  const ext = path.extname(originalName);
  const base = path.basename(originalName, ext);
  const cleanBase = sanitizeForName(base) || 'Document';
  const cleanUser = sanitizeForName(userName || 'User') || 'User';
  const dateStr = formatDateForFileName(fileModifiedAt);

  return `${cleanBase}_${cleanUser}_${dateStr}${ext}`;
}

// In-memory cache to avoid repeated API folder queries: `${parentId}:${folderName}` -> folderId
const folderCache = new Map<string, string>();

/**
 * Finds or creates a subfolder within a parent Google Drive folder
 */
export async function getOrCreateFolder(
  drive: any,
  folderName: string,
  parentFolderId: string
): Promise<string> {
  const cleanName = sanitizeForName(folderName) || 'Folder';
  const cacheKey = `${parentFolderId}:${cleanName}`;
  if (folderCache.has(cacheKey)) {
    return folderCache.get(cacheKey)!;
  }

  // Escape backslashes and single quotes for Google Drive search query
  const escapedName = cleanName.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const query = `mimeType = 'application/vnd.google-apps.folder' and name = '${escapedName}' and '${parentFolderId}' in parents and trashed = false`;

  try {
    const res = await drive.files.list({
      q: query,
      fields: 'files(id, name)',
      spaces: 'drive',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    if (res.data.files && res.data.files.length > 0) {
      const existingId = res.data.files[0].id;
      folderCache.set(cacheKey, existingId);
      return existingId;
    }
  } catch (err: any) {
    console.warn(`[Google Drive] Folder search warning for "${cleanName}":`, err.message);
  }

  // Create folder if not found
  const createRes = await drive.files.create({
    requestBody: {
      name: cleanName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentFolderId],
    },
    fields: 'id, name',
    supportsAllDrives: true,
  });

  const newFolderId = createRes.data.id;
  if (!newFolderId) {
    throw new Error(`Failed to create Google Drive folder "${cleanName}".`);
  }

  folderCache.set(cacheKey, newFolderId);
  console.log(`[Google Drive] Created folder "${cleanName}" (ID: ${newFolderId}) inside parent (${parentFolderId})`);
  return newFolderId;
}

/**
 * Resolves the target Google Drive folder following the structure:
 * Root -> [Project Name]
 *   If Project level: uploads inside [Project Name]
 *   If Task level: inside [Project Name] -> Tasks -> [Task Title]
 */
export async function resolveTargetFolder(
  drive: any,
  rootFolderId: string,
  options: {
    projectName?: string | null;
    taskId?: string | null;
    taskTitle?: string | null;
  }
): Promise<string> {
  // 1. Resolve Project folder
  const projectFolderName = options.projectName?.trim() || 'General Projects';
  const projectFolderId = await getOrCreateFolder(drive, projectFolderName, rootFolderId);

  // 2. If Project level (no taskId), upload directly to Project folder
  if (!options.taskId) {
    return projectFolderId;
  }

  // 3. If Task level, find or create "Tasks" folder inside project
  const tasksFolderId = await getOrCreateFolder(drive, 'Tasks', projectFolderId);

  // 4. Inside "Tasks", find or create subfolder named after the task
  if (options.taskTitle && options.taskTitle.trim()) {
    const taskFolderId = await getOrCreateFolder(drive, options.taskTitle.trim(), tasksFolderId);
    return taskFolderId;
  }

  return tasksFolderId;
}

/**
 * Uploads file to Google Drive with structured folders and renamed file (original + user + date modify)
 * If Google Drive is not configured, falls back smoothly to local storage.
 */
export async function uploadDocumentFile({
  fileName,
  filePath,
  mimeType,
  projectName,
  taskId,
  taskTitle,
  userName,
  fileModifiedAt,
}: UploadDocumentOptions): Promise<UploadResult> {
  const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  if (isGoogleDriveConfigured() && rootFolderId) {
    try {
      const drive = getDriveClient();

      // 1. Resolve structured target folder: Project -> [Tasks] -> [Task Title]
      const targetFolderId = await resolveTargetFolder(drive, rootFolderId, {
        projectName,
        taskId,
        taskTitle,
      });

      // 2. Rename in Google Drive only: original name + user name + date modify
      const driveFileName = buildDriveFileName({
        originalName: fileName,
        userName,
        fileModifiedAt,
      });

      console.log(`[Google Drive] Uploading "${driveFileName}" to folder (${targetFolderId})...`);

      const fileMetadata = {
        name: driveFileName,
        parents: [targetFolderId],
      };

      const media = {
        mimeType,
        body: fs.createReadStream(filePath),
      };

      const response = await drive.files.create({
        requestBody: fileMetadata,
        media,
        fields: 'id, name, webViewLink, webContentLink',
        supportsAllDrives: true,
      });

      const fileId = response.data.id;
      if (!fileId) {
        throw new Error('No file ID returned from Google Drive.');
      }

      // Grant anyone with link read access so team members can view
      try {
        await drive.permissions.create({
          fileId,
          requestBody: {
            role: 'reader',
            type: 'anyone',
          },
          supportsAllDrives: true,
        });
      } catch (permErr: any) {
        console.warn('[Google Drive] Could not set public link permission (may be restricted by workspace):', permErr.message);
      }

      // Cleanup temp uploaded file from multer
      try {
        fs.unlinkSync(filePath);
      } catch {}

      console.log(`[Google Drive] File "${driveFileName}" uploaded successfully! File ID: ${fileId}`);

      return {
        storageProvider: 'google_drive',
        driveFileId: fileId,
        driveFileName,
        webViewLink: response.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`,
        downloadLink: response.data.webContentLink || `https://drive.google.com/uc?id=${fileId}&export=download`,
      };
    } catch (driveErr: any) {
      console.error('[Google Drive] Upload error, falling back to local storage:', driveErr.message);
      // Fall through to local storage fallback
    }
  }

  // Local Storage Fallback
  const safeBaseName = path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, '_');
  const storedFileName = `${Date.now()}-${safeBaseName}`;
  const targetPath = path.join(UPLOADS_DIR, storedFileName);

  // Move temp file to permanent local uploads directory
  try {
    fs.copyFileSync(filePath, targetPath);
    fs.unlinkSync(filePath);
  } catch (copyErr) {
    const data = fs.readFileSync(filePath);
    fs.writeFileSync(targetPath, data);
    try { fs.unlinkSync(filePath); } catch {}
  }

  const relativeUrl = `/api/uploads/documents/${encodeURIComponent(storedFileName)}`;

  return {
    storageProvider: 'local',
    driveFileId: null,
    webViewLink: relativeUrl,
    downloadLink: relativeUrl,
    localFileName: storedFileName,
  };
}

/**
 * Deletes document from storage (Google Drive or local disk)
 */
export async function deleteDocumentFile({
  storageProvider,
  driveFileId,
  localFileName,
}: {
  storageProvider: 'google_drive' | 'local';
  driveFileId?: string | null;
  localFileName?: string | null;
}): Promise<void> {
  if (storageProvider === 'google_drive' && driveFileId) {
    try {
      const drive = getDriveClient();
      await drive.files.delete({ fileId: driveFileId, supportsAllDrives: true });
      console.log(`[Google Drive] Deleted file ID: ${driveFileId}`);
    } catch (err: any) {
      console.warn(`[Google Drive] Could not delete file ${driveFileId}:`, err.message);
    }
  } else if (localFileName) {
    try {
      const targetPath = path.join(UPLOADS_DIR, localFileName);
      if (fs.existsSync(targetPath)) {
        fs.unlinkSync(targetPath);
        console.log(`[Local Storage] Deleted file: ${localFileName}`);
      }
    } catch (err: any) {
      console.warn(`[Local Storage] Could not delete local file ${localFileName}:`, err.message);
    }
  }
}

