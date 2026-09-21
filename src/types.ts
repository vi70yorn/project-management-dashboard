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

export type ProjectScopeType = 'Mobile App UI' | 'Web UI';

export interface Task {
  id: string;
  projectId: string;
  projectName?: string;
  title: string;
  description: string;
  status: StatusType;
  priority: PriorityType;
  assigneeId: string;
  taskFor?: ProjectScopeType | string;
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
  links?: AttachedLink[];
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
  projectFor?: (ProjectScopeType | string)[];
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
  links?: AttachedLink[];
}

export interface AttachedLink {
  id: string;
  url: string;
  title?: string;
  platform?: string;
  createdAt: string;
}

export interface RecycleBinData {
  projects: Project[];
  tasks: Task[];
  totalCount: number;
}

export type NotificationType = 'task_assigned' | 'task_ready_review' | 'task_blocked' | 'system';

export interface InAppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  taskId?: string;
  taskTitle?: string;
  projectId?: string;
  projectName?: string;
  targetUserIds?: string[]; // Member IDs of specific targets
  targetRoles?: UserRole[]; // 'admin' or 'staff'
  actorId?: string;
  actorName?: string;
  actorAvatar?: string;
  readBy: string[]; // Member IDs or user IDs who marked read
  createdAt: string;
}

export interface DocumentAttachment {
  id: string;
  projectId?: string | null;
  taskId?: string | null;
  fileName: string;
  fileSize: number;
  mimeType: string;
  fileType: 'pdf' | 'word' | 'excel' | 'image' | 'other';
  storageProvider: 'google_drive' | 'local';
  driveFileId?: string | null;
  driveFileName?: string | null;
  webViewLink: string;
  downloadLink?: string | null;
  uploadedBy?: string | null;
  uploadedByName?: string | null;
  uploadedByAvatar?: string | null;
  createdAt: string;
}

export interface StorageConfigStatus {
  configured: boolean;
  provider: 'google_drive' | 'local';
  folderId?: string;
  message: string;
}

export interface ProjectShareConfig {
  id: string;
  projectId: string;
  shareToken: string;
  isEnabled: boolean;
  hasPassword: boolean;
  expiresAt?: string | null;
  showTasks: boolean;
  showAttachments: boolean;
  viewCount: number;
  lastViewedAt?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface ClientProjectData {
  id: string;
  name: string;
  description: string;
  client: string;
  status: StatusType;
  startDate?: string;
  targetDeadline?: string;
  tags: string[];
  color: string;
  links: AttachedLink[];
  createdAt: string;
  updatedAt?: string;
  managerName?: string;
  managerRole?: string;
  managerAvatar?: string;
}

export interface ClientTaskData {
  id: string;
  title: string;
  description: string;
  status: StatusType;
  priority: PriorityType;
  startDate?: string;
  dueDate?: string;
  createdAt: string;
  links?: AttachedLink[];
  subtasks?: {
    id: string;
    title: string;
    completed: boolean;
    position: number;
  }[];
}

export interface ClientAttachmentData {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  fileType: string;
  webViewLink: string;
  downloadLink?: string | null;
  createdAt: string;
}

export interface ClientMetrics {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  reviewTasks: number;
  blockedTasks: number;
  progressPercent: number;
  daysLeft: number | null;
  isOverdue: boolean;
}

export interface ClientProjectResponse {
  requiresPassword: boolean;
  projectName?: string;
  clientName?: string;
  project?: ClientProjectData;
  metrics?: ClientMetrics;
  tasks?: ClientTaskData[];
  attachments?: ClientAttachmentData[];
  shareSettings?: {
    showTasks: boolean;
    showAttachments: boolean;
    expiresAt?: string | null;
  };
}

