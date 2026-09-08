import { GoogleGenAI } from '@google/genai';
import { Pool } from 'pg';

export interface AISettingsInfo {
  configured: boolean;
  model: string;
  enabled: boolean;
  source: 'env' | 'database' | 'none';
  maskedApiKey?: string;
}

export interface CriteriaRequest {
  title: string;
  projectName?: string;
  existingText?: string;
  mode?: 'draft' | 'polish';
  type?: 'task' | 'project';
}

export interface WeeklyBriefingRequest {
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
}

export interface RiskAnalysisRequest {
  projects: Array<{
    id: string;
    name: string;
    status: string;
    targetDeadline?: string;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    assigneeName?: string;
    assigneeId?: string;
    dueDate?: string;
    projectName?: string;
  }>;
  teamMembers: Array<{
    id: string;
    name: string;
    role: string;
  }>;
}

export interface ChatMessage {
  role: 'user' | 'model' | 'assistant';
  content: string;
}

export interface CopilotChatRequest {
  message: string;
  history?: ChatMessage[];
  context?: {
    projectsCount?: number;
    tasksCount?: number;
    teamCount?: number;
    activeProjects?: string[];
    urgentTasks?: string[];
    blockedTasks?: string[];
    overdueTasks?: string[];
  };
}

/**
 * Retrieve the active Google Gemini API key and model.
 * Prioritizes process.env.GEMINI_API_KEY, falling back to database ai_settings.
 */
export async function getActiveAIConfig(pool: Pool): Promise<{
  apiKey: string | null;
  model: string;
  enabled: boolean;
  source: 'env' | 'database' | 'none';
}> {
  const envKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : '';
  const defaultModel = process.env.GEMINI_MODEL || 'gemini-3.6-flash';

  if (envKey) {
    return {
      apiKey: envKey,
      model: defaultModel,
      enabled: true,
      source: 'env',
    };
  }

  try {
    const res = await pool.query('SELECT api_key, model, enabled FROM ai_settings WHERE id = $1', ['default']);
    if (res.rows.length > 0) {
      const row = res.rows[0];
      const dbKey = (row.api_key || '').trim();
      if (dbKey) {
        return {
          apiKey: dbKey,
          model: row.model || defaultModel,
          enabled: row.enabled ?? true,
          source: 'database',
        };
      }
      return {
        apiKey: null,
        model: row.model || defaultModel,
        enabled: row.enabled ?? true,
        source: 'none',
      };
    }
  } catch (err) {
    console.error('Error fetching AI settings from database:', err);
  }

  return {
    apiKey: null,
    model: defaultModel,
    enabled: true,
    source: 'none',
  };
}

/**
 * Get AI status info for frontend (hiding raw secret key)
 */
export async function getAIStatus(pool: Pool): Promise<AISettingsInfo> {
  const config = await getActiveAIConfig(pool);
  const isConfigured = Boolean(config.apiKey && config.apiKey.length > 5);

  let masked: string | undefined = undefined;
  if (config.apiKey) {
    const len = config.apiKey.length;
    if (len > 8) {
      masked = `${config.apiKey.slice(0, 4)}••••••••${config.apiKey.slice(-4)}`;
    } else {
      masked = '••••••••';
    }
  }

  return {
    configured: isConfigured,
    model: config.model,
    enabled: config.enabled,
    source: config.source,
    maskedApiKey: masked,
  };
}

/**
 * Save AI settings into PostgreSQL database
 */
export async function saveAISettings(
  pool: Pool,
  params: { apiKey?: string; model?: string; enabled?: boolean }
): Promise<AISettingsInfo> {
  const current = await pool.query('SELECT api_key, model, enabled FROM ai_settings WHERE id = $1', ['default']);
  const existingRow = current.rows[0] || {};

  const newKey = params.apiKey !== undefined ? params.apiKey.trim() : existingRow.api_key;
  const newModel = params.model || existingRow.model || 'gemini-3.6-flash';
  const newEnabled = params.enabled !== undefined ? params.enabled : (existingRow.enabled ?? true);

  await pool.query(
    `INSERT INTO ai_settings (id, api_key, model, enabled, updated_at)
     VALUES ('default', $1, $2, $3, CURRENT_TIMESTAMP)
     ON CONFLICT (id) DO UPDATE
     SET api_key = EXCLUDED.api_key,
         model = EXCLUDED.model,
         enabled = EXCLUDED.enabled,
         updated_at = CURRENT_TIMESTAMP`,
    [newKey || null, newModel, newEnabled]
  );

  return getAIStatus(pool);
}

