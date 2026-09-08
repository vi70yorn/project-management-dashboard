import { loadAuthUser } from './storage';

const API_BASE = '/api/ai';

function getAuthHeaders(): HeadersInit {
  const user = loadAuthUser();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (user) {
    if (user.role) headers['x-user-role'] = user.role;
    if (user.memberId) headers['x-user-member-id'] = user.memberId;
    if (user.name) headers['x-user-name'] = user.name;
  }
  return headers;
}

export interface AISettingsStatus {
  configured: boolean;
  model: string;
  enabled: boolean;
  source: 'env' | 'database' | 'none';
  maskedApiKey?: string;
}

export interface AIRiskAnalysisResult {
  health: 'Healthy' | 'Moderate Risk' | 'Critical Risk';
  healthScore: number;
  summary: string;
  bottlenecks: Array<{
    title: string;
    severity: 'high' | 'medium' | 'low';
    description: string;
    suggestion: string;
  }>;
  recommendations: string[];
}

export interface ChatHistoryItem {
  role: 'user' | 'model' | 'assistant';
  content: string;
}

// ---------------------------------------------------------------------------
// 1. AI Settings & Status
// ---------------------------------------------------------------------------

export async function fetchAIStatusApi(): Promise<AISettingsStatus> {
  const res = await fetch(`${API_BASE}/status`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function saveAISettingsApi(params: {
  apiKey?: string;
  model?: string;
  enabled?: boolean;
}): Promise<{ success: boolean; settings: AISettingsStatus }> {
  const res = await fetch(`${API_BASE}/settings`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function testAIConnectionApi(params?: {
  apiKey?: string;
  model?: string;
}): Promise<{ success: boolean; message: string; response?: string }> {
  const res = await fetch(`${API_BASE}/test`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(params || {}),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// 2. Feature 1: Generate / Polish Acceptance Criteria
// ---------------------------------------------------------------------------

export async function generateCriteriaApi(params: {
  title: string;
  projectName?: string;
  existingText?: string;
  mode?: 'draft' | 'polish';
  type?: 'task' | 'project';
}): Promise<string> {
  const res = await fetch(`${API_BASE}/generate-criteria`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.text;
}

// ---------------------------------------------------------------------------
// 3. Feature 3: Executive Weekly Briefing
// ---------------------------------------------------------------------------

export async function generateWeeklyBriefingApi(params: {
  weekLabel: string;
  metrics: {
    totalProjects: number;
    completedProjects: number;
    totalTasks: number;
    completedTasks: number;
    blockedTasks: number;
    overallRate: number;
  };
  projects: Array<{
    name: string;
    client: string;
    status: string;
    completedTasks: number;
    totalTasks: number;
  }>;
  highlightTasks?: Array<{
    title: string;
    projectName: string;
    status: string;
    assigneeName?: string;
  }>;
}): Promise<{ briefing: string; telegramSnippet: string }> {
  const res = await fetch(`${API_BASE}/weekly-briefing`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// 4. Feature 4: Risk & Workload Bottleneck Analysis
// ---------------------------------------------------------------------------

export async function analyzeProjectRisksApi(params: {
  projects: any[];
  tasks: any[];
  teamMembers: any[];
}): Promise<AIRiskAnalysisResult> {
  const res = await fetch(`${API_BASE}/risk-analysis`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// 5. Feature 5: Copilot Chat
// ---------------------------------------------------------------------------

export async function chatWithCopilotApi(params: {
  message: string;
  history?: ChatHistoryItem[];
  context?: any;
}): Promise<string> {
  const res = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.reply;
}
