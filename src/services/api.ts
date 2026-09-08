import { Project, Task, TeamMember, StatusType, RecycleBinData, TaskComment, TaskTimelineResponse, TaskSubtask } from '../types';
import { loadAuthUser } from './storage';

const API_BASE = '/api';

export interface DatabaseHealthResponse {
  status: 'ok' | 'error';
  connected: boolean;
  database?: string;
  serverTime?: string;
  message?: string;
  counts?: {
    projects: number;
    tasks: number;
    members: number;
  };
  dbeaverConnection?: {
    host: string;
    port: number;
    database: string;
    user: string;
  };
}

// -------------------------------------------------------------
// Database Health
// -------------------------------------------------------------

export async function checkDatabaseHealth(): Promise<DatabaseHealthResponse> {
  try {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return {
        status: 'error',
        connected: false,
        message: err.message || `Server responded with status ${res.status}`,
      };
    }
    return res.json();
  } catch (err: any) {
    return {
      status: 'error',
      connected: false,
      message: err.message || 'Cannot reach local backend server',
    };
  }
}

// -------------------------------------------------------------
// Projects API
// -------------------------------------------------------------

export async function fetchProjectsApi(): Promise<Project[]> {
  const res = await fetch(`${API_BASE}/projects`);
  if (!res.ok) throw new Error(`Failed to fetch projects (${res.status})`);
  return res.json();
}

function getAuthHeaders(user?: { memberId?: string; name?: string; avatar?: string; role?: string } | null): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const authUser = user || loadAuthUser();
  if (authUser?.memberId) {
    headers['x-user-member-id'] = authUser.memberId;
  }
  if (authUser?.name) {
    headers['x-user-name'] = encodeURIComponent(authUser.name);
  }
  if (authUser?.avatar) {
    headers['x-user-avatar'] = encodeURIComponent(authUser.avatar);
  }
  if (authUser?.role) {
    headers['x-user-role'] = authUser.role;
  }
  return headers;
}

export async function createProjectApi(
  projectData: Omit<Project, 'id' | 'createdAt'> & { id?: string },
  currentUser?: { memberId?: string; name?: string } | null
): Promise<Project> {
  const res = await fetch(`${API_BASE}/projects`, {
    method: 'POST',
    headers: getAuthHeaders(currentUser),
    body: JSON.stringify(projectData),
  });
  if (!res.ok) throw new Error(`Failed to create project (${res.status})`);
  return res.json();
}

export async function updateProjectApi(
  id: string,
  projectData: Partial<Project>,
  currentUser?: { memberId?: string; name?: string } | null
): Promise<Project> {
  const res = await fetch(`${API_BASE}/projects/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(currentUser),
    body: JSON.stringify(projectData),
  });
  if (!res.ok) throw new Error(`Failed to update project (${res.status})`);
  return res.json();
}

export async function updateProjectStatusApi(
  id: string,
  status: StatusType,
  currentUser?: { memberId?: string; name?: string } | null
): Promise<Project> {
  const res = await fetch(`${API_BASE}/projects/${id}/status`, {
    method: 'PATCH',
    headers: getAuthHeaders(currentUser),
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error(`Failed to update project status (${res.status})`);
  return res.json();
}

export async function updateProjectMembersApi(
  id: string,
  memberIds: string[],
  currentUser?: { memberId?: string; name?: string } | null
): Promise<{ projectId: string; memberIds: string[] }> {
  const res = await fetch(`${API_BASE}/projects/${id}/members`, {
    method: 'PATCH',
    headers: getAuthHeaders(currentUser),
    body: JSON.stringify({ memberIds }),
  });
  if (!res.ok) throw new Error(`Failed to update project members (${res.status})`);
  return res.json();
}

export async function deleteProjectApi(
  id: string,
  currentUser?: { memberId?: string; name?: string } | null
): Promise<void> {
  const headers = getAuthHeaders(currentUser);
  delete headers['Content-Type'];
  const res = await fetch(`${API_BASE}/projects/${id}`, {
    method: 'DELETE',
    headers,
  });
  if (!res.ok) throw new Error(`Failed to delete project (${res.status})`);
}

// -------------------------------------------------------------
// Tasks API
// -------------------------------------------------------------

export async function fetchTasksApi(): Promise<Task[]> {
  const res = await fetch(`${API_BASE}/tasks`);
  if (!res.ok) throw new Error(`Failed to fetch tasks (${res.status})`);
  return res.json();
}

export async function createTaskApi(
  taskData: Partial<Task>,
  currentUser?: { memberId?: string; name?: string } | null
): Promise<Task> {
  const res = await fetch(`${API_BASE}/tasks`, {
    method: 'POST',
    headers: getAuthHeaders(currentUser),
    body: JSON.stringify(taskData),
  });
  if (!res.ok) throw new Error(`Failed to create task (${res.status})`);
  return res.json();
}

export async function updateTaskApi(
  id: string,
  taskData: Partial<Task>,
  currentUser?: { memberId?: string; name?: string } | null
): Promise<Task> {
  const res = await fetch(`${API_BASE}/tasks/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(currentUser),
    body: JSON.stringify(taskData),
  });
  if (!res.ok) throw new Error(`Failed to update task (${res.status})`);
  return res.json();
}

