import { Project, Task, TeamMember, AuthUser, RecycleBinData, InAppNotification } from '../types';

export const INITIAL_MEMBERS: TeamMember[] = [];

export const INITIAL_PROJECTS: Project[] = [];

export const INITIAL_TASKS: Task[] = [];

const STORAGE_KEYS = {
  PROJECTS: 'pm_clean_projects_v2',
  TASKS: 'pm_clean_tasks_v2',
  MEMBERS: 'pm_clean_members_v2',
  AUTH_USER: 'pm_auth_user_v2',
  RECYCLE_BIN_PROJECTS: 'pm_clean_recycle_projects_v1',
  RECYCLE_BIN_TASKS: 'pm_clean_recycle_tasks_v1',
  NOTIFICATIONS: 'pm_clean_notifications_v1',
};

export const DEFAULT_ADMIN_USER: AuthUser = {
  id: 'usr-admin-1',
  name: 'Y.VICHET',
  username: 'vichet',
  email: 'y.vichet@team.org',
  role: 'admin',
  memberId: 'mem-1788624319284',
  department: 'UX/UI',
  jobRole: 'UX/UI Lead',
};

export const DEFAULT_STAFF_USER: AuthUser = {
  id: 'usr-staff-1',
  name: 'David',
  username: 'david',
  email: 'david@team.org',
  role: 'staff',
  memberId: 'mem-1788624380119',
  department: 'UX/UI',
  jobRole: 'UX/UI Designer',
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
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Error loading projects from localStorage:', e);
    return [];
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
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Error loading tasks from localStorage:', e);
    return [];
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
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Error loading members from localStorage:', e);
    return [];
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

export const loadRecycleBinData = (): RecycleBinData => {
  try {
    const rawProj = localStorage.getItem(STORAGE_KEYS.RECYCLE_BIN_PROJECTS);
    const rawTasks = localStorage.getItem(STORAGE_KEYS.RECYCLE_BIN_TASKS);
    const projects: Project[] = rawProj ? JSON.parse(rawProj) : [];
    const tasks: Task[] = rawTasks ? JSON.parse(rawTasks) : [];
    const safeProjects = Array.isArray(projects) ? projects : [];
    const safeTasks = Array.isArray(tasks) ? tasks : [];
    return {
      projects: safeProjects,
      tasks: safeTasks,
      totalCount: safeProjects.length + safeTasks.length,
    };
  } catch (e) {
    console.error('Error loading recycle bin from localStorage:', e);
    return { projects: [], tasks: [], totalCount: 0 };
  }
};

export const saveRecycleBinData = (data: RecycleBinData) => {
  try {
    if (data) {
      localStorage.setItem(STORAGE_KEYS.RECYCLE_BIN_PROJECTS, JSON.stringify(data.projects || []));
      localStorage.setItem(STORAGE_KEYS.RECYCLE_BIN_TASKS, JSON.stringify(data.tasks || []));
    }
  } catch (e) {
    console.error('Error saving recycle bin to localStorage:', e);
  }
};

export const INITIAL_NOTIFICATIONS: InAppNotification[] = [
  {
    id: 'notif-seed-1',
    type: 'task_assigned',
    title: 'New Task Assigned',
    message: 'You have been assigned to "Implement OAuth2 refresh token rotation"',
    taskTitle: 'Implement OAuth2 refresh token rotation',
    projectName: 'Merchant 5.0',
    targetUserIds: ['mem-1788624319284', 'mem-1788624380119'],
    actorName: 'Y.VICHET',
    readBy: [],
    createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
  },
  {
    id: 'notif-seed-2',
    type: 'task_ready_review',
    title: 'Task Ready for Review',
    message: 'David moved "Redesign checkout flow UI" to Ready Review',
    taskTitle: 'Redesign checkout flow UI',
    projectName: 'Merchant 5.0',
    targetRoles: ['admin'],
    targetUserIds: ['mem-1788624380119'],
    actorName: 'David',
    readBy: [],
    createdAt: new Date(Date.now() - 65 * 60 * 1000).toISOString(),
  },
  {
    id: 'notif-seed-3',
    type: 'task_blocked',
    title: 'Task Marked Blocked',
    message: 'Sarah Chen flagged "Payment Gateway Sandbox Integration" as Blocked: Waiting for API credentials',
    taskTitle: 'Payment Gateway Sandbox Integration',
    projectName: 'Mobile App 2.0',
    targetRoles: ['admin'],
    targetUserIds: ['mem-1788624380119'],
    actorName: 'Sarah Chen',
    readBy: [],
    createdAt: new Date(Date.now() - 140 * 60 * 1000).toISOString(),
  },
];

export const loadNotifications = (): InAppNotification[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
    if (!raw) {
      saveNotifications(INITIAL_NOTIFICATIONS);
      return INITIAL_NOTIFICATIONS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : INITIAL_NOTIFICATIONS;
  } catch (e) {
    console.error('Error loading notifications from localStorage:', e);
    return INITIAL_NOTIFICATIONS;
  }
};

export const saveNotifications = (notifications: InAppNotification[]) => {
  try {
    if (Array.isArray(notifications)) {
      localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifications));
    }
  } catch (e) {
    console.error('Error saving notifications to localStorage:', e);
  }
};
