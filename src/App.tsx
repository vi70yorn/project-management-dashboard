/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Project, Task, TeamMember, StatusType, AuthUser } from './types';
import {
  loadProjects,
  saveProjects,
  loadTasks,
  saveTasks,
  loadMembers,
  saveMembers,
  loadAuthUser,
  saveAuthUser,
  clearAuthUser,
} from './services/storage';
import { Navbar } from './components/Navbar';
import { DashboardSummary } from './components/DashboardSummary';
import { ProjectDetail } from './components/ProjectDetail';
import { TeamManagement } from './components/TeamManagement';
import { TeamMemberModal } from './components/TeamMemberModal';
import { TaskModal } from './components/TaskModal';
import { NewProjectModal } from './components/NewProjectModal';
import { ConfirmationModal } from './components/ConfirmationModal';
import { LoginScreen } from './components/LoginScreen';
import { ResetPasswordModal } from './components/ResetPasswordModal';
import { DatabaseStatusModal } from './components/DatabaseStatusModal';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';
import {
  checkDatabaseHealth,
  fetchProjectsApi,
  createProjectApi,
  updateProjectApi,
  updateProjectStatusApi,
  updateProjectMembersApi,
  deleteProjectApi,
  fetchTasksApi,
  createTaskApi,
  updateTaskApi,
  updateTaskStatusApi,
  deleteTaskApi,
  fetchMembersApi,
  createMemberApi,
  updateMemberApi,
  deleteMemberApi,
  DatabaseHealthResponse,
} from './services/api';