export async function updateTaskStatusApi(
  id: string,
  status: StatusType,
  currentUser?: { memberId?: string; name?: string } | null
): Promise<{ id: string; projectId: string; status: StatusType; updatedAt: string }> {
  const res = await fetch(`${API_BASE}/tasks/${id}/status`, {
    method: 'PATCH',
    headers: getAuthHeaders(currentUser),
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error(`Failed to update task status (${res.status})`);
  return res.json();
}

export async function deleteTaskApi(
  id: string,
  currentUser?: { memberId?: string; name?: string } | null
): Promise<void> {
  const headers = getAuthHeaders(currentUser);
  delete headers['Content-Type'];
  const res = await fetch(`${API_BASE}/tasks/${id}`, {
    method: 'DELETE',
    headers,
  });
  if (!res.ok) throw new Error(`Failed to delete task (${res.status})`);
}

// -------------------------------------------------------------
// Authentication & Password Management API
// -------------------------------------------------------------

export async function loginApi(username: string, password: string): Promise<any> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Authentication failed');
  }
  return data;
}

export async function changePasswordApi(
  memberId: string,
  currentPassword: string,
  newPassword: string
): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE}/auth/change-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ memberId, currentPassword, newPassword }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to change password');
  }
  return data;
}

export async function adminResetPasswordApi(
  memberId: string,
  newPassword: string,
  callerRole: string = 'admin'
): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE}/auth/admin-reset-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-role': callerRole,
    },
    body: JSON.stringify({ memberId, newPassword }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to reset member password');
  }
  return data;
}

// -------------------------------------------------------------
// Team Members API
// -------------------------------------------------------------

export async function fetchMembersApi(userRole?: string): Promise<TeamMember[]> {
  const headers: Record<string, string> = {};
  if (userRole) {
    headers['x-user-role'] = userRole;
  }

  const res = await fetch(`${API_BASE}/members`, { headers });
  if (!res.ok) throw new Error(`Failed to fetch team members (${res.status})`);
  return res.json();
}

export async function createMemberApi(
  memberData: Partial<TeamMember> & { projectIds?: string[] },
  userRole: string = 'admin'
): Promise<TeamMember> {
  const res = await fetch(`${API_BASE}/members`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-role': userRole,
    },
    body: JSON.stringify(memberData),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Failed to create member (${res.status})`);
  return data;
}

export async function updateMemberApi(
  id: string,
  memberData: Partial<TeamMember> & { projectIds?: string[] },
  userRole?: string,
  callerMemberId?: string
): Promise<TeamMember> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (userRole) {
    headers['x-user-role'] = userRole;
  }
  if (callerMemberId) {
    headers['x-user-member-id'] = callerMemberId;
  }

  const res = await fetch(`${API_BASE}/members/${id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(memberData),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Failed to update member (${res.status})`);
  return data;
}

export async function updateMemberProjectsApi(
  memberId: string,
  projectIds: string[],
  userRole: string = 'admin'
): Promise<{ memberId: string; projectIds: string[] }> {
  const res = await fetch(`${API_BASE}/members/${memberId}/projects`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'x-user-role': userRole,
    },
    body: JSON.stringify({ projectIds }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Failed to update member projects (${res.status})`);
  return data;
}