/**
 * Initialize Google GenAI client
 */
function getAIClient(apiKey: string): GoogleGenAI {
  return new GoogleGenAI({ apiKey });
}

/**
 * Quick connection test
 */
export async function testAIConnection(apiKey: string, model: string = 'gemini-3.6-flash'): Promise<{
  success: boolean;
  message: string;
  response?: string;
}> {
  try {
    const ai = getAIClient(apiKey);
    const result = await ai.models.generateContent({
      model,
      contents: 'Respond with exactly: "Gemini connection successful!"',
    });

    const text = result.text ? result.text.trim() : '';
    return {
      success: true,
      message: 'Connection verified successfully with Google Gemini.',
      response: text,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'Failed to connect to Google Gemini API.',
    };
  }
}

/**
 * Feature 1: Generate or polish Task Acceptance Criteria / Project Description
 */
export async function generateCriteria(pool: Pool, req: CriteriaRequest): Promise<string> {
  const config = await getActiveAIConfig(pool);
  if (!config.apiKey) {
    throw new Error('Google Gemini API Key is not configured. Please add your key in AI Settings or .env file.');
  }

  const ai = getAIClient(config.apiKey);
  const isProject = req.type === 'project';
  const mode = req.mode || 'draft';

  const systemInstruction = `You are a Senior Technical Project Manager and Product Owner.
Format your output cleanly in Markdown suited for a 10-line view:
- Use **Bold** for deliverable titles, section headers, and requirements
- Use > Quotes for critical caveats, constraints, or client requirements
- Use \`code\` for technical endpoints, file names, or tokens
- Use <u>Underline</u> tags sparingly (e.g. <u>MUST PASS</u>)
- Keep paragraphs concise, actionable, and formatted as clear bullet points.
- Do NOT output preamble, markdown backticks, or greetings. Output only the formatted content directly.`;

  let prompt = '';
  if (isProject) {
    if (mode === 'polish' && req.existingText) {
      prompt = `Refine and elevate this Project Description & Objectives into a crisp, high-impact executive statement with deliverables:\n\nProject Name: "${req.title}"\nExisting Draft:\n${req.existingText}`;
    } else {
      prompt = `Draft a comprehensive, professional Project Description & Objectives for:\nProject Name: "${req.title}"\nInclude Project Scope, Key Objectives, Core Deliverables, and Success Metrics.`;
    }
  } else {
    // Task deliverable
    if (mode === 'polish' && req.existingText) {
      prompt = `Refine and structure the following task notes into professional Acceptance Criteria & Deliverable Scope:\nTask Title: "${req.title}"\nProject: "${req.projectName || 'Active Project'}"\nExisting Notes:\n${req.existingText}`;
    } else {
      prompt = `Draft structured Acceptance Criteria & Deliverable Scope for:\nTask Title: "${req.title}"\nProject: "${req.projectName || 'Active Project'}"\nInclude Definition of Done, Key Acceptance Criteria, Deliverables checklist, and Technical Considerations.`;
    }
  }

  const result = await ai.models.generateContent({
    model: config.model,
    contents: `${systemInstruction}\n\n${prompt}`,
  });

  return result.text ? result.text.trim() : '';
}

/**
 * Feature 3: Generate Executive Weekly Briefing & Telegram Summary
 */