export default function App() {
  // Authentication State
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(loadAuthUser);

  // Theme State (Light / Dark Mode)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('theme');
      if (saved === 'dark' || saved === 'light') return saved;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });

  useEffect(() => {
    try {
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
      }
    } catch (e) {
      console.error('Error saving theme to localStorage:', e);
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Navigation & Core Data States
  const [currentView, setCurrentView] = useState<'dashboard' | 'project' | 'team'>('dashboard');
  const [activeProjectId, setActiveProjectId] = useState<string>('');
  const [projects, setProjects] = useState<Project[]>(loadProjects);
  const [tasks, setTasks] = useState<Task[]>(loadTasks);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(loadMembers);

  // Modal States
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [defaultTaskStatus, setDefaultTaskStatus] = useState<StatusType>('In Progress');

  // Team Member Modal State
  const [isTeamMemberModalOpen, setIsTeamMemberModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);

  // Confirmation Dialog State
  const [confirmationModal, setConfirmationModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    details?: string[];
    confirmLabel?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Notification Toast State
  const [toast, setToast] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  // Database Connection State (PostgreSQL + DBeaver)
  const [dbHealth, setDbHealth] = useState<DatabaseHealthResponse | null>(null);
  const [isDbModalOpen, setIsDbModalOpen] = useState(false);
  const [isCheckingDb, setIsCheckingDb] = useState(false);

  const refreshDatabase = async (silent = false, roleOverride?: string) => {
    setIsCheckingDb(true);
    try {
      const health = await checkDatabaseHealth();
      setDbHealth(health);

      if (health.connected) {
        const activeRole = roleOverride !== undefined ? roleOverride : currentUser?.role;
        // Fetch fresh data directly from PostgreSQL
        const [remoteProjects, remoteTasks, remoteMembers] = await Promise.all([
          fetchProjectsApi().catch(() => null),
          fetchTasksApi().catch(() => null),
          fetchMembersApi(activeRole).catch(() => null),
        ]);

        if (Array.isArray(remoteProjects)) {
          setProjects(remoteProjects);
        }
        if (Array.isArray(remoteTasks)) {
          setTasks(remoteTasks);
        }
        if (Array.isArray(remoteMembers)) {
          setTeamMembers(remoteMembers);
        }

        if (!silent) {
          showToast('success', `Connected to PostgreSQL database "${health.database}"!`);
        }
      } else {
        if (!silent) {
          showToast('info', 'Running in local storage mode. Connect PostgreSQL via .env & "npm run server".');
        }
      }
    } catch (err: any) {
      setDbHealth({ status: 'error', connected: false, message: err.message });
      if (!silent) {
        showToast('info', 'Running in local storage fallback mode.');
      }
    } finally {
      setIsCheckingDb(false);
    }
  };

  // Check database on initial load
  useEffect(() => {
    refreshDatabase(true);
  }, []);

  // Persistence effects
  useEffect(() => {
    saveProjects(projects);
  }, [projects]);

  useEffect(() => {
    saveTasks(tasks);
  }, [tasks]);

  useEffect(() => {
    saveMembers(teamMembers);
  }, [teamMembers]);

  useEffect(() => {
    if (currentUser) {
      saveAuthUser(currentUser);
    } else {
      clearAuthUser();
    }
  }, [currentUser]);

  const showToast = (type: 'success' | 'error' | 'info', message: string) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 4500);
  };

  // Auth Handlers
  const handleLogin = (user: AuthUser) => {
    setCurrentUser(user);
    saveAuthUser(user);
    showToast('success', `Welcome back, ${user.name}! (${user.role.toUpperCase()} role active)`);
    refreshDatabase(true, user.role);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    clearAuthUser();
    showToast('info', 'You have been logged out.');
  };

  // Navigation handlers
  const handleSelectProject = (projectId: string) => {
    setActiveProjectId(projectId);
    setCurrentView('project');
  };

  const handleGoToDashboard = () => {
    setCurrentView('dashboard');
  };

  const handleGoToTeam = () => {
    setCurrentView('team');
  };

  // Project management handlers
  const handleOpenCreateProject = () => {
    if (currentUser?.role !== 'admin') {
      showToast('error', 'Only Admins can create new projects.');
      return;
    }
    setEditingProject(null);
    setIsNewProjectModalOpen(true);
  };

  const handleOpenEditProject = (project: Project) => {
    if (currentUser?.role !== 'admin') {
      showToast('error', 'Only Admins can edit projects.');
      return;
    }
    setEditingProject(project);
    setIsNewProjectModalOpen(true);
  };

  const handleSaveProject = (
    projectData: Omit<Project, 'id' | 'createdAt'>,
    projectId?: string
  ) => {
    if (currentUser?.role !== 'admin') {
      showToast('error', 'Only Admins can modify projects.');
      return;
    }

    const targetId = projectId || editingProject?.id;

    if (targetId) {
      // Edit existing project
      setProjects((prev) =>
        prev.map((p) =>
          p.id === targetId
            ? {
                ...p,
                ...projectData,
                updatedAt: new Date().toISOString(),
              }
            : p
        )
      );
      updateProjectApi(targetId, projectData).catch((err) =>
        console.warn('[PostgreSQL Sync] Update project error:', err)
      );
      showToast('success', `Project "${projectData.name}" updated successfully.`);
      setEditingProject(null);
    } else {
      // Create new project
      const newProject: Project = {
        ...projectData,
        id: `proj-${Date.now()}`,
        createdAt: new Date().toISOString(),
      };

      setProjects((prev) => [newProject, ...prev]);
      createProjectApi(newProject).catch((err) =>
        console.warn('[PostgreSQL Sync] Create project error:', err)
      );
      showToast('success', `Project "${newProject.name}" created!`);

      // Switch directly to the new project workspace
      setActiveProjectId(newProject.id);
      setCurrentView('project');
    }

    setIsNewProjectModalOpen(false);
  };

  const handleDeleteProjectRequest = (project: Project) => {
    if (currentUser?.role !== 'admin') {
      showToast('error', 'Only Admins can delete projects.');
      return;
    }

    const projectTasks = tasks.filter((t) => t.projectId === project.id);

    setConfirmationModal({
      isOpen: true,
      title: `Delete Project: ${project.name}`,
      message: `Are you sure you want to permanently delete project "${project.name}"? This action cannot be undone.`,
      details: [
        `Project Name: ${project.name}`,
        `Associated Tasks: ${projectTasks.length} task(s)`,
        'All tasks and boards in this project will be permanently deleted.',
      ],
      confirmLabel: 'Delete Project',
      isDestructive: true,
      onConfirm: () => {
        setConfirmationModal((prev) => ({ ...prev, isOpen: false }));
        setProjects((prev) => prev.filter((p) => p.id !== project.id));
        setTasks((prev) => prev.filter((t) => t.projectId !== project.id));

        deleteProjectApi(project.id).catch((err) =>
          console.warn('[PostgreSQL Sync] Delete project error:', err)
        );

        if (activeProjectId === project.id) {
          setActiveProjectId('');
          setCurrentView('dashboard');
        }

        showToast('info', `Project "${project.name}" and its tasks deleted.`);
      },
    });
  };

  const handleUpdateProjectStatus = (projectId: string, newStatus: StatusType) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === projectId ? { ...p, status: newStatus } : p))
    );
    updateProjectStatusApi(projectId, newStatus).catch((err) =>
      console.warn('[PostgreSQL Sync] Update status error:', err)
    );
    showToast('info', `Project status changed to "${newStatus}"`);
  };

  const handleUpdateProjectMembers = (projectId: string, memberIds: string[]) => {
    if (currentUser?.role !== 'admin') {
      showToast('error', 'Only Admins can manage project team members.');
      return;
    }
    setProjects((prev) =>
      prev.map((p) => (p.id === projectId ? { ...p, memberIds } : p))
    );
    updateProjectMembersApi(projectId, memberIds).catch((err) =>
      console.warn('[PostgreSQL Sync] Update members error:', err)
    );
    showToast('success', 'Project team roster updated.');
  };

  // Task management handlers
  const handleOpenTaskModal = (task?: Task | null, defaultStatus?: StatusType) => {
    setEditingTask(task || null);
    if (defaultStatus) setDefaultTaskStatus(defaultStatus);
    setIsTaskModalOpen(true);
  };

  // Synchronize project status whenever tasks within a project change
  const syncProjectStatusForTasks = (
    targetProjectId: string,
    allTasks: Task[],
    projectList: Project[]
  ) => {
    if (!targetProjectId) return;
    const projectTasks = allTasks.filter((t) => t.projectId === targetProjectId);
    const currentProject = projectList.find((p) => p.id === targetProjectId);
    if (!currentProject || projectTasks.length === 0) return;

    const allCompleted = projectTasks.every((t) => t.status === 'Completed');
    const remainingBlocked = projectTasks.filter((t) => t.status === 'Blocked');

    if (allCompleted && currentProject.status !== 'Completed') {
      setProjects((prevProj) =>
        prevProj.map((p) =>
          p.id === targetProjectId ? { ...p, status: 'Completed' } : p
        )
      );
      updateProjectStatusApi(targetProjectId, 'Completed').catch(() => {});
      showToast(
        'success',
        `All tasks completed! Project "${currentProject.name}" status auto-updated to Completed.`
      );
    } else if (currentProject.status === 'Completed' && !allCompleted) {
      const nextStatus: StatusType = remainingBlocked.length > 0 ? 'Blocked' : 'In Progress';
      setProjects((prevProj) =>
        prevProj.map((p) =>
          p.id === targetProjectId ? { ...p, status: nextStatus } : p
        )
      );
      updateProjectStatusApi(targetProjectId, nextStatus).catch(() => {});
      showToast(
        'info',
        `Task moved out of Completed. Project "${currentProject.name}" status changed to ${nextStatus}.`
      );
    } else if (currentProject.status === 'Blocked' && remainingBlocked.length === 0) {
      setProjects((prevProj) =>
        prevProj.map((p) =>
          p.id === targetProjectId ? { ...p, status: 'In Progress' } : p
        )
      );
      updateProjectStatusApi(targetProjectId, 'In Progress').catch(() => {});
      showToast(
        'success',
        `All blocked tasks resolved! Project "${currentProject.name}" status auto-updated to In Progress.`
      );
    }
  };

  const handleSaveTask = (taskData: Partial<Task>) => {
    const targetProjectId = taskData.projectId || activeProjectId || projects[0]?.id;

    if (!targetProjectId) {
      showToast('error', 'Please select a valid project first.');
      return;
    }

    if (currentUser?.role === 'staff') {
      if (editingTask) {
        const isOwn =
          (editingTask.createdBy && editingTask.createdBy === currentUser.memberId) ||
          editingTask.assigneeId === currentUser.memberId;
        if (!isOwn) {
          showToast('error', 'Staff can only edit their own tasks.');
          return;
        }
      }
    }

    if (editingTask) {
      const updatedTask: Task = {
        ...editingTask,
        ...taskData,
        assigneeId:
          currentUser?.role === 'staff'
            ? currentUser.memberId
            : (taskData.assigneeId || editingTask.assigneeId),
        updatedAt: new Date().toISOString(),
      } as Task;

      const nextTasks = tasks.map((t) => (t.id === editingTask.id ? updatedTask : t));
      setTasks(nextTasks);
      syncProjectStatusForTasks(updatedTask.projectId, nextTasks, projects);

      updateTaskApi(editingTask.id, updatedTask).catch((err) =>
        console.warn('[PostgreSQL Sync] Update task error:', err)
      );
      showToast('success', `Task "${updatedTask.title}" updated.`);
    } else {
      const newTask: Task = {
        id: `task-${Date.now()}`,
        projectId: targetProjectId,
        title: taskData.title || 'Untitled Task',
        description: taskData.description || '',
        status: taskData.status || defaultTaskStatus,
        priority: taskData.priority || 'Medium',
        createdBy: currentUser?.memberId || 'mem-2',
        assigneeId:
          currentUser?.role === 'staff'
            ? (currentUser.memberId || 'mem-2')
            : (taskData.assigneeId || teamMembers[0]?.id || 'mem-1'),
        startDate: taskData.startDate,
        dueDate: taskData.dueDate || new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const nextTasks = [newTask, ...tasks];
      setTasks(nextTasks);
      syncProjectStatusForTasks(targetProjectId, nextTasks, projects);

      createTaskApi(newTask).catch((err) =>
        console.warn('[PostgreSQL Sync] Create task error:', err)
      );
      showToast('success', `Task "${newTask.title}" added to project.`);
    }
  };

  const handleUpdateTaskStatus = (taskId: string, newStatus: StatusType) => {
    const targetTask = tasks.find((t) => t.id === taskId);
    if (currentUser?.role === 'staff' && targetTask) {
      const isOwn =
        (targetTask.createdBy && targetTask.createdBy === currentUser.memberId) ||
        targetTask.assigneeId === currentUser.memberId;
      if (!isOwn) {
        showToast('error', 'Staff can only update status for their own tasks.');
        return;
      }
    }

    let movedTaskTitle = '';
    let targetProjectId = '';

    const nextTasks = tasks.map((t) => {
      if (t.id === taskId) {
        movedTaskTitle = t.title;
        targetProjectId = t.projectId;
        return { ...t, status: newStatus, updatedAt: new Date().toISOString() };
      }
      return t;
    });

    setTasks(nextTasks);

    if (targetProjectId) {
      syncProjectStatusForTasks(targetProjectId, nextTasks, projects);
    }

    updateTaskStatusApi(taskId, newStatus).catch((err) =>
      console.warn('[PostgreSQL Sync] Update task status error:', err)
    );

    if (movedTaskTitle) {
      showToast('info', `"${movedTaskTitle}" moved to ${newStatus}`);
    }
  };

  const handleReassignTask = (taskId: string, assigneeId: string) => {
    if (currentUser?.role === 'staff') {
      showToast('error', 'Staff members cannot reassign tasks.');
      return;
    }

    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, assigneeId, updatedAt: new Date().toISOString() }
          : t
      )
    );
    updateTaskApi(taskId, { assigneeId }).catch((err) =>
      console.warn('[PostgreSQL Sync] Reassign task error:', err)
    );
    const member = teamMembers.find((m) => m.id === assigneeId);
    showToast('info', `Task reassigned to ${member ? member.name : 'member'}`);
  };

  const handleDeleteTaskRequest = (task: Task) => {
    if (currentUser?.role === 'staff') {
      const isOwn =
        (task.createdBy && task.createdBy === currentUser.memberId) ||
        task.assigneeId === currentUser.memberId;
      if (!isOwn) {
        showToast('error', 'Staff members can only delete their own tasks.');
        return;
      }
    }

    setConfirmationModal({
      isOpen: true,
      title: 'Delete Task Deliverable',
      message: `Are you sure you want to permanently delete "${task.title}"?`,
      details: [`Task: ${task.title}`, `Status: ${task.status}`],
      confirmLabel: 'Delete Task',
      isDestructive: true,
      onConfirm: () => {
        setConfirmationModal((prev) => ({ ...prev, isOpen: false }));
        const nextTasks = tasks.filter((t) => t.id !== task.id);
        setTasks(nextTasks);
        if (task.projectId) {
          syncProjectStatusForTasks(task.projectId, nextTasks, projects);
        }
        deleteTaskApi(task.id).catch((err) =>
          console.warn('[PostgreSQL Sync] Delete task error:', err)
        );
        showToast('info', `Task "${task.title}" deleted.`);
      },
    });
  };

  // Team Member management handlers
  const handleOpenAddMember = () => {
    if (currentUser?.role !== 'admin') {
      showToast('error', 'Only Admins can add new team members.');
      return;
    }
    setEditingMember(null);
    setIsTeamMemberModalOpen(true);
  };

  const handleOpenEditMember = (member: TeamMember) => {
    if (currentUser?.role !== 'admin' && currentUser?.memberId !== member.id) {
      showToast('error', 'You can only edit your own user info.');
      return;
    }
    setEditingMember(member);
    setIsTeamMemberModalOpen(true);
  };

  const handleOpenEditOwnProfile = () => {
    if (!currentUser?.memberId) return;
    const myMember = teamMembers.find((m) => m.id === currentUser.memberId);
    if (myMember) {
      setEditingMember(myMember);
      setIsTeamMemberModalOpen(true);
    } else {
      setEditingMember({
        id: currentUser.memberId,
        name: currentUser.name,
        username: currentUser.username,
        email: currentUser.email,
        role: currentUser.jobRole || 'Team Member',
        systemRole: currentUser.role,
        department: currentUser.department,
        avatar: currentUser.avatar,
        status: 'active',
      });
      setIsTeamMemberModalOpen(true);
    }
  };

  const handleSaveMember = (
    memberData: Omit<TeamMember, 'id'> & { projectIds?: string[] }
  ) => {
    const isAdmin = currentUser?.role === 'admin';
    const isEditingOwnProfile = editingMember && currentUser?.memberId === editingMember.id;

    if (!isAdmin && !isEditingOwnProfile) {
      showToast('error', 'You can only update your own user profile.');
      return;
    }

    if (!editingMember && !isAdmin) {
      showToast('error', 'Only Admins can add new team members.');
      return;
    }

    const { projectIds = [], ...baseData } = memberData;

    // Prevent non-admins from changing their role
    if (!isAdmin && editingMember) {
      baseData.systemRole = editingMember.systemRole || 'staff';
    }

    if (editingMember) {
      // Update member
      const updatedMember: TeamMember = {
        ...editingMember,
        ...baseData,
      };

      setTeamMembers((prev) =>
        prev.map((m) => (m.id === editingMember.id ? updatedMember : m))
      );

      // If active user is this member, sync session
      if (currentUser?.memberId === editingMember.id) {
        const updatedAuth: AuthUser = {
          ...currentUser,
          name: updatedMember.name,
          email: updatedMember.email,
          username: updatedMember.username || currentUser.username,
          avatar: updatedMember.avatar,
          department: updatedMember.department,
          jobRole: updatedMember.role,
        };
        setCurrentUser(updatedAuth);
        saveAuthUser(updatedAuth);
      }

      // Sync project memberships only if admin
      if (isAdmin) {
        setProjects((prev) =>
          prev.map((p) => {
            const shouldHaveMember = projectIds.includes(p.id);
            const currentHasMember = p.memberIds.includes(editingMember.id);
            if (shouldHaveMember && !currentHasMember) {
              return { ...p, memberIds: [...p.memberIds, editingMember.id] };
            }
            if (!shouldHaveMember && currentHasMember) {
              return {
                ...p,
                memberIds: p.memberIds.filter((id) => id !== editingMember.id),
              };
            }
            return p;
          })
        );
      }

      updateMemberApi(editingMember.id, baseData, currentUser?.role, currentUser?.memberId)
        .then(() => {
          showToast('success', isEditingOwnProfile ? 'Your profile has been updated!' : `Team member "${updatedMember.name}" updated.`);
          refreshDatabase(true, currentUser?.role);
        })
        .catch((err) => {
          console.warn('[PostgreSQL Sync] Update member error:', err);
          showToast('error', err.message || 'Failed to update member');
        });
    } else {
      // Create new member
      const newMemberId = `mem-${Date.now()}`;
      const newMember: TeamMember = {
        ...baseData,
        id: newMemberId,
      };

      setTeamMembers((prev) => [...prev, newMember]);

      // Assign to selected projects
      if (projectIds.length > 0) {
        setProjects((prev) =>
          prev.map((p) => {
            if (projectIds.includes(p.id)) {
              return { ...p, memberIds: [...p.memberIds, newMemberId] };
            }
            return p;
          })
        );
      }

      createMemberApi(newMember, currentUser?.role)
        .then(() => {
          showToast('success', `Team member "${newMember.name}" added to roster!`);
          refreshDatabase(true, currentUser?.role);
        })
        .catch((err) => {
          console.warn('[PostgreSQL Sync] Create member error:', err);
          showToast('error', err.message || 'Failed to create member');
        });
    }

    setIsTeamMemberModalOpen(false);
  };

  const handleDeleteMemberRequest = (memberOrId: TeamMember | string) => {
    if (currentUser?.role !== 'admin') {
      showToast('error', 'Only Admins can remove team members.');
      return;
    }

    const member =
      typeof memberOrId === 'string'
        ? teamMembers.find((m) => m.id === memberOrId)
        : memberOrId;
    if (!member) return;

    const memberTasks = (tasks || []).filter((t) => t.assigneeId === member.id);
    const memberProjects = (projects || []).filter((p) => p.memberIds.includes(member.id));

    setConfirmationModal({
      isOpen: true,
      title: `Remove ${member.name}`,
      message: `Are you sure you want to remove ${member.name} from the team roster?`,
      details: [
        `Assigned in ${memberProjects.length} project(s)`,
        `Currently assigned ${memberTasks.length} task(s)`,
        'Any existing assigned tasks will be unassigned.',
      ],
      confirmLabel: 'Remove Member',
      isDestructive: true,
      onConfirm: () => {
        setConfirmationModal((prev) => ({ ...prev, isOpen: false }));

        // Remove from members list
        setTeamMembers((prev) => prev.filter((m) => m.id !== member.id));

        // Remove from project memberIds
        setProjects((prev) =>
          prev.map((p) => ({
            ...p,
            memberIds: p.memberIds.filter((id) => id !== member.id),
            managerId: p.managerId === member.id ? '' : p.managerId,
          }))
        );

        // Reassign or unassign tasks
        const fallbackMember = teamMembers.find((m) => m.id !== member.id);
        setTasks((prev) =>
          prev.map((t) =>
            t.assigneeId === member.id
              ? { ...t, assigneeId: fallbackMember ? fallbackMember.id : '' }
              : t
          )
        );

        deleteMemberApi(member.id).catch((err) =>
          console.warn('[PostgreSQL Sync] Delete member error:', err)
        );

        showToast('info', `${member.name} has been removed from team roster.`);
      },
    });
  };

  const handleUpdateMemberProjects = (memberId: string, projectIds: string[]) => {
    if (currentUser?.role !== 'admin') {
      showToast('error', 'Only Admins can update project assignments.');
      return;
    }

    setProjects((prev) =>
      prev.map((p) => {
        const shouldHave = projectIds.includes(p.id);
        const has = p.memberIds.includes(memberId);
        if (shouldHave && !has) {
          return { ...p, memberIds: [...p.memberIds, memberId] };
        }
        if (!shouldHave && has) {
          return { ...p, memberIds: p.memberIds.filter((id) => id !== memberId) };
        }
        return p;
      })
    );
    showToast('success', 'Project assignments updated.');
  };

  // If not logged in, render the login screen before project management
  if (!currentUser) {
    return (
      <LoginScreen
        teamMembers={teamMembers}
        onLogin={handleLogin}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
    );
  }

  const activeProject = (projects || []).find((p) => p.id === activeProjectId);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-blue-100 dark:selection:bg-blue-900/50 selection:text-blue-900 dark:selection:text-blue-200 transition-colors duration-200">
      {/* Top Navigation Bar */}
      <Navbar
        currentView={currentView}
        onGoToDashboard={handleGoToDashboard}
        onGoToTeam={handleGoToTeam}
        projects={projects}
        activeProject={activeProject}
        onSelectProject={handleSelectProject}
        onOpenNewProject={handleOpenCreateProject}
        onOpenAddMember={handleOpenAddMember}
        teamCount={teamMembers.length}
        currentUser={currentUser}
        onLogout={handleLogout}
        onOpenResetPassword={() => setIsResetPasswordOpen(true)}
        onOpenEditProfile={handleOpenEditOwnProfile}
        dbHealth={dbHealth}
        onOpenDbModal={() => setIsDbModalOpen(true)}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-12">
        {currentView === 'dashboard' ? (
          <DashboardSummary
            projects={projects}
            tasks={tasks}
            teamMembers={teamMembers}
            onSelectProject={handleSelectProject}
            onOpenNewProject={handleOpenCreateProject}
            onUpdateProjectStatus={handleUpdateProjectStatus}
            onNavigateToTeam={handleGoToTeam}
            onOpenAddMember={handleOpenAddMember}
            currentUser={currentUser}
            onEditProject={handleOpenEditProject}
            onDeleteProject={handleDeleteProjectRequest}
          />
        ) : currentView === 'team' ? (
          <TeamManagement
            teamMembers={teamMembers}
            projects={projects}
            tasks={tasks}
            onAddMember={handleOpenAddMember}
            onEditMember={handleOpenEditMember}
            onDeleteMember={handleDeleteMemberRequest}
            onUpdateMemberProjects={handleUpdateMemberProjects}
            onSelectProject={handleSelectProject}
            currentUser={currentUser}
          />
        ) : activeProject ? (
          <ProjectDetail
            project={activeProject}
            tasks={tasks}
            teamMembers={teamMembers}
            onBackToDashboard={handleGoToDashboard}
            onUpdateProjectStatus={handleUpdateProjectStatus}
            onUpdateProjectMembers={handleUpdateProjectMembers}
            onOpenTaskModal={handleOpenTaskModal}
            onDeleteTaskRequest={handleDeleteTaskRequest}
            onUpdateTaskStatus={handleUpdateTaskStatus}
            onReassignTask={handleReassignTask}
            onOpenAddMember={handleOpenAddMember}
            currentUser={currentUser}
            onEditProject={handleOpenEditProject}
            onDeleteProject={handleDeleteProjectRequest}
          />
        ) : (
          <div className="py-20 text-center text-slate-500 dark:text-slate-400">
            <p>Project not found.</p>
            <button
              onClick={handleGoToDashboard}
              className="inline-block mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold"
            >
              Return to Dashboard
            </button>
          </div>
        )}
      </main>

      {/* New/Edit Project Modal */}
      <NewProjectModal
        isOpen={isNewProjectModalOpen}
        onClose={() => {
          setIsNewProjectModalOpen(false);
          setEditingProject(null);
        }}
        onSave={handleSaveProject}
        initialProject={editingProject}
        teamMembers={teamMembers}
        onOpenAddMember={handleOpenAddMember}
      />

      {/* Task Modal */}
      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={() => {
          setIsTaskModalOpen(false);
          setEditingTask(null);
        }}
        onSave={handleSaveTask}
        initialTask={editingTask}
        projectId={activeProject?.id || activeProjectId || projects[0]?.id || ''}
        projectName={activeProject?.name || projects[0]?.name || 'Project'}
        projectMembers={teamMembers}
        projects={projects}
        teamMembers={teamMembers}
        onOpenAddMember={handleOpenAddMember}
        currentUser={currentUser}
      />

      {/* Team Member Modal */}
      <TeamMemberModal
        isOpen={isTeamMemberModalOpen}
        onClose={() => {
          setIsTeamMemberModalOpen(false);
          setEditingMember(null);
        }}
        onSave={handleSaveMember}
        initialMember={editingMember}
        projects={projects}
        currentUser={currentUser}
      />

      {/* Reset Password Modal */}
      {currentUser && (
        <ResetPasswordModal
          isOpen={isResetPasswordOpen}
          onClose={() => setIsResetPasswordOpen(false)}
          memberId={currentUser.memberId}
          userName={currentUser.name}
          onSuccessToast={(msg) => showToast('success', msg)}
        />
      )}

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmationModal.isOpen}
        title={confirmationModal.title}
        message={confirmationModal.message}
        details={confirmationModal.details}
        confirmLabel={confirmationModal.confirmLabel}
        isDestructive={confirmationModal.isDestructive}
        onConfirm={confirmationModal.onConfirm}
        onCancel={() => setConfirmationModal((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* PostgreSQL & DBeaver Status Modal */}
      <DatabaseStatusModal
        isOpen={isDbModalOpen}
        onClose={() => setIsDbModalOpen(false)}
        health={dbHealth}
        onRefresh={() => refreshDatabase(false)}
        isRefreshing={isCheckingDb}
      />

      {/* Toast Notification */}
      {toast && (
        <div
          id="app-toast-notification"
          className="fixed bottom-5 right-5 z-50 max-w-md bg-slate-900 dark:bg-slate-800 text-white p-3.5 rounded-xl shadow-2xl border border-slate-800 dark:border-slate-700 flex items-center justify-between gap-3 animate-in slide-in-from-bottom-5"
        >
          <div className="flex items-center gap-2.5">
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : toast.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
            )}
            <p className="text-xs font-medium leading-tight">{toast.message}</p>
          </div>
          <button
            onClick={() => setToast(null)}
            className="text-slate-400 hover:text-white p-1 rounded-md transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
