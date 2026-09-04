export type StatusType = 'In Progress' | 'Pending' | 'Blocked' | 'Completed';

export type PriorityType = 'Urgent' | 'High' | 'Medium' | 'Low';

export type UserRole = 'admin' | 'staff';

export interface AuthUser {
  id: string;
  name: string;
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
  title: string;
  description: string;
  status: StatusType;
  priority: PriorityType;
  assigneeId: string;
  createdBy?: string;
  startDate?: string;
  dueDate: string;
  createdAt: string;
  updatedAt?: string;
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
  createdAt: string;
}