export async function deleteMemberApi(id: string, userRole: string = 'admin'): Promise<void> {
  const res = await fetch(`${API_BASE}/members/${id}`, {
    method: 'DELETE',
    headers: {
      'x-user-role': userRole,
    },
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to delete member (${res.status})`);
  }
}

// -------------------------------------------------------------
// Telegram Automated Weekly Report API
// -------------------------------------------------------------

export interface TelegramSettings {
  enabled: boolean;
  hasToken: boolean;
  botTokenMasked: string;
  chatId: string;
  sendDay: string;
  sendTime: string;
  lastSentAt: string | null;
  lastAutoSentDate?: string | null;
  serverCurrentDay?: string;
  serverCurrentTime?: string;
  serverTimezone?: string;
}

export async function fetchTelegramSettingsApi(): Promise<TelegramSettings> {
  const res = await fetch(`${API_BASE}/telegram/settings`);
  if (!res.ok) throw new Error('Failed to fetch Telegram settings');
  return res.json();
}

export async function updateTelegramSettingsApi(settings: {
  botToken?: string;
  chatId?: string;
  enabled?: boolean;
  sendDay?: string;
  sendTime?: string;
}): Promise<TelegramSettings> {
  const res = await fetch(`${API_BASE}/telegram/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to update Telegram settings');
  return data;
}

export async function testTelegramApi(botToken?: string, chatId?: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/telegram/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ botToken, chatId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to send test message');
  return data;
}

export async function sendTelegramWeeklyReportApi(): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/telegram/send-report`, {
    method: 'POST',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to send weekly report to Telegram');
  return data;
}

// -------------------------------------------------------------
// Team Activity Logs API
// -------------------------------------------------------------

export interface ActivityLog {
  id: string;
  userId?: string | null;
  userName: string;
  userAvatar?: string | null;
  userColor?: string | null;
  userRole?: string | null;
  actionType: string;
  entityType: 'task' | 'project';
  entityId: string;
  entityName: string;
  projectId?: string | null;
  projectName?: string | null;
  details?: Record<string, any>;
  createdAt: string;
}

export async function fetchActivitiesApi(limit: number = 50): Promise<ActivityLog[]> {
  const res = await fetch(`${API_BASE}/activities?limit=${limit}`);
  if (!res.ok) throw new Error(`Failed to fetch activities (${res.status})`);
  return res.json();
}

// -------------------------------------------------------------
// Recycle Bin API
// -------------------------------------------------------------

export async function fetchRecycleBinApi(): Promise<RecycleBinData> {
  const res = await fetch(`${API_BASE}/recycle-bin`);
  if (!res.ok) throw new Error(`Failed to fetch recycle bin (${res.status})`);
  return res.json();
}

export async function restoreRecycleBinItemApi(
  type: 'project' | 'task',
  id: string,
  currentUser?: { memberId?: string; name?: string } | null
): Promise<{ success: boolean; message: string; id: string; type: string }> {
  const res = await fetch(`${API_BASE}/recycle-bin/restore`, {
    method: 'POST',
    headers: getAuthHeaders(currentUser),
    body: JSON.stringify({ type, id }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to restore item from recycle bin');
  return data;
}

export async function permanentlyDeleteItemApi(
  type: 'project' | 'task',
  id: string
): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/recycle-bin/${type}/${id}`, {
    method: 'DELETE',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to permanently delete item');
  return data;
}

export async function emptyRecycleBinApi(): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/recycle-bin`, {
    method: 'DELETE',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to empty recycle bin');
  return data;
}

// -------------------------------------------------------------
// Task Timeline & Comments API
// -------------------------------------------------------------

export async function fetchTaskTimelineApi(taskId: string): Promise<TaskTimelineResponse> {
  const res = await fetch(`${API_BASE}/tasks/${taskId}/timeline`);
  if (!res.ok) throw new Error(`Failed to fetch task timeline (${res.status})`);
  return res.json();
}

export async function addTaskCommentApi(
  taskId: string,
  content: string,
  currentUser?: { memberId?: string; name?: string; avatar?: string; role?: string } | null
): Promise<{ comment: TaskComment; commentCount: number }> {
  const res = await fetch(`${API_BASE}/tasks/${taskId}/comments`, {
    method: 'POST',
    headers: getAuthHeaders(currentUser),
    body: JSON.stringify({ content }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to post comment');
  return data;
}

export async function deleteTaskCommentApi(
  taskId: string,
  commentId: string,
  currentUser?: { memberId?: string; name?: string; avatar?: string; role?: string } | null
): Promise<{ message: string; id: string; commentCount: number }> {
  const res = await fetch(`${API_BASE}/tasks/${taskId}/comments/${commentId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(currentUser),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to delete comment');
  return data;
}

// -------------------------------------------------------------
// Task Subtasks & Deliverable Checklists API
// -------------------------------------------------------------

export async function fetchTaskSubtasksApi(taskId: string): Promise<TaskSubtask[]> {
  const res = await fetch(`${API_BASE}/tasks/${taskId}/subtasks`);
  if (!res.ok) throw new Error(`Failed to fetch subtasks (${res.status})`);
  return res.json();
}

export async function addTaskSubtaskApi(
  taskId: string,
  title: string,
  currentUser?: { memberId?: string; name?: string; avatar?: string; role?: string } | null
): Promise<TaskSubtask> {
  const res = await fetch(`${API_BASE}/tasks/${taskId}/subtasks`, {
    method: 'POST',
    headers: getAuthHeaders(currentUser),
    body: JSON.stringify({ title }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to add subtask');
  return data;
}

export async function updateTaskSubtaskApi(
  taskId: string,
  subtaskId: string,
  updates: Partial<TaskSubtask>,
  currentUser?: { memberId?: string; name?: string; avatar?: string; role?: string } | null
): Promise<TaskSubtask> {
  const res = await fetch(`${API_BASE}/tasks/${taskId}/subtasks/${subtaskId}`, {
    method: 'PATCH',
    headers: getAuthHeaders(currentUser),
    body: JSON.stringify(updates),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to update subtask');
  return data;
}

export async function deleteTaskSubtaskApi(
  taskId: string,
  subtaskId: string,
  currentUser?: { memberId?: string; name?: string; avatar?: string; role?: string } | null
): Promise<{ id: string }> {
  const res = await fetch(`${API_BASE}/tasks/${taskId}/subtasks/${subtaskId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(currentUser),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to delete subtask');
  return data;
}




