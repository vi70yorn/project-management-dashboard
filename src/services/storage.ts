import { Project, Task, TeamMember, AuthUser } from '../types';
import { getTodayString } from '../utils/dateUtils';

export const INITIAL_MEMBERS: TeamMember[] = [
  {
    id: 'mem-1',
    name: 'Alex Morgan',
    email: 'alex.morgan@team.org',
    role: 'Project Manager & Lead',
    systemRole: 'admin',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    color: '#2563eb',
    status: 'active',
    department: 'Engineering',
    createdAt: '2026-08-01T09:00:00.000Z',
  },
  {
    id: 'mem-2',
    name: 'Samantha Wu',
    email: 'samantha.wu@team.org',
    role: 'Senior Full-Stack Engineer',
    systemRole: 'staff',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
    color: '#7c3aed',
    status: 'active',
    department: 'Engineering',
    createdAt: '2026-08-01T09:00:00.000Z',
  },
  {
    id: 'mem-3',
    name: 'Carlos Rodriguez',
    email: 'carlos.r@team.org',
    role: 'Staff UI/UX Designer',
    systemRole: 'staff',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    color: '#ea580c',
    status: 'busy',
    department: 'Design',
    createdAt: '2026-08-02T10:00:00.000Z',
  },
  {
    id: 'mem-4',
    name: 'Priya Patel',
    email: 'priya.patel@team.org',
    role: 'Cloud & DevOps Specialist',
    systemRole: 'staff',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    color: '#059669',
    status: 'active',
    department: 'DevOps',
    createdAt: '2026-08-03T11:00:00.000Z',
  },
  {
    id: 'mem-5',
    name: 'David Kim',
    email: 'david.kim@team.org',
    role: 'QA Automation Lead',
    systemRole: 'staff',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    color: '#0891b2',
    status: 'away',
    department: 'Quality Assurance',
    createdAt: '2026-08-05T14:00:00.000Z',
  },
];

export const INITIAL_PROJECTS: Project[] = [
  {
    id: 'proj-1',
    name: 'Cloud Architecture Modernization',
    description: 'Transitioning legacy backend infrastructure to Kubernetes, containerized microservices, and automated CI/CD pipelines.',
    client: 'FinTech Systems',
    status: 'In Progress',
    startDate: '2026-08-15',
    targetDeadline: '2026-09-28',
    managerId: 'mem-1',
    memberIds: ['mem-1', 'mem-2', 'mem-4', 'mem-5'],
    tags: ['Cloud', 'Kubernetes', 'DevOps'],
    color: '#2563eb',
    createdAt: '2026-08-15T09:00:00.000Z',
  },
  {
    id: 'proj-2',
    name: 'Customer Support Portal Redesign',
    description: 'Modernizing customer help center, live chat widget, interactive knowledge base, and ticketing queue management.',
    client: 'OmniRetail Global',
    status: 'Pending',
    startDate: '2026-08-20',
    targetDeadline: '2026-09-18',
    managerId: 'mem-1',
    memberIds: ['mem-1', 'mem-2', 'mem-3'],
    tags: ['Frontend', 'Portal', 'UX'],
    color: '#7c3aed',
    createdAt: '2026-08-20T10:30:00.000Z',
  },
  {
    id: 'proj-3',
    name: 'Mobile Banking Experience 2.0',
    description: 'Refactoring mobile application with biometric login, contactless quick-pay, and real-time expense charts.',
    client: 'Apex Horizon Bank',
    status: 'Blocked',
    startDate: '2026-08-10',
    targetDeadline: '2026-09-14',
    managerId: 'mem-3',
    memberIds: ['mem-2', 'mem-3', 'mem-5'],
    tags: ['Mobile', 'iOS', 'Android'],
    color: '#ea580c',
    createdAt: '2026-08-10T14:00:00.000Z',
  },
  {
    id: 'proj-4',
    name: 'SOC-2 Compliance & Security Audit',
    description: 'Enterprise vulnerability remediation, zero-trust endpoint access validation, and audit evidence gathering.',
    client: 'Internal Engineering',
    status: 'Completed',
    startDate: '2026-07-01',
    targetDeadline: '2026-08-30',
    managerId: 'mem-4',
    memberIds: ['mem-1', 'mem-4'],
    tags: ['Security', 'Compliance', 'Audit'],
    color: '#059669',
    createdAt: '2026-07-01T08:00:00.000Z',
  },
];

