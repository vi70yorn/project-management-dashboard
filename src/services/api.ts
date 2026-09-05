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
// Team Members API
// -------------------------------------------------------------

export async function fetchMembersApi(): Promise<TeamMember[]> {
  const res = await fetch(`${API_BASE}/members`);
  if (!res.ok) throw new Error(`Failed to fetch team members (${res.status})`);
  return res.json();
}

export async function createMemberApi(memberData: Partial<TeamMember>): Promise<TeamMember> {
  const res = await fetch(`${API_BASE}/members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(memberData),
  });
  if (!res.ok) throw new Error(`Failed to create member (${res.status})`);
  return res.json();
}

export async function updateMemberApi(
  id: string,
  memberData: Partial<TeamMember>
): Promise<TeamMember> {
  const res = await fetch(`${API_BASE}/members/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(memberData),
  });
  if (!res.ok) throw new Error(`Failed to update member (${res.status})`);
  return res.json();
}

export async function deleteMemberApi(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/members/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`Failed to delete member (${res.status})`);
}
