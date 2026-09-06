import { Project, Task, TeamMember, StatusType } from '../types';

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
    const data = await res.json();
    return data;
  } catch (err: any) {
    return {
      status: 'error',
      connected: false,
      message: err.message || 'Cannot reach API server (localhost:5000)',
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

export async function createProjectApi(
  projectData: Omit<Project, 'id' | 'createdAt'> & { id?: string }
): Promise<Project> {
  const res = await fetch(`${API_BASE}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(projectData),
  });
  if (!res.ok) throw new Error(`Failed to create project (${res.status})`);
  return res.json();
}

export async function updateProjectApi(
  id: string,
  projectData: Partial<Project>
): Promise<Project> {
  const res = await fetch(`${API_BASE}/projects/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(projectData),
  });
  if (!res.ok) throw new Error(`Failed to update project (${res.status})`);
  return res.json();
}

export async function updateProjectStatusApi(
  id: string,
  status: StatusType
): Promise<Project> {
  const res = await fetch(`${API_BASE}/projects/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error(`Failed to update project status (${res.status})`);
  return res.json();
}

export async function updateProjectMembersApi(
  id: string,
  memberIds: string[]
): Promise<{ projectId: string; memberIds: string[] }> {
  const res = await fetch(`${API_BASE}/projects/${id}/members`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ memberIds }),
  });
  if (!res.ok) throw new Error(`Failed to update project members (${res.status})`);
  return res.json();
}

export async function deleteProjectApi(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/projects/${id}`, {
    method: 'DELETE',
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

export async function createTaskApi(taskData: Partial<Task>): Promise<Task> {
  const res = await fetch(`${API_BASE}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(taskData),
  });
  if (!res.ok) throw new Error(`Failed to create task (${res.status})`);
  return res.json();
}

export async function updateTaskApi(id: string, taskData: Partial<Task>): Promise<Task> {
  const res = await fetch(`${API_BASE}/tasks/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(taskData),
  });
  if (!res.ok) throw new Error(`Failed to update task (${res.status})`);
  return res.json();
}

export async function updateTaskStatusApi(
  id: string,
  status: StatusType
): Promise<{ id: string; projectId: string; status: StatusType; updatedAt: string }> {
  const res = await fetch(`${API_BASE}/tasks/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error(`Failed to update task status (${res.status})`);
  return res.json();
}

export async function deleteTaskApi(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/tasks/${id}`, {
    method: 'DELETE',
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
  memberData: Partial<TeamMember>,
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
  memberData: Partial<TeamMember>,
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