export async function generateWeeklyBriefing(pool: Pool, req: WeeklyBriefingRequest): Promise<{
  briefing: string;
  telegramSnippet: string;
}> {
  const config = await getActiveAIConfig(pool);
  if (!config.apiKey) {
    throw new Error('Google Gemini API Key is not configured. Please add your key in AI Settings or .env file.');
  }

  const ai = getAIClient(config.apiKey);

  const contextData = `
Week: ${req.weekLabel}
Overall Completion Rate: ${req.metrics.overallRate}% (${req.metrics.completedTasks}/${req.metrics.totalTasks} tasks done)
Projects: ${req.metrics.totalProjects} total (${req.metrics.completedProjects} completed)
Blocked Deliverables: ${req.metrics.blockedTasks}

Project Status Breakdown:
${req.projects.map((p) => `- ${p.name} (${p.client}): ${p.status} - ${p.completedTasks}/${p.totalTasks} deliverables complete`).join('\n')}

Notable Deliverables:
${(req.highlightTasks || []).slice(0, 15).map((t) => `- [${t.status}] ${t.title} (${t.projectName}) - Assignee: ${t.assigneeName || 'Unassigned'}`).join('\n')}
`;

  const prompt = `You are a Chief Technology Officer and Project Director. Write an Executive Weekly Briefing for leadership based on this data:
${contextData}

Format the briefing in Markdown with 3 clear sections:
1. 🏆 **Executive Summary & Milestone Wins** (concise 2-3 sentence overview + key completed deliverables)
2. ⚠️ **Critical Blockers & Risk Analysis** (identify bottlenecks, blocked items, or delivery delays)
3. 🎯 **Strategic Priorities for Next Week** (clear actionable focus areas)

Use **Bold**, bullet points, and clean typography. Keep it under 250 words, highly professional and factual.
At the very end, provide a single line delimiter: "---TELEGRAM_SNIPPET---" followed by a 4-line mobile-friendly Telegram broadcast summary using emojis (📊, 🏆, ⚠️, 🚀).`;

  const result = await ai.models.generateContent({
    model: config.model,
    contents: prompt,
  });

  const fullText = result.text ? result.text.trim() : '';
  const parts = fullText.split('---TELEGRAM_SNIPPET---');
  const briefing = parts[0]?.trim() || fullText;
  const telegramSnippet = parts[1]?.trim() || '';

  return { briefing, telegramSnippet };
}

/**
 * Feature 4: Detect Project Risks & Workload Bottlenecks
 */
export async function analyzeProjectRisks(pool: Pool, req: RiskAnalysisRequest): Promise<{
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
}> {
  const config = await getActiveAIConfig(pool);
  if (!config.apiKey) {
    throw new Error('Google Gemini API Key is not configured. Please add your key in AI Settings or .env file.');
  }

  const ai = getAIClient(config.apiKey);

  const todayStr = new Date().toISOString().split('T')[0];

  // Pre-calculate deterministic metrics
  const totalTasks = req.tasks.length;
  const blockedTasks = req.tasks.filter((t) => t.status === 'Blocked');
  const overdueTasks = req.tasks.filter(
    (t) => t.dueDate && t.dueDate < todayStr && t.status !== 'Completed'
  );
  const unassignedTasks = req.tasks.filter((t) => !t.assigneeId && t.status !== 'Completed');

  // Workload count per member
  const memberWorkload: Record<string, { name: string; count: number; overdueCount: number }> = {};
  req.teamMembers.forEach((m) => {
    memberWorkload[m.id] = { name: m.name, count: 0, overdueCount: 0 };
  });

  req.tasks.forEach((t) => {
    if (t.assigneeId && memberWorkload[t.assigneeId] && t.status !== 'Completed') {
      memberWorkload[t.assigneeId].count += 1;
      if (t.dueDate && t.dueDate < todayStr) {
        memberWorkload[t.assigneeId].overdueCount += 1;
      }
    }
  });

  const contextData = `
Today's Date: ${todayStr}
Total Projects: ${req.projects.length}
Total Active Tasks: ${totalTasks}
Blocked Tasks: ${blockedTasks.length} (${blockedTasks.map((t) => `"${t.title}" in ${t.projectName || 'Project'}`).join(', ')})
Overdue Tasks: ${overdueTasks.length} (${overdueTasks.map((t) => `"${t.title}" due ${t.dueDate}`).join(', ')})
Unassigned Active Tasks: ${unassignedTasks.length}

Team Member Workloads (active non-completed tasks):
${Object.values(memberWorkload).map((w) => `- ${w.name}: ${w.count} active tasks (${w.overdueCount} overdue)`).join('\n')}
`;

  const prompt = `Analyze this project management portfolio data and identify risks and bottlenecks:
${contextData}

Return a valid JSON object strictly matching this schema with NO markdown wrapping (no \`\`\`json):
{
  "health": "Healthy" | "Moderate Risk" | "Critical Risk",
  "healthScore": <integer between 0 and 100>,
  "summary": "<1-2 sentence executive summary of overall risk status>",
  "bottlenecks": [
    {
      "title": "<short bottleneck title>",
      "severity": "high" | "medium" | "low",
      "description": "<what is causing the risk>",
      "suggestion": "<actionable fix or reassignment advice>"
    }
  ],
  "recommendations": [
    "<actionable bullet 1>",
    "<actionable bullet 2>",
    "<actionable bullet 3>"
  ]
}`;

  const result = await ai.models.generateContent({
    model: config.model,
    contents: prompt,
  });

  const raw = result.text ? result.text.trim() : '{}';
  const cleanJson = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();

  try {
    return JSON.parse(cleanJson);
  } catch (e) {
    console.error('Failed to parse Gemini risk analysis JSON:', raw);
    // Fallback based on pre-calculated data
    const isCritical = blockedTasks.length > 2 || overdueTasks.length > 3;
    const isModerate = blockedTasks.length > 0 || overdueTasks.length > 0;
    return {
      health: isCritical ? 'Critical Risk' : isModerate ? 'Moderate Risk' : 'Healthy',
      healthScore: isCritical ? 55 : isModerate ? 78 : 95,
      summary: isCritical
        ? `High risk detected: ${blockedTasks.length} blocked items and ${overdueTasks.length} overdue deliverables require immediate attention.`
        : isModerate
        ? `Moderate risk: A few deliverables are overdue or blocked. Monitor team workload.`
        : `Portfolio is in good health with steady delivery pace.`,
      bottlenecks: [
        ...(blockedTasks.length > 0
          ? [
              {
                title: 'Blocked Deliverables',
                severity: 'high' as const,
                description: `${blockedTasks.length} tasks are currently marked Blocked across projects.`,
                suggestion: 'Schedule quick alignment to remove technical or client dependencies.',
              },
            ]
          : []),
        ...(overdueTasks.length > 0
          ? [
              {
                title: 'Overdue Milestones',
                severity: 'medium' as const,
                description: `${overdueTasks.length} deliverables are past their target due date.`,
                suggestion: 'Review deadlines with assignees and adjust sprint capacity.',
              },
            ]
          : []),
      ],
      recommendations: [
        'Review blocked tasks and unblock team members.',
        'Rebalance tasks from overloaded members to available teammates.',
        'Check in on upcoming deadlines due this week.',
      ],
    };
  }
}

