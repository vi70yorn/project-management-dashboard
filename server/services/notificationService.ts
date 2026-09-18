export interface CreateNotificationParams {
  type: string;
  title: string;
  message: string;
  taskId?: string | null;
  taskTitle?: string | null;
  projectId?: string | null;
  projectName?: string | null;
  targetUserIds?: string[];
  targetRoles?: string[];
  actorId?: string | null;
  actorName?: string | null;
  actorAvatar?: string | null;
}

export async function createServerNotification(pool: any, data: CreateNotificationParams): Promise<void> {
  try {
    const id = `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    await pool.query(
      `INSERT INTO in_app_notifications (
        id, type, title, message, task_id, task_title, project_id, project_name, target_user_ids, target_roles, actor_id, actor_name, actor_avatar, read_by, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, '{}', CURRENT_TIMESTAMP)`,
      [
        id,
        data.type,
        data.title,
        data.message,
        data.taskId || null,
        data.taskTitle || null,
        data.projectId || null,
        data.projectName || null,
        data.targetUserIds || [],
        data.targetRoles || [],
        data.actorId || null,
        data.actorName || 'System',
        data.actorAvatar || null,
      ]
    );
  } catch (err: any) {
    console.warn('[Server Notification Warning]:', err.message);
  }
}