export const INITIAL_TASKS: Task[] = [
  // Project 1 tasks
  {
    id: 'task-101',
    projectId: 'proj-1',
    title: 'Migrate Core Payment API to GKE Cluster',
    description: 'Deploy container pods with autoscaling metrics and service mesh ingress routing.',
    status: 'In Progress',
    priority: 'Urgent',
    assigneeId: 'mem-2',
    startDate: '2026-09-01',
    dueDate: getTodayString(),
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-03T10:00:00.000Z',
  },
  {
    id: 'task-102',
    projectId: 'proj-1',
    title: 'Configure Multi-Region Database Read Replicas',
    description: 'Setup asynchronous cross-region read replicas with automated health-check failover.',
    status: 'In Progress',
    priority: 'High',
    assigneeId: 'mem-4',
    startDate: '2026-09-02',
    dueDate: '2026-09-15',
    createdAt: '2026-09-02T09:00:00.000Z',
    updatedAt: '2026-09-02T09:00:00.000Z',
  },
  {
    id: 'task-103',
    projectId: 'proj-1',
    title: 'Automated Load Testing on Canary Deployment',
    description: 'Execute distributed test harness simulating high transaction volume under 99.9th percentile SLA.',
    status: 'Pending',
    priority: 'Medium',
    assigneeId: 'mem-5',
    startDate: '2026-09-12',
    dueDate: '2026-09-20',
    createdAt: '2026-09-02T14:00:00.000Z',
    updatedAt: '2026-09-02T14:00:00.000Z',
  },
  {
    id: 'task-104',
    projectId: 'proj-1',
    title: 'Baseline Infrastructure As Code (Terraform)',
    description: 'Provision VPC, subnets, NAT gateways, and IAM service accounts with least-privilege roles.',
    status: 'Completed',
    priority: 'High',
    assigneeId: 'mem-4',
    startDate: '2026-08-16',
    dueDate: '2026-08-28',
    createdAt: '2026-08-16T08:00:00.000Z',
    updatedAt: '2026-08-28T16:00:00.000Z',
  },

  // Project 2 tasks
  {
    id: 'task-201',
    projectId: 'proj-2',
    title: 'Customer Ticket Routing & Intent Logic',
    description: 'Configure automated triage queue for customer returns, billing disputes, and technical support.',
    status: 'In Progress',
    priority: 'High',
    assigneeId: 'mem-2',
    startDate: '2026-08-25',
    dueDate: '2026-09-12',
    createdAt: '2026-08-25T10:00:00.000Z',
    updatedAt: '2026-09-03T11:00:00.000Z',
  },
  {
    id: 'task-202',
    projectId: 'proj-2',
    title: 'Security & PII Data Privacy Review',
    description: 'Verify compliance sign-off on customer data scrubbing and token retention policy.',
    status: 'Pending',
    priority: 'Urgent',
    assigneeId: 'mem-1',
    startDate: '2026-08-28',
    dueDate: '2026-09-08',
    createdAt: '2026-08-28T11:00:00.000Z',
    updatedAt: '2026-08-28T11:00:00.000Z',
  },
  {
    id: 'task-203',
    projectId: 'proj-2',
    title: 'Support Agent UI & Helpdesk Prototype',
    description: 'Interactive agent workspace showing customer ticket details and quick resolution actions.',
    status: 'Completed',
    priority: 'Medium',
    assigneeId: 'mem-3',
    startDate: '2026-08-21',
    dueDate: '2026-09-02',
    createdAt: '2026-08-21T09:00:00.000Z',
    updatedAt: '2026-09-02T17:00:00.000Z',
  },

  // Project 3 tasks (Blocked Project)
  {
    id: 'task-301',
    projectId: 'proj-3',
    title: 'Biometric SDK Vendor Credentials Renewal',
    description: 'FaceID and Android BiometricPrompt adapter. Blocked by vendor license renewal token.',
    status: 'Blocked',
    priority: 'Urgent',
    assigneeId: 'mem-2',
    startDate: '2026-08-22',
    dueDate: '2026-09-07',
    createdAt: '2026-08-22T09:00:00.000Z',
    updatedAt: '2026-09-03T08:00:00.000Z',
  },
  {
    id: 'task-302',
    projectId: 'proj-3',
    title: 'Mobile Theme & Design Token Guidelines',
    description: 'High contrast accessible color palettes, typography scale, and responsive padding.',
    status: 'In Progress',
    priority: 'Medium',
    assigneeId: 'mem-3',
    startDate: '2026-08-29',
    dueDate: '2026-09-11',
    createdAt: '2026-08-29T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z',
  },
  {
    id: 'task-303',
    projectId: 'proj-3',
    title: 'End-to-End Fund Transfer Verification Flow',
    description: 'Recipient selection, 2FA confirmation modal, and instant receipt rendering.',
    status: 'Blocked',
    priority: 'High',
    assigneeId: 'mem-5',
    startDate: '2026-09-01',
    dueDate: '2026-09-14',
    createdAt: '2026-09-01T09:00:00.000Z',
    updatedAt: '2026-09-03T09:00:00.000Z',
  },

  // Project 4 tasks (Completed)
  {
    id: 'task-401',
    projectId: 'proj-4',
    title: 'External Penetration Test Remediation',
    description: 'Third-party white-box pen test completed with zero critical findings remaining.',
    status: 'Completed',
    priority: 'Urgent',
    assigneeId: 'mem-4',
    startDate: '2026-08-01',
    dueDate: '2026-08-20',
    createdAt: '2026-08-01T09:00:00.000Z',
    updatedAt: '2026-08-20T17:00:00.000Z',
  },
  {
    id: 'task-402',
    projectId: 'proj-4',
    title: 'Auditor Evidence Gathering & Matrix Export',
    description: 'Compiled cryptographic evidence, employee access logs, and change approval tickets.',
    status: 'Completed',
    priority: 'High',
    assigneeId: 'mem-1',
    startDate: '2026-08-10',
    dueDate: '2026-08-28',
    createdAt: '2026-08-10T09:00:00.000Z',
    updatedAt: '2026-08-28T18:00:00.000Z',
  },
];

