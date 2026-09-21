import { Router, Request, Response } from 'express';
import { getPool } from '../db';
import { requireAuth, JwtPayload } from '../middleware/auth';
import { recordActivity } from '../services/activityService';
import { createServerNotification } from '../services/notificationService';
import { notifyTelegramTaskStatusUpdate } from '../services/telegramService';
import { getTaskById } from '../services/taskService';
import { syncProjectStatus } from '../services/projectService';

const router = Router();

// GET all tasks
router.get('/', async (_req: Request, res: Response) => {
  try {
    const pool = getPool();
    const query = `
      SELECT 
        t.id,
        t.project_id AS "projectId",
        p.name AS "projectName",
        t.title,
        t.description,
        t.status,
        t.priority,
        t.assignee_id AS "assigneeId",
        t.task_for AS "taskFor",
        COALESCE(t.links, '[]'::jsonb) AS links,
        t.created_by AS "createdBy",
        COALESCE(cb_m.name, cb_u.name, 'Team Member') AS "createdByName",
        COALESCE(cb_m.avatar, cb_u.avatar) AS "createdByAvatar",
        t.updated_by AS "updatedBy",
        COALESCE(ub_m.name, ub_u.name, 'Team Member') AS "updatedByName",
        COALESCE(ub_m.avatar, ub_u.avatar) AS "updatedByAvatar",
        t.start_date AS "startDate",
        t.due_date AS "dueDate",
        t.created_at AS "createdAt",
        t.updated_at AS "updatedAt",
        (SELECT COUNT(*)::int FROM task_comments WHERE task_id = t.id) AS "commentCount",
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'id', s.id,
                'taskId', s.task_id,
                'title', s.title,
                'completed', s.completed,
                'position', s.position,
                'createdAt', s.created_at,
                'updatedAt', s.updated_at
              ) ORDER BY s.position ASC, s.created_at ASC
            )
            FROM task_subtasks s
            WHERE s.task_id = t.id
          ),
          '[]'::json
        ) AS subtasks
      FROM tasks t
      LEFT JOIN projects p ON p.id = t.project_id
      LEFT JOIN team_members cb_m ON cb_m.id = t.created_by
      LEFT JOIN users cb_u ON cb_u.member_id = t.created_by
      LEFT JOIN team_members ub_m ON ub_m.id = t.updated_by
      LEFT JOIN users ub_u ON ub_u.member_id = t.updated_by
      WHERE t.deleted_at IS NULL
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
router.post('/', requireAuth, async (req: Request, res: Response) => {
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
    taskFor = null,
    links = [],
  } = req.body;

  const actorMemberId = (req as any).jwtUser?.memberId || (req.headers['x-user-member-id'] as string) || null;
  const effectiveCreatedBy = createdBy || actorMemberId || assigneeId || null;
  const taskId = id || `task-${Date.now()}`;
  try {
    const pool = getPool();
    const query = `
      INSERT INTO tasks (id, project_id, title, description, status, priority, assignee_id, links, task_for, created_by, updated_by, start_date, due_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10, $11, $12)
      RETURNING id;
    `;
    await pool.query(query, [
      taskId,
      projectId,
      title,
      description,
      status,
      priority,
      assigneeId || null,
      JSON.stringify(links || []),
      taskFor || null,
      effectiveCreatedBy,
      startDate || null,
      dueDate,
    ]);

    if (Array.isArray(req.body.subtasks) && req.body.subtasks.length > 0) {
      for (let i = 0; i < req.body.subtasks.length; i++) {
        const s = req.body.subtasks[i];
        const sTitle = typeof s === 'string' ? s : s.title;
        if (sTitle && sTitle.trim()) {
          const subId = s.id || `sub-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
          await pool.query(
            'INSERT INTO task_subtasks (id, task_id, title, completed, position) VALUES ($1, $2, $3, $4, $5)',
            [subId, taskId, sTitle.trim(), Boolean(s.completed), i]
          );
        }
      }
    }

    const createdTask = await getTaskById(pool, taskId);
    if (createdTask?.projectId) {
      await syncProjectStatus(pool, createdTask.projectId);
    }

    recordActivity(pool, {
      actionType: 'create_task',
      entityType: 'task',
      entityId: taskId,
      entityName: title,
      projectId: projectId,
      details: { status, priority, assigneeId },
    }, req);

    // Server-side notification trigger on task create
    const taskTitle = createdTask?.title || title;
    const projName = createdTask?.projectName || '';
    const actorName = req.headers['x-user-name'] ? decodeURIComponent(req.headers['x-user-name'] as string) : 'A team member';
    const actorAvatar = req.headers['x-user-avatar'] ? decodeURIComponent(req.headers['x-user-avatar'] as string) : null;

    if (assigneeId) {
      createServerNotification(pool, {
        type: 'task_assigned',
        title: 'New Task Assigned',
        message: `${actorName} assigned "${taskTitle}" to you.`,
        taskId,
        taskTitle,
        projectId,
        projectName: projName,
        targetUserIds: [assigneeId],
        actorId: effectiveCreatedBy,
        actorName,
        actorAvatar,
      });
    }
    const normStatus = (status || '').trim();
    const isReadyReview = normStatus.toLowerCase() === 'ready review' || normStatus.toLowerCase() === 'ready for review';
    const isCompleted = normStatus.toLowerCase() === 'completed';

    if (isReadyReview) {
      createServerNotification(pool, {
        type: 'task_ready_review',
        title: 'Task Ready for Review',
        message: `${actorName} marked "${taskTitle}" as Ready Review.`,
        taskId,
        taskTitle,
        projectId,
        projectName: projName,
        targetRoles: ['admin'],
        actorId: effectiveCreatedBy,
        actorName,
        actorAvatar,
      });
      notifyTelegramTaskStatusUpdate(pool, createdTask, 'Ready Review', actorName);
    } else if (isCompleted) {
      notifyTelegramTaskStatusUpdate(pool, createdTask, 'Completed', actorName);
    } else if (normStatus.toLowerCase() === 'blocked') {
      createServerNotification(pool, {
        type: 'task_blocked',
        title: 'Task Marked Blocked',
        message: `${actorName} marked "${taskTitle}" as Blocked!`,
        taskId,
        taskTitle,
        projectId,
        projectName: projName,
        targetRoles: ['admin'],
        actorId: effectiveCreatedBy,
        actorName,
        actorAvatar,
      });
    }

    res.status(201).json(createdTask || {
      id: taskId,
      projectId,
      title,
      description,
      status,
      priority,
      assigneeId,
      taskFor: taskFor || null,
      createdBy: effectiveCreatedBy,
      updatedBy: effectiveCreatedBy,
      startDate,
      dueDate,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Error creating task:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT update task
router.put('/:id', requireAuth, async (req: Request, res: Response) => {
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
    taskFor,
    links,
    updatedBy,
  } = req.body;

  const actorMemberId = (req as any).jwtUser?.memberId || (req.headers['x-user-member-id'] as string) || null;
  const effectiveUpdatedBy = updatedBy || actorMemberId || null;

  try {
    const pool = getPool();
    const prevRes = await pool.query('SELECT status, assignee_id, title, project_id FROM tasks WHERE id = $1', [id]);
    const oldStatus = prevRes.rows[0]?.status;
    const oldAssigneeId = prevRes.rows[0]?.assignee_id;

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
        links = COALESCE($10::jsonb, links),
        task_for = COALESCE($11, task_for),
        updated_by = COALESCE($12, updated_by),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $13
      RETURNING id, project_id AS "projectId";
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
      links !== undefined ? JSON.stringify(links) : null,
      taskFor !== undefined ? taskFor : null,
      effectiveUpdatedBy,
      id,
    ]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Task not found' });
    
    const updatedTask = await getTaskById(pool, id);
    if (updatedTask?.projectId) {
      await syncProjectStatus(pool, updatedTask.projectId);
    }

    const normStatus = (status || '').trim();
    const isReadyReview = normStatus.toLowerCase() === 'ready review' || normStatus.toLowerCase() === 'ready for review';
    const isCompleted = normStatus.toLowerCase() === 'completed';
    const isStatusChanged = normStatus.length > 0 && (!oldStatus || normStatus.toLowerCase() !== oldStatus.trim().toLowerCase());

    if (isStatusChanged) {
      recordActivity(pool, {
        actionType: 'update_task_status',
        entityType: 'task',
        entityId: id,
        entityName: updatedTask?.title || title,
        projectId: updatedTask?.projectId || projectId,
        details: { fromStatus: oldStatus || 'Draft', toStatus: status, newStatus: status },
      }, req);
    } else {
      recordActivity(pool, {
        actionType: 'update_task',
        entityType: 'task',
        entityId: id,
        entityName: updatedTask?.title || title,
        projectId: updatedTask?.projectId || projectId,
        details: { status: updatedTask?.status || status, priority: updatedTask?.priority || priority, assigneeId: updatedTask?.assigneeId || assigneeId },
      }, req);
    }

    // Trigger Server-side Notifications on Task Update
    const actorName = (req as any).jwtUser?.name || (req.headers['x-user-name'] ? decodeURIComponent(req.headers['x-user-name'] as string) : 'A team member');
    const actorAvatar = req.headers['x-user-avatar'] ? decodeURIComponent(req.headers['x-user-avatar'] as string) : null;
    const taskTitle = updatedTask?.title || title || 'Task';
    const projId = updatedTask?.projectId || projectId;
    const projName = updatedTask?.projectName || '';

    if (assigneeId && assigneeId !== oldAssigneeId) {
      createServerNotification(pool, {
        type: 'task_assigned',
        title: 'Task Assigned to You',
        message: `${actorName} assigned "${taskTitle}" to you.`,
        taskId: id,
        taskTitle,
        projectId: projId,
        projectName: projName,
        targetUserIds: [assigneeId],
        actorId: actorMemberId,
        actorName,
        actorAvatar,
      });
    }

    if (isStatusChanged) {
      if (isReadyReview) {
        createServerNotification(pool, {
          type: 'task_ready_review',
          title: 'Task Ready for Review',
          message: `${actorName} moved "${taskTitle}" to Ready Review.`,
          taskId: id,
          taskTitle,
          projectId: projId,
          projectName: projName,
          targetRoles: ['admin'],
          actorId: actorMemberId,
          actorName,
          actorAvatar,
        });
        notifyTelegramTaskStatusUpdate(pool, updatedTask, 'Ready Review', actorName);
      } else if (isCompleted) {
        notifyTelegramTaskStatusUpdate(pool, updatedTask, 'Completed', actorName);
      } else if (normStatus.toLowerCase() === 'blocked') {
        createServerNotification(pool, {
          type: 'task_blocked',
          title: 'Task Marked Blocked',
          message: `${actorName} flagged "${taskTitle}" as Blocked!`,
          taskId: id,
          taskTitle,
          projectId: projId,
          projectName: projName,
          targetRoles: ['admin'],
          actorId: actorMemberId,
          actorName,
          actorAvatar,
        });
      }
    }

    res.json(updatedTask);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH task status
router.patch('/:id/status', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;
  const jwtUser = (req as any).jwtUser as JwtPayload | undefined;
  const actorMemberId = jwtUser?.memberId || (req.headers['x-user-member-id'] as string) || null;
  try {
    const pool = getPool();
    const prevRes = await pool.query('SELECT status, title, project_id FROM tasks WHERE id = $1', [id]);
    const oldStatus = prevRes.rows[0]?.status;

    const result = await pool.query(
      `UPDATE tasks 
       SET status = $1, 
           updated_by = COALESCE($2, updated_by), 
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = $3 
       RETURNING id, project_id AS "projectId", title, status, updated_at AS "updatedAt"`,
      [status, actorMemberId, id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Task not found' });
    
    const updatedTask = await getTaskById(pool, id);
    if (updatedTask?.projectId) {
      await syncProjectStatus(pool, updatedTask.projectId);
    }

    recordActivity(pool, {
      actionType: 'update_task_status',
      entityType: 'task',
      entityId: id,
      entityName: updatedTask?.title || result.rows[0].title,
      projectId: updatedTask?.projectId || result.rows[0].projectId,
      details: { fromStatus: oldStatus || 'Draft', toStatus: status, newStatus: status },
    }, req);

    // Trigger Server-side Notifications on Status Patch
    const actorName = jwtUser?.name || (req.headers['x-user-name'] ? decodeURIComponent(req.headers['x-user-name'] as string) : 'A team member');
    const actorAvatar = req.headers['x-user-avatar'] ? decodeURIComponent(req.headers['x-user-avatar'] as string) : null;
    const taskTitle = updatedTask?.title || result.rows[0].title || 'Task';
    const projId = updatedTask?.projectId || result.rows[0].projectId;
    const projName = updatedTask?.projectName || '';

    const normStatus = (status || '').trim();
    const isReadyReview = normStatus.toLowerCase() === 'ready review' || normStatus.toLowerCase() === 'ready for review';
    const isCompleted = normStatus.toLowerCase() === 'completed';
    const isStatusChanged = normStatus.length > 0 && (!oldStatus || normStatus.toLowerCase() !== oldStatus.trim().toLowerCase());

    if (isStatusChanged) {
      if (isReadyReview) {
        createServerNotification(pool, {
          type: 'task_ready_review',
          title: 'Task Ready for Review',
          message: `${actorName} moved "${taskTitle}" to Ready Review.`,
          taskId: id,
          taskTitle,
          projectId: projId,
          projectName: projName,
          targetRoles: ['admin'],
          actorId: actorMemberId,
          actorName,
          actorAvatar,
        });
        notifyTelegramTaskStatusUpdate(pool, updatedTask, 'Ready Review', actorName);
      } else if (isCompleted) {
        notifyTelegramTaskStatusUpdate(pool, updatedTask, 'Completed', actorName);
      } else if (normStatus.toLowerCase() === 'blocked') {
        createServerNotification(pool, {
          type: 'task_blocked',
          title: 'Task Marked Blocked',
          message: `${actorName} flagged "${taskTitle}" as Blocked!`,
          taskId: id,
          taskTitle,
          projectId: projId,
          projectName: projName,
          targetRoles: ['admin'],
          actorId: actorMemberId,
          actorName,
          actorAvatar,
        });
      }
    }

    res.json(updatedTask || result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE task (Soft delete / Move to Recycle Bin)
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const actorMemberId = (req as any).jwtUser?.memberId || (req.headers['x-user-member-id'] as string) || null;
  try {
    const pool = getPool();
    const result = await pool.query(
      `UPDATE tasks SET deleted_at = CURRENT_TIMESTAMP, deleted_by = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND deleted_at IS NULL RETURNING id, title, project_id AS "projectId"`,
      [id, actorMemberId]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Task not found or already in Recycle Bin' });
    const deletedTask = result.rows[0];
    if (deletedTask?.projectId) {
      await syncProjectStatus(pool, deletedTask.projectId);
    }

    recordActivity(pool, {
      actionType: 'delete_task',
      entityType: 'task',
      entityId: id,
      entityName: deletedTask.title,
      projectId: deletedTask.projectId,
    }, req);

    res.json({ message: 'Task moved to Recycle Bin', id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET task timeline (comments + activity logs)
router.get('/:id/timeline', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const pool = getPool();

    // 1. Fetch comments
    const commentsQuery = `
      SELECT 
        c.id,
        c.task_id AS "taskId",
        c.user_id AS "userId",
        c.user_name AS "userName",
        c.user_avatar AS "userAvatar",
        COALESCE(tm.role, u.job_role, u.role, 'Member') AS "userRole",
        c.content,
        c.created_at AS "createdAt",
        c.updated_at AS "updatedAt",
        'comment' AS "type"
      FROM task_comments c
      LEFT JOIN team_members tm ON tm.id = c.user_id
      LEFT JOIN users u ON u.member_id = c.user_id
      WHERE c.task_id = $1
      ORDER BY c.created_at ASC;
    `;
    const commentsResult = await pool.query(commentsQuery, [id]);

    // 2. Fetch task activity logs (status changes, updates, creations)
    const activitiesQuery = `
      SELECT 
        a.id,
        a.entity_id AS "taskId",
        a.user_id AS "userId",
        a.user_name AS "userName",
        a.user_avatar AS "userAvatar",
        COALESCE(tm.role, u.job_role, u.role, 'Member') AS "userRole",
        a.action_type AS "actionType",
        a.details,
        a.created_at AS "createdAt",
        'activity' AS "type"
      FROM activity_logs a
      LEFT JOIN team_members tm ON tm.id = a.user_id
      LEFT JOIN users u ON u.member_id = a.user_id
      WHERE a.entity_type = 'task' 
        AND a.entity_id = $1 
        AND a.action_type != 'comment_task'
      ORDER BY a.created_at ASC;
    `;
    const activitiesResult = await pool.query(activitiesQuery, [id]);

    // Merge chronologically
    const combined = [...commentsResult.rows, ...activitiesResult.rows].sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      return timeA - timeB;
    });

    res.json({
      timeline: combined,
      commentCount: commentsResult.rows.length,
    });
  } catch (err: any) {
    console.error('Error fetching task timeline:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST new comment on task
router.post('/:id/comments', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { content } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Comment content cannot be empty' });
  }

  const jwtUser = (req as any).jwtUser as JwtPayload | undefined;
  const actorMemberId = jwtUser?.memberId || (req.headers['x-user-member-id'] as string) || req.body.userId || null;
  const headerName = jwtUser?.name || (req.headers['x-user-name'] ? decodeURIComponent(req.headers['x-user-name'] as string) : (req.body.userName || ''));
  const headerAvatar = req.headers['x-user-avatar'] ? decodeURIComponent(req.headers['x-user-avatar'] as string) : (req.body.userAvatar || null);

  try {
    const pool = getPool();

    // Verify task exists
    const taskRes = await pool.query('SELECT id, title, project_id FROM tasks WHERE id = $1 AND deleted_at IS NULL', [id]);
    if (taskRes.rowCount === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    const task = taskRes.rows[0];

    let userName = headerName;
    let userAvatar = headerAvatar;
    let userRole = 'Member';

    if (actorMemberId) {
      const memberRes = await pool.query(
        `SELECT tm.name, tm.avatar, COALESCE(tm.role, u.job_role, u.role, 'Member') AS role
         FROM team_members tm
         LEFT JOIN users u ON u.member_id = tm.id
         WHERE tm.id = $1`,
        [actorMemberId]
      );
      if (memberRes.rowCount > 0) {
        userName = memberRes.rows[0].name || userName;
        userAvatar = memberRes.rows[0].avatar !== undefined && memberRes.rows[0].avatar !== null ? memberRes.rows[0].avatar : userAvatar;
        userRole = memberRes.rows[0].role || userRole;
      }
    }

    if (!userName) userName = 'Team Member';

    const commentId = `com-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const insertQuery = `
      INSERT INTO task_comments (id, task_id, user_id, user_name, user_avatar, content, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING 
        id, 
        task_id AS "taskId", 
        user_id AS "userId", 
        user_name AS "userName", 
        user_avatar AS "userAvatar", 
        content, 
        created_at AS "createdAt", 
        updated_at AS "updatedAt";
    `;
    const insertRes = await pool.query(insertQuery, [
      commentId,
      id,
      actorMemberId,
      userName,
      userAvatar,
      content.trim(),
    ]);

    const newComment = {
      ...insertRes.rows[0],
      userRole,
      type: 'comment',
    };

    // Record activity log for team dashboard
    recordActivity(pool, {
      actionType: 'comment_task',
      entityType: 'task',
      entityId: id,
      entityName: task.title,
      projectId: task.project_id,
      details: { commentPreview: content.trim().substring(0, 100) },
    }, req);

    // Get updated total comment count
    const countRes = await pool.query('SELECT COUNT(*)::int AS count FROM task_comments WHERE task_id = $1', [id]);
    const commentCount = countRes.rows[0]?.count || 1;

    res.status(201).json({
      comment: newComment,
      commentCount,
    });
  } catch (err: any) {
    console.error('Error creating task comment:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE comment on task
router.delete('/:id/comments/:commentId', requireAuth, async (req: Request, res: Response) => {
  const { id, commentId } = req.params;
  const jwtUser = (req as any).jwtUser as JwtPayload | undefined;
  const actorMemberId = jwtUser?.memberId || (req.headers['x-user-member-id'] as string) || null;
  const actorRole = jwtUser?.role || (req.headers['x-user-role'] as string) || '';

  try {
    const pool = getPool();
    const commentRes = await pool.query('SELECT * FROM task_comments WHERE id = $1 AND task_id = $2', [commentId, id]);
    if (commentRes.rowCount === 0) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    const comment = commentRes.rows[0];
    const isAuthor = Boolean(actorMemberId && comment.user_id === actorMemberId);
    const isAdmin = actorRole.toLowerCase().includes('admin') || actorRole.toLowerCase().includes('manager');

    if (!isAuthor && !isAdmin && actorMemberId) {
      return res.status(403).json({ error: 'You do not have permission to delete this comment' });
    }

    await pool.query('DELETE FROM task_comments WHERE id = $1', [commentId]);

    const countRes = await pool.query('SELECT COUNT(*)::int AS count FROM task_comments WHERE task_id = $1', [id]);
    const commentCount = countRes.rows[0]?.count || 0;

    res.json({
      message: 'Comment deleted successfully',
      id: commentId,
      commentCount,
    });
  } catch (err: any) {
    console.error('Error deleting task comment:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET all subtasks for a task
router.get('/:id/subtasks', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const pool = getPool();
    const query = `
      SELECT 
        id, 
        task_id AS "taskId", 
        title, 
        completed, 
        position, 
        created_at AS "createdAt", 
        updated_at AS "updatedAt"
      FROM task_subtasks
      WHERE task_id = $1
      ORDER BY position ASC, created_at ASC;
    `;
    const result = await pool.query(query, [id]);
    res.json(result.rows);
  } catch (err: any) {
    console.error('Error fetching subtasks:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST add new subtask to a task
router.post('/:id/subtasks', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { title } = req.body;
  const callerRole = (req as any).jwtUser?.role || (req.headers['x-user-role'] as string) || '';
  const callerMemberId = (req as any).jwtUser?.memberId || (req.headers['x-user-member-id'] as string) || '';

  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Subtask title cannot be empty' });
  }

  try {
    const pool = getPool();
    // Permission check: Staff can only update checklist for tasks assigned to them
    if (callerRole === 'staff') {
      const taskRes = await pool.query('SELECT assignee_id FROM tasks WHERE id = $1', [id]);
      if (taskRes.rowCount === 0) {
        return res.status(404).json({ error: 'Task not found' });
      }
      if (taskRes.rows[0].assignee_id !== callerMemberId) {
        return res.status(403).json({ error: 'Permission denied. Only assigned staff can update this task checklist.' });
      }
    }

    // Get next position index
    const posRes = await pool.query(
      'SELECT COALESCE(MAX(position), -1) + 1 AS next_pos FROM task_subtasks WHERE task_id = $1',
      [id]
    );
    const nextPos = parseInt(posRes.rows[0].next_pos, 10);
    const subId = `sub-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const insertQuery = `
      INSERT INTO task_subtasks (id, task_id, title, completed, position, created_at, updated_at)
      VALUES ($1, $2, $3, FALSE, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING 
        id, 
        task_id AS "taskId", 
        title, 
        completed, 
        position, 
        created_at AS "createdAt", 
        updated_at AS "updatedAt";
    `;
    const result = await pool.query(insertQuery, [subId, id, title.trim(), nextPos]);
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    console.error('Error adding subtask:', err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH update subtask (toggle completed or edit title)
router.patch('/:id/subtasks/:subtaskId', requireAuth, async (req: Request, res: Response) => {
  const { id, subtaskId } = req.params;
  const { title, completed, position } = req.body;
  const callerRole = (req as any).jwtUser?.role || (req.headers['x-user-role'] as string) || '';
  const callerMemberId = (req as any).jwtUser?.memberId || (req.headers['x-user-member-id'] as string) || '';

  try {
    const pool = getPool();
    // Permission check: Staff can only update checklist for tasks assigned to them
    if (callerRole === 'staff') {
      const taskRes = await pool.query('SELECT assignee_id FROM tasks WHERE id = $1', [id]);
      if (taskRes.rowCount === 0) {
        return res.status(404).json({ error: 'Task not found' });
      }
      if (taskRes.rows[0].assignee_id !== callerMemberId) {
        return res.status(403).json({ error: 'Permission denied. Only assigned staff can update this task checklist.' });
      }
    }

    const updateQuery = `
      UPDATE task_subtasks
      SET 
        title = COALESCE($1, title),
        completed = COALESCE($2, completed),
        position = COALESCE($3, position),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $4 AND task_id = $5
      RETURNING 
        id, 
        task_id AS "taskId", 
        title, 
        completed, 
        position, 
        created_at AS "createdAt", 
        updated_at AS "updatedAt";
    `;
    const result = await pool.query(updateQuery, [
      title !== undefined ? title.trim() : null,
      completed !== undefined ? Boolean(completed) : null,
      position !== undefined ? parseInt(position, 10) : null,
      subtaskId,
      id,
    ]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Subtask not found' });
    }

    res.json(result.rows[0]);
  } catch (err: any) {
    console.error('Error updating subtask:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE subtask
router.delete('/:id/subtasks/:subtaskId', requireAuth, async (req: Request, res: Response) => {
  const { id, subtaskId } = req.params;
  const callerRole = (req as any).jwtUser?.role || (req.headers['x-user-role'] as string) || '';
  const callerMemberId = (req as any).jwtUser?.memberId || (req.headers['x-user-member-id'] as string) || '';

  try {
    const pool = getPool();
    // Permission check: Staff can only update checklist for tasks assigned to them
    if (callerRole === 'staff') {
      const taskRes = await pool.query('SELECT assignee_id FROM tasks WHERE id = $1', [id]);
      if (taskRes.rowCount === 0) {
        return res.status(404).json({ error: 'Task not found' });
      }
      if (taskRes.rows[0].assignee_id !== callerMemberId) {
        return res.status(403).json({ error: 'Permission denied. Only assigned staff can update this task checklist.' });
      }
    }

    const result = await pool.query('DELETE FROM task_subtasks WHERE id = $1 AND task_id = $2', [subtaskId, id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Subtask not found' });
    }
    res.json({ message: 'Subtask deleted', id: subtaskId });
  } catch (err: any) {
    console.error('Error deleting subtask:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;

