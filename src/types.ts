export type StatusType = 'Draft' | 'In Progress' | 'Ready Review' | 'Blocked' | 'Completed';

export type PriorityType = 'Urgent' | 'High' | 'Medium' | 'Low';

export type UserRole = 'admin' | 'staff';

export type ViewType = 'dashboard' | 'project' | 'team' | 'summary' | 'recycle-bin' | 'calendar';

export interface AuthUser {
  id: string;
  name: string;
  username?: string;
  email: string;
  role: UserRole;
  memberId: string;
  avatar?: string;
  department?: string;
  jobRole?: string;
}

export interface TeamMember {
  id: string;
  name: string;
  username?: string;
  password?: string;
  email: string;
  role: string;
  systemRole: UserRole; // 'admin' or 'staff'
  avatar?: string;
  color?: string; // Hex color for avatar initials badge
  status: 'active' | 'busy' | 'away';
  department?: string;
  createdAt?: string;
}

export interface Task {
  id: string;
  projectId: string;
  projectName?: string;
  title: string;
  description: string;
  status: StatusType;
  priority: PriorityType;
  assigneeId: string;
  createdBy?: string;
  createdByName?: string;
  createdByAvatar?: string;
  updatedBy?: string;
  updatedByName?: string;
  updatedByAvatar?: string;
  startDate?: string;
  dueDate: string;
  createdAt: string;
  updatedAt?: string;
  deletedAt?: string;
  deletedById?: string;
  deletedByName?: string;
  deletedByAvatar?: string;
  expiresAt?: string;
  daysLeft?: number;
  commentCount?: number;
  subtasks?: TaskSubtask[];
}

export interface TaskSubtask {
  id: string;
  taskId: string;
  title: string;
  completed: boolean;
  position: number;
  createdAt?: string;
  updatedAt?: string;
}


export interface TaskComment {
  id: string;
  taskId: string;
  userId?: string | null;
  userName: string;
  userAvatar?: string | null;
  userRole?: string;
  content: string;
  createdAt: string;
  updatedAt?: string;
  type: 'comment';
}

export interface TaskActivityEvent {
  id: string;
  taskId: string;
  userId?: string | null;
  userName: string;
  userAvatar?: string | null;
  userRole?: string;
  actionType: string;
  details?: Record<string, any>;
  createdAt: string;
  type: 'activity';
}

export type TaskTimelineEvent = TaskComment | TaskActivityEvent;

export interface TaskTimelineResponse {
  timeline: TaskTimelineEvent[];
  commentCount: number;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  client: string;
  status: StatusType;
  startDate: string;
  targetDeadline: string;
  managerId: string;
  memberIds: string[];
  tags: string[];
  color: string;
  createdBy?: string;
  createdByName?: string;
  createdByAvatar?: string;
  updatedBy?: string;
  updatedByName?: string;
  updatedByAvatar?: string;
  createdAt: string;
  updatedAt?: string;
  deletedAt?: string;
  deletedById?: string;
  deletedByName?: string;
  deletedByAvatar?: string;
  expiresAt?: string;
  daysLeft?: number;
}

export interface RecycleBinData {
  projects: Project[];
  tasks: Task[];
  totalCount: number;
}
