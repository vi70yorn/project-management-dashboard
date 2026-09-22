import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import pg from 'pg';
import { google } from 'googleapis';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT || '5432'),
  database: process.env.PGDATABASE || 'project_management',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || '123',
});

function getDriveClient() {
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
  throw new Error('Google Drive credentials not found in .env');
}

async function getOrCreateFolder(drive, name, parentId) {
  const query = `mimeType = 'application/vnd.google-apps.folder' and name = '${name.replace(/'/g, "\\'")}' and '${parentId}' in parents and trashed = false`;
  const res = await drive.files.list({
    q: query,
    fields: 'files(id, name)',
    spaces: 'drive',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  if (res.data.files && res.data.files.length > 0) {
    return res.data.files[0].id;
  }

  const createRes = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
    fields: 'id, name',
    supportsAllDrives: true,
  });

  return createRes.data.id;
}

async function main() {
  console.log('\n======================================================');
  console.log('   Migrating Local Files to Google Drive              ');
  console.log('======================================================\n');

  const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!rootFolderId) {
    console.error('Error: GOOGLE_DRIVE_FOLDER_ID not set in .env');
    process.exit(1);
  }

  const drive = getDriveClient();
  const localDir = path.resolve(process.cwd(), 'uploads', 'documents');

  const { rows: localAttachments } = await pool.query(`
    SELECT 
      a.id,
      a.file_name AS "fileName",
      a.mime_type AS "mimeType",
      a.web_view_link AS "webViewLink",
      a.project_id AS "projectId",
      p.name AS "projectName",
      a.task_id AS "taskId",
      t.title AS "taskTitle",
      a.uploaded_by_name AS "uploadedByName"
    FROM attachments a
    LEFT JOIN projects p ON a.project_id = p.id
    LEFT JOIN tasks t ON a.task_id = t.id
    WHERE a.storage_provider = 'local'
  `);

  if (localAttachments.length === 0) {
    console.log('✅ No local attachments found in database. All attachments are already in Google Drive!\n');
    await pool.end();
    return;
  }

  console.log(`Found ${localAttachments.length} local attachment(s) to migrate...\n`);

  for (const item of localAttachments) {
    // Extract local filename from web_view_link
    // e.g. /api/uploads/documents/1790061353150-Business_Chat.png
    const rawLocalName = path.basename(decodeURIComponent(item.webViewLink));
    const localFilePath = path.join(localDir, rawLocalName);

    if (!fs.existsSync(localFilePath)) {
      console.warn(`[Skip] File not found on disk: ${localFilePath}`);
      continue;
    }

    console.log(`Uploading "${item.fileName}" (${rawLocalName}) to Google Drive...`);

    // Resolve target folder
    const projName = item.projectName || 'General Projects';
    const projFolderId = await getOrCreateFolder(drive, projName, rootFolderId);
    let targetFolderId = projFolderId;

    if (item.taskId && item.taskTitle) {
      const tasksFolderId = await getOrCreateFolder(drive, 'Tasks', projFolderId);
      targetFolderId = await getOrCreateFolder(drive, item.taskTitle, tasksFolderId);
    }

    // Upload to Google Drive
    const driveRes = await drive.files.create({
      requestBody: {
        name: item.fileName,
        parents: [targetFolderId],
      },
      media: {
        mimeType: item.mimeType,
        body: fs.createReadStream(localFilePath),
      },
      fields: 'id, name, webViewLink, webContentLink',
      supportsAllDrives: true,
    });

    const fileId = driveRes.data.id;
    const webViewLink = driveRes.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`;
    const downloadLink = driveRes.data.webContentLink || `https://drive.google.com/uc?id=${fileId}&export=download`;

    // Make public link readable
    try {
      await drive.permissions.create({
        fileId,
        requestBody: { role: 'reader', type: 'anyone' },
        supportsAllDrives: true,
      });
    } catch {}

    // Update DB record
    await pool.query(`
      UPDATE attachments
      SET 
        storage_provider = 'google_drive',
        drive_file_id = $1,
        drive_file_name = $2,
        web_view_link = $3,
        download_link = $4
      WHERE id = $5
    `, [fileId, item.fileName, webViewLink, downloadLink, item.id]);

    // Delete local file
    try {
      fs.unlinkSync(localFilePath);
      console.log(`  -> Migrated and deleted local file: ${rawLocalName}`);
    } catch (err) {
      console.warn(`  -> Migrated, but could not delete local file: ${err.message}`);
    }
  }

  console.log('\n======================================================');
  console.log('  [SUCCESS] All local files migrated to Google Drive!');
  console.log('======================================================\n');

  await pool.end();
}

main().catch((err) => {
  console.error('\nMigration failed:', err.message);
  process.exit(1);
});