const STORAGE_KEYS = {
  PROJECTS: 'pm_clean_projects_v2',
  TASKS: 'pm_clean_tasks_v2',
  MEMBERS: 'pm_clean_members_v2',
  AUTH_USER: 'pm_auth_user_v2',
};

export const DEFAULT_ADMIN_USER: AuthUser = {
  id: 'usr-admin-1',
  name: 'Alex Morgan',
  email: 'alex.morgan@team.org',
  role: 'admin',
  memberId: 'mem-1',
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  department: 'Engineering',
  jobRole: 'Project Manager & Lead',
};

export const DEFAULT_STAFF_USER: AuthUser = {
  id: 'usr-staff-2',
  name: 'Samantha Wu',
  email: 'samantha.wu@team.org',
  role: 'staff',
  memberId: 'mem-2',
  avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
  department: 'Engineering',
  jobRole: 'Senior Full-Stack Engineer',
};

export const loadAuthUser = (): AuthUser | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.AUTH_USER);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.error('Error loading auth user:', e);
    return null;
  }
};

export const saveAuthUser = (user: AuthUser | null) => {
  try {
    if (user) {
      localStorage.setItem(STORAGE_KEYS.AUTH_USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEYS.AUTH_USER);
    }
  } catch (e) {
    console.error('Error saving auth user:', e);
  }
};

export const clearAuthUser = () => {
  try {
    localStorage.removeItem(STORAGE_KEYS.AUTH_USER);
  } catch (e) {
    console.error('Error clearing auth user:', e);
  }
};

export const loadProjects = (): Project[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PROJECTS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(INITIAL_PROJECTS));
      return INITIAL_PROJECTS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(INITIAL_PROJECTS));
    return INITIAL_PROJECTS;
  } catch (e) {
    console.error('Error loading projects from localStorage:', e);
    return INITIAL_PROJECTS;
  }
};

export const saveProjects = (projects: Project[]) => {
  try {
    if (Array.isArray(projects)) {
      localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(projects));
    }
  } catch (e) {
    console.error('Error saving projects to localStorage:', e);
  }
};

export const loadTasks = (): Task[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TASKS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(INITIAL_TASKS));
      return INITIAL_TASKS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((t: any) => ({
        ...t,
        createdBy: t.createdBy || t.assigneeId || 'mem-1',
      }));
    }
    return INITIAL_TASKS;
  } catch (e) {
    console.error('Error loading tasks from localStorage:', e);
    return INITIAL_TASKS;
  }
};

export const saveTasks = (tasks: Task[]) => {
  try {
    if (Array.isArray(tasks)) {
      localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
    }
  } catch (e) {
    console.error('Error saving tasks to localStorage:', e);
  }
};

export const loadMembers = (): TeamMember[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.MEMBERS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(INITIAL_MEMBERS));
      return INITIAL_MEMBERS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((m: any) => ({
        ...m,
        systemRole: m.systemRole || (m.id === 'mem-1' || m.role?.toLowerCase().includes('lead') || m.role?.toLowerCase().includes('manager') ? 'admin' : 'staff'),
      }));
    }
    return INITIAL_MEMBERS;
  } catch (e) {
    console.error('Error loading members from localStorage:', e);
    return INITIAL_MEMBERS;
  }
};

export const saveMembers = (members: TeamMember[]) => {
  try {
    if (Array.isArray(members)) {
      localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(members));
    }
  } catch (e) {
    console.error('Error saving members to localStorage:', e);
  }
};
