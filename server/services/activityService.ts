import { Request } from 'express';
import { JwtPayload } from '../middleware/auth';

export interface ActivityPayload {
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

export async function recordActivity(pool: any, data: ActivityPayload, req?: Request): Promise<void> {
  try {
    const id = `act-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    
    // Check if this is an automated system event (e.g. auto_complete_project)
    const isSystemAction = data.userName === 'System Automation';

    // The user who took action: ALWAYS prioritize the cryptographically verified JWT user!
    const jwtUser = (req as any)?.jwtUser as JwtPayload | undefined;
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
    } else if (jwtUser?.memberId) {
      // Prioritize cryptographically verified actor from JWT
      userId = jwtUser.memberId;
      userName = jwtUser.name || headerName;
      userAvatar = headerAvatar;
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