/**
 * Feature 5: Interactive Project Copilot Chat
 */
export async function chatWithCopilot(pool: Pool, req: CopilotChatRequest): Promise<string> {
  const config = await getActiveAIConfig(pool);
  if (!config.apiKey) {
    throw new Error('Google Gemini API Key is not configured. Please add your key in AI Settings or .env file.');
  }

  const ai = getAIClient(config.apiKey);

  const contextStr = req.context
    ? `
WORKSPACE SNAPSHOT:
- Active Projects: ${(req.context.activeProjects || []).join(', ') || 'None'}
- Total Projects: ${req.context.projectsCount ?? 'N/A'}
- Total Deliverables: ${req.context.tasksCount ?? 'N/A'}
- Team Members: ${req.context.teamCount ?? 'N/A'}
- Urgent Deliverables: ${(req.context.urgentTasks || []).join('; ') || 'None'}
- Overdue Deliverables: ${(req.context.overdueTasks || []).join('; ') || 'None'}
- Blocked Deliverables: ${(req.context.blockedTasks || []).join('; ') || 'None'}
`
    : '';

  const systemInstruction = `You are the AI Project Copilot for a high-performing UX/UI and software engineering team.
You assist project managers, designers, and engineers with task tracking, status inquiries, workload summaries, drafting client updates, and decomposing complex goals.
Answer helpfully, accurately, and concisely using rich Markdown (Bold, Bullet Points, Quotes, Code).
If the user asks about tasks or projects, refer directly to the Workspace Snapshot provided below.
${contextStr}`;

  // Format conversation history for Gemini
  const contents: any[] = [{ role: 'user', parts: [{ text: systemInstruction }] }];

  if (Array.isArray(req.history)) {
    req.history.slice(-8).forEach((h) => {
      contents.push({
        role: h.role === 'model' || h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.content }],
      });
    });
  }

  contents.push({
    role: 'user',
    parts: [{ text: req.message }],
  });

  const result = await ai.models.generateContent({
    model: config.model,
    contents,
  });

  return result.text ? result.text.trim() : 'I am here to help, but no response was generated.';
}

