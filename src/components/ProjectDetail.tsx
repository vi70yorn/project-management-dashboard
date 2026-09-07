import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  Plus,
  Calendar,
  Layers,
  Users,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Briefcase,
  Search,
  Filter,
  Check,
  X,
  UserPlus,
  GripVertical,
  AlertTriangle,
  ChevronDown,
  Lock,
  ShieldCheck,
  UserCheck,
  Eye,
} from 'lucide-react';
import { Project, Task, TeamMember, StatusType, PriorityType, AuthUser } from '../types';
import { getDueDateStatus, isDueToday, formatDateTime } from '../utils/dateUtils';
import { FORM_STYLES } from '../utils/formStyles';
import { StatusBadge, PriorityBadge, getStatusBadgeClass, getPriorityBadgeClass } from './Badges';

interface ProjectDetailProps {
  project: Project;
  tasks: Task[];
  teamMembers: TeamMember[];
  onBackToDashboard: () => void;
  onUpdateProjectStatus: (projectId: string, newStatus: StatusType) => void;
  onUpdateProjectMembers: (projectId: string, memberIds: string[]) => void;
  onOpenTaskModal: (task?: Task | null, defaultStatus?: StatusType) => void;
  onDeleteTaskRequest: (task: Task) => void;
  onUpdateTaskStatus: (taskId: string, newStatus: StatusType) => void;
  onReassignTask: (taskId: string, assigneeId: string) => void;
  onOpenAddMember?: () => void;
  currentUser?: AuthUser | null;
  onEditProject?: (project: Project) => void;
  onDeleteProject?: (project: Project) => void;
}

const KANBAN_STATUSES: StatusType[] = ['In Progress', 'Ready Review', 'Blocked', 'Completed'];

export const ProjectDetail: React.FC<ProjectDetailProps> = ({
  project,
  tasks = [],
  teamMembers = [],
  onBackToDashboard,
  onUpdateProjectStatus,
  onUpdateProjectMembers,
  onOpenTaskModal,
  onDeleteTaskRequest,
  onUpdateTaskStatus,
  onReassignTask,
  onOpenAddMember,
  currentUser,
  onEditProject,
  onDeleteProject,
}) => {
  const isAdmin = currentUser?.role === 'admin';
  const isStaff = currentUser?.role === 'staff';
  const isAssignedToProject =
    isAdmin || (isStaff && (project?.memberIds || []).includes(currentUser?.memberId || ''));

  const [activeTab, setActiveTab] = useState<'board' | 'team'>('board');
  const [filterMemberId, setFilterMemberId] = useState<string>('all');
  const [searchTaskQuery, setSearchTaskQuery] = useState('');
  const [isManagingMembers, setIsManagingMembers] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>(project?.memberIds || []);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<StatusType | null>(null);

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    const task = safeTasks.find((t) => t.id === taskId);
    if (!task) return;

    const canMove =
      isAdmin ||
      (task.createdBy && task.createdBy === currentUser?.memberId) ||
      task.assigneeId === currentUser?.memberId;

    if (!canMove) {
      e.preventDefault();
      return;
    }

    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedTaskId(taskId);
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
    setDragOverColumn(null);
  };

  const canModifyDraggedTask = useMemo(() => {
    if (isAdmin) return true;
    if (!draggedTaskId) return false;
    const task = (Array.isArray(tasks) ? tasks : []).find((t) => t.id === draggedTaskId);
    if (!task) return false;
    return Boolean(
      (task.createdBy && task.createdBy === currentUser?.memberId) ||
      task.assigneeId === currentUser?.memberId
    );
  }, [isAdmin, draggedTaskId, tasks, currentUser]);

  const handleDragOver = (e: React.DragEvent, status: StatusType) => {
    if (!isAdmin && !canModifyDraggedTask) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColumn !== status) {
      setDragOverColumn(status);
    }
  };

  const handleDragLeave = (e: React.DragEvent, status: StatusType) => {
    if (!isAdmin && !canModifyDraggedTask) return;
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    if (dragOverColumn === status) {
      setDragOverColumn(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetStatus: StatusType) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId;
    if (taskId) {
      const task = safeTasks.find((t) => t.id === taskId);
      if (task) {
        const canModify =
          isAdmin ||
          (isStaff &&
            ((task.createdBy && task.createdBy === currentUser?.memberId) ||
              task.assigneeId === currentUser?.memberId));
        if (canModify && task.status !== targetStatus) {
          onUpdateTaskStatus(taskId, targetStatus);
        }
      }
    }
    setDraggedTaskId(null);
    setDragOverColumn(null);
  };

  const safeTasks = Array.isArray(tasks) ? tasks : [];
  const safeMembers = Array.isArray(teamMembers) ? teamMembers : [];
  const memberIdsList = Array.isArray(project?.memberIds) ? project.memberIds : [];

  // Sync selectedMemberIds if project.memberIds changes
  React.useEffect(() => {
    setSelectedMemberIds(project?.memberIds || []);
  }, [project?.memberIds]);

  // Tasks in this project
  const projectTasks = useMemo(() => {
    if (!project?.id) return [];
    return safeTasks.filter((t) => t.projectId === project.id);
  }, [safeTasks, project?.id]);

  // Filtered tasks by search & member
  const filteredTasks = useMemo(() => {
    return projectTasks.filter((t) => {
      const matchesMember = filterMemberId === 'all' || t.assigneeId === filterMemberId;
      const matchesSearch =
        (t.title || '').toLowerCase().includes(searchTaskQuery.toLowerCase()) ||
        (t.description || '').toLowerCase().includes(searchTaskQuery.toLowerCase());
      return matchesMember && matchesSearch;
    });
  }, [projectTasks, filterMemberId, searchTaskQuery]);

  // Project assigned members
  const projectTeam = useMemo(() => {
    return safeMembers.filter((m) => memberIdsList.includes(m.id));
  }, [safeMembers, memberIdsList]);

  // Project Lead / Manager
  const projectManager = safeMembers.find((m) => m.id === project?.managerId);

  // Metrics
  const totalTasks = projectTasks.length;
  const completedTasks = projectTasks.filter((t) => t.status === 'Completed').length;
  const inProgressTasks = projectTasks.filter((t) => t.status === 'In Progress').length;
  const blockedTasks = projectTasks.filter((t) => t.status === 'Blocked').length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const getStatusBadge = (status: StatusType) => getStatusBadgeClass(status, 'sm');
  const getPriorityBadge = (priority: PriorityType) => getPriorityBadgeClass(priority, 'sm');

  const toggleMemberInProject = (memberId: string) => {
    if (selectedMemberIds.includes(memberId)) {
      if (selectedMemberIds.length > 1) {
        setSelectedMemberIds(selectedMemberIds.filter((id) => id !== memberId));
      }
    } else {
      setSelectedMemberIds([...selectedMemberIds, memberId]);
    }
  };

  const handleSaveMembers = () => {
    onUpdateProjectMembers(project.id, selectedMemberIds);
    setIsManagingMembers(false);
  };

  const getInitials = (fullName: string) => {
    if (!fullName) return '?';
    const parts = fullName.trim().split(' ');
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <div id="project-detail-workspace" className="space-y-6 pb-20">
      {/* Top Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button
          id="back-to-dashboard-btn"
          onClick={onBackToDashboard}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-lg shadow-2xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors w-fit cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Dashboard Summary
        </button>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Admin Project Edit & Delete & Add Task */}
          {isAdmin ? (
            <>
              {onEditProject && (
                <button
                  id="header-edit-project-btn"
                  onClick={() => onEditProject(project)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  Edit Project
                </button>
              )}
              {onDeleteProject && (
                <button
                  id="header-delete-project-btn"
                  onClick={() => onDeleteProject(project)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-rose-700 dark:text-rose-300 rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                  Delete Project
                </button>
              )}
              <button
                id="manage-project-members-btn"
                onClick={() => setIsManagingMembers(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
              >
                <Users className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                Manage Team ({projectTeam.length})
              </button>
              <button
                id="header-add-task-btn"
                onClick={() => onOpenTaskModal(null, 'In Progress')}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                Add Deliverable Task
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <span
                id="staff-view-only-indicator"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-semibold shadow-2xs"
              >
                <Eye className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                Staff Mode &bull; View Project Details
              </span>
              <button
                id="header-add-task-btn"
                onClick={() => onOpenTaskModal(null, 'In Progress')}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                Add My Task
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Project Overview Card */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          <div className="space-y-2 max-w-3xl">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: project.color }}
              />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {project.client}
              </span>
              <span className="text-slate-300 dark:text-slate-600">&bull;</span>
              {/* Status Display: Editable by Admin, Read-only badge for Staff */}
              {isAdmin ? (
                <div className="relative inline-flex items-center">
                  <select
                    id="project-detail-status-select"
                    value={project.status}
                    onChange={(e) =>
                      onUpdateProjectStatus(project.id, e.target.value as StatusType)
                    }
                    className={`appearance-none text-xs font-semibold pl-2 pr-5 py-0.5 rounded-md border cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 shadow-2xs transition-colors ${getStatusBadge(
                      project.status
                    )}`}
                  >
                    <option value="In Progress">In Progress</option>
                    <option value="Ready Review">Ready Review</option>
                    <option value="Blocked">Blocked</option>
                    <option value="Completed">Completed</option>
                  </select>
                  <ChevronDown className="w-3 h-3 text-slate-500 dark:text-slate-400 absolute right-1 pointer-events-none" />
                </div>
              ) : (
                <StatusBadge status={project.status} size="sm" />
              )}
            </div>

            <h1 id="project-detail-name" className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              {project.name}
            </h1>

            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {project.description}
            </p>

            {/* Tags & Manager */}
            <div className="flex items-center gap-2 pt-1 flex-wrap text-2xs">
              {projectManager && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-medium border border-blue-200 dark:border-blue-800">
                  <Briefcase className="w-3 h-3" />
                  Lead: {projectManager.name}
                </span>
              )}
              {project.tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium"
                >
                  {tag}
                </span>
              ))}
            </div>

            {/* Project Audit History Banner */}
            <div id="project-audit-history-strip" className="flex items-center gap-3 pt-3 flex-wrap text-2xs border-t border-slate-100 dark:border-slate-800/80 text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/60 px-2.5 py-1 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
                <span className="text-3xs uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500">
                  Created:
                </span>
                {project.createdByAvatar ? (
                  <img
                    src={project.createdByAvatar}
                    alt={project.createdByName || 'Creator'}
                    className="w-4 h-4 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <span className="w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold text-4xs flex items-center justify-center shrink-0">
                    {(project.createdByName || 'U').charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {project.createdByName || 'System'}
                </span>
                <span className="text-3xs text-slate-400 dark:text-slate-500">
                  • {formatDateTime(project.createdAt)}
                </span>
              </div>

              <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/60 px-2.5 py-1 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
                <span className="text-3xs uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500">
                  Last Updated:
                </span>
                {project.updatedByAvatar ? (
                  <img
                    src={project.updatedByAvatar}
                    alt={project.updatedByName || 'Updater'}
                    className="w-4 h-4 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <span className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-4xs flex items-center justify-center shrink-0">
                    {(project.updatedByName || project.createdByName || 'U').charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {project.updatedByName || project.createdByName || 'System'}
                </span>
                <span className="text-3xs text-slate-400 dark:text-slate-500">
                  • {formatDateTime(project.updatedAt || project.createdAt)}
                </span>
              </div>
            </div>
          </div>

          {/* Right Summary Info */}
          <div className="flex flex-row lg:flex-col items-start lg:items-end justify-between gap-4 border-t lg:border-t-0 pt-4 lg:pt-0 border-slate-100 dark:border-slate-800">
            <div className="text-left lg:text-right">
              <span className="text-2xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Target Deadline
              </span>
              {(() => {
                const projDue = getDueDateStatus(project.targetDeadline);
                if (projDue.isToday) {
                  return (
                    <div className="flex items-center gap-1.5 text-xs font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 px-2 py-1 rounded-lg mt-1 ring-1 ring-rose-400/80 shadow-2xs animate-pulse">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                      <span>Due Today! ({project.targetDeadline})</span>
                    </div>
                  );
                }
                if (projDue.isOverdue) {
                  return (
                    <div className="flex items-center gap-1.5 text-xs font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 px-2 py-0.5 rounded-lg mt-0.5">
                      <Clock className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                      <span>Overdue ({project.targetDeadline})</span>
                    </div>
                  );
                }
                return (
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                    <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span>{project.targetDeadline}</span>
                  </div>
                );
              })()}
            </div>

            {/* Project Team Avatars with Quick Add */}
            <div className="text-left lg:text-right">
              <div className="flex items-center justify-between lg:justify-end gap-2 mb-1">
                <span className="text-2xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Project Team ({projectTeam.length})
                </span>
                {isAdmin && (
                  <button
                    onClick={() => setIsManagingMembers(true)}
                    className="text-2xs text-blue-600 dark:text-blue-400 hover:underline font-medium cursor-pointer"
                  >
                    Edit Roster
                  </button>
                )}
              </div>
              <div className="flex items-center -space-x-1.5">
                {projectTeam.map((mem) => (
                  <div key={mem.id} className="relative group">
                    {mem.avatar ? (
                      <img
                        src={mem.avatar}
                        alt={mem.name}
                        title={`${mem.name} (${mem.role})`}
                        className="w-7 h-7 rounded-full ring-2 ring-white dark:ring-slate-900 object-cover cursor-pointer"
                        onClick={() => setFilterMemberId(filterMemberId === mem.id ? 'all' : mem.id)}
                      />
                    ) : (
                      <div
                        style={{ backgroundColor: mem.color || '#2563eb' }}
                        className="w-7 h-7 rounded-full ring-2 ring-white dark:ring-slate-900 text-white text-3xs font-semibold flex items-center justify-center cursor-pointer shadow-2xs"
                        title={`${mem.name} (${mem.role})`}
                        onClick={() => setFilterMemberId(filterMemberId === mem.id ? 'all' : mem.id)}
                      >
                        {getInitials(mem.name)}
                      </div>
                    )}
                  </div>
                ))}
                {isAdmin && (
                  <button
                    onClick={() => setIsManagingMembers(true)}
                    className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 ring-2 ring-white dark:ring-slate-900 flex items-center justify-center text-xs font-bold transition-colors cursor-pointer"
                    title="Add or remove members from project"
                  >
                    +
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Progress Strip */}
        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-slate-500 dark:text-slate-400 font-medium">
              Progress: {completedTasks} of {totalTasks} deliverables completed
              {blockedTasks > 0 && (
                <span className="text-rose-600 dark:text-rose-400 font-semibold ml-2">
                  &bull; {blockedTasks} blocked
                </span>
              )}
            </span>
            <span className="font-bold text-slate-800 dark:text-slate-200">{completionRate}%</span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                project.status === 'Blocked'
                  ? 'bg-rose-500'
                  : project.status === 'Completed'
                  ? 'bg-emerald-500'
                  : 'bg-blue-600 dark:bg-blue-500'
              }`}
              style={{ width: `${completionRate}%` }}
            />
          </div>
        </div>

        {/* Blocked Alert Banner with Quick Action (Addressing red circle on Blocked) */}
        {project.status === 'Blocked' && (
          <div
            id="project-blocked-alert-banner"
            className="mt-4 p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
          >
            <div className="flex items-center gap-2.5 text-rose-800 dark:text-rose-300">
              <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
              <div>
                <span className="font-bold text-rose-900 dark:text-rose-200">Project is currently Blocked:</span>{' '}
                <span className="text-rose-700 dark:text-rose-300">
                  {blockedTasks > 0
                    ? `${blockedTasks} deliverable task(s) currently marked as Blocked in the Task Board below.`
                    : 'Deliverables are stalled. You can change the project status back to In Progress.'}
                </span>
              </div>
            </div>
            {isAdmin && (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  id="quick-unblock-project-btn"
                  onClick={() => {
                    onUpdateProjectStatus(project.id, 'In Progress');
                    if (blockedTasks > 0) {
                      projectTasks
                        .filter((t) => t.status === 'Blocked')
                        .forEach((t) => onUpdateTaskStatus(t.id, 'In Progress'));
                    }
                  }}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-md font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Unblock Project & Tasks
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tabs & Filters Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
          <button
            id="tab-btn-board"
            onClick={() => setActiveTab('board')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'board'
                ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-2xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Task Board ({projectTasks.length})
          </button>

          <button
            id="tab-btn-team"
            onClick={() => setActiveTab('team')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'team'
                ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-2xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Project Team & Workload ({projectTeam.length})
          </button>
        </div>

        {/* Member filter & Search within board */}
        {activeTab === 'board' && (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search tasks..."
                value={searchTaskQuery}
                onChange={(e) => setSearchTaskQuery(e.target.value)}
                className="h-8 pl-8 pr-7 py-1 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 rounded-lg shadow-2xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-36 sm:w-48 transition-colors"
              />
              {searchTaskQuery && (
                <button
                  type="button"
                  onClick={() => setSearchTaskQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded cursor-pointer"
                  title="Clear"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="relative inline-flex items-center">
              <Filter className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                id="filter-by-member-select"
                value={filterMemberId}
                onChange={(e) => setFilterMemberId(e.target.value)}
                className="appearance-none h-8 pl-8 pr-7 py-1 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 rounded-lg shadow-2xs text-slate-700 dark:text-slate-200 font-medium cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
              >
                <option value="all">All Members</option>
                {projectTeam.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name.split(' ')[0]} ({projectTasks.filter((t) => t.assigneeId === m.id).length})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        )}
      </div>

      {/* VIEW 1: Task Board (Kanban Columns with same status as Project: In Progress, Ready Review, Blocked, Completed) */}
      {activeTab === 'board' && (
        <div id="kanban-board-container" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start pb-8">
          {KANBAN_STATUSES.map((status) => {
            const columnTasks = filteredTasks.filter((t) => t.status === status);

            return (
              <div
                key={status}
                id={`kanban-column-${status.toLowerCase().replace(/\s+/g, '-')}`}
                onDragOver={(e) => handleDragOver(e, status)}
                onDragLeave={(e) => handleDragLeave(e, status)}
                onDrop={(e) => handleDrop(e, status)}
                className={`rounded-xl border p-3 flex flex-col gap-3 min-h-[460px] transition-all duration-150 ${
                  dragOverColumn === status
                    ? 'border-blue-400 dark:border-blue-500 bg-blue-50/60 dark:bg-blue-950/40 ring-2 ring-blue-300/40 shadow-xs'
                    : 'bg-slate-50/80 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800'
                }`}
              >
                {/* Column Header */}
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={status} size="sm" />
                    <span className="text-xs text-slate-400 dark:text-slate-500 font-semibold">
                      {columnTasks.length}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <span className="text-3xs text-slate-400 dark:text-slate-500 hidden sm:inline">
                      {isAdmin ? 'Drag & Drop' : 'Deliverables'}
                    </span>
                    <button
                      id={`add-task-to-column-${status}`}
                      onClick={() => onOpenTaskModal(null, status)}
                      title={`Add ${status} Task`}
                      className="text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 p-1 rounded-md hover:bg-white dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Task Cards */}
                <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[calc(100vh-280px)] pr-0.5">
                  {columnTasks.map((task) => {
                    const assignee = teamMembers.find((m) => m.id === task.assigneeId);
                    const isOwnTask = Boolean(
                      (task.createdBy && task.createdBy === currentUser?.memberId) ||
                      task.assigneeId === currentUser?.memberId
                    );
                    const canModifyTask = isAdmin || (isStaff && isOwnTask);

                    return (
                      <div
                        key={task.id}
                        id={`task-card-${task.id}`}
                        draggable={canModifyTask}
                        onDragStart={(e) => handleDragStart(e, task.id)}
                        onDragEnd={handleDragEnd}
                        className={`bg-white dark:bg-slate-800/90 rounded-lg border border-slate-200/90 dark:border-slate-700/80 p-3 shadow-2xs hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-xs transition-all space-y-2.5 select-none ${
                          canModifyTask ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
                        } group ${
                          draggedTaskId === task.id ? 'opacity-40 scale-[0.98] ring-2 ring-blue-400' : ''
                        }`}
                      >
                        {/* Priority Badge, Drag Handle & Card Actions */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {canModifyTask ? (
                              <GripVertical className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 group-hover:text-slate-500 dark:group-hover:text-slate-400 transition-colors shrink-0" />
                            ) : (
                              <Eye className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" title="Staff: View detail mode" />
                            )}
                            <PriorityBadge priority={task.priority} size="xs" />
                            {isStaff && isOwnTask && (
                              <span className="text-3xs font-semibold px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                My Task
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-0.5">
                            {canModifyTask ? (
                              <>
                                <button
                                  id={`edit-task-btn-${task.id}`}
                                  onClick={() => onOpenTaskModal(task)}
                                  title="Edit Task"
                                  className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer transition-colors"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  id={`delete-task-btn-${task.id}`}
                                  onClick={() => onDeleteTaskRequest(task)}
                                  title="Delete Task"
                                  className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => onOpenTaskModal(task)}
                                title="View Task Detail"
                                className="text-3xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 px-2 py-0.5 rounded font-medium border border-blue-200/60 dark:border-blue-800/60 cursor-pointer transition-colors inline-flex items-center gap-1"
                              >
                                View Detail
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Title & Description */}
                        <div>
                          <h4
                            onClick={() => onOpenTaskModal(task)}
                            className="text-xs font-bold text-slate-900 dark:text-white leading-snug hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer transition-colors"
                            title={isAdmin ? 'Edit task details' : 'View task details'}
                          >
                            {task.title}
                          </h4>
                          {task.description && (
                            <p className="text-2xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                              {task.description}
                            </p>
                          )}
                        </div>

                        {/* Assignee & Due Date */}
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-2xs text-slate-500 dark:text-slate-400 gap-1.5">
                          {/* Assignee display (avatar & name) */}
                          <div className="relative flex-1 min-w-0">
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenTaskModal(task);
                              }}
                              title={
                                canModifyTask
                                  ? `Assigned to: ${assignee?.name || 'Unassigned'} • Click to edit`
                                  : `Assigned to: ${assignee?.name || 'Unassigned'}`
                              }
                              className="inline-flex items-center gap-1.5 py-0.5 max-w-full text-2xs font-medium cursor-pointer hover:opacity-85 transition-opacity group/assignee"
                            >
                              {assignee?.avatar ? (
                                <img
                                  src={assignee.avatar}
                                  alt={assignee.name}
                                  className="w-5 h-5 rounded-full object-cover shrink-0 ring-1 ring-slate-200/80 dark:ring-slate-700/80"
                                />
                              ) : assignee ? (
                                <span
                                  style={{ backgroundColor: assignee.color || '#2563eb' }}
                                  className="w-5 h-5 rounded-full text-white text-3xs font-bold flex items-center justify-center shrink-0 shadow-2xs"
                                >
                                  {getInitials(assignee.name)}
                                </span>
                              ) : (
                                <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-600 text-slate-400 dark:text-slate-500 text-3xs font-semibold flex items-center justify-center shrink-0">
                                  ?
                                </span>
                              )}
                              <span className="truncate text-slate-700 dark:text-slate-200 group-hover/assignee:text-blue-600 dark:group-hover/assignee:text-blue-400 transition-colors">
                                {assignee?.name || 'Unassigned'}
                              </span>
                            </div>
                          </div>

                          {(() => {
                            const taskDue = getDueDateStatus(task.dueDate);
                            if (taskDue.isToday) {
                              return (
                                <div
                                  title={`Due Today (${task.dueDate})`}
                                  className="flex items-center gap-1 text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 px-1.5 py-0.5 rounded text-2xs font-bold shrink-0 ring-1 ring-rose-400/80 shadow-2xs animate-pulse"
                                >
                                  <AlertCircle className="w-3 h-3 text-rose-600 dark:text-rose-400 shrink-0" />
                                  <span>Today ({task.dueDate.slice(5)})</span>
                                </div>
                              );
                            }
                            if (taskDue.isOverdue) {
                              return (
                                <div
                                  title={`Overdue (${task.dueDate})`}
                                  className="flex items-center gap-1 text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 px-1.5 py-0.5 rounded text-2xs font-semibold shrink-0"
                                >
                                  <Clock className="w-3 h-3 text-rose-500 shrink-0" />
                                  <span>{task.dueDate.slice(5)}</span>
                                </div>
                              );
                            }
                            return (
                              <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 shrink-0">
                                <Clock className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                                <span>{task.dueDate.slice(5)}</span>
                              </div>
                            );
                          })()}
                        </div>

                        {/* Task Audit Info */}
                        <div
                          className="pt-1.5 flex items-center justify-between text-3xs text-slate-400 dark:text-slate-500 gap-2 border-t border-slate-100/80 dark:border-slate-700/50"
                          title={`Created by ${task.createdByName || 'Team'} on ${formatDateTime(task.createdAt)} • Last updated by ${task.updatedByName || task.createdByName || 'Team'} on ${formatDateTime(task.updatedAt || task.createdAt)}`}
                        >
                          <span className="truncate flex items-center gap-1">
                            <span className="text-slate-400 dark:text-slate-500">By</span>
                            <span className="font-medium text-slate-600 dark:text-slate-300 truncate">
                              {task.createdByName || 'Team'}
                            </span>
                          </span>
                          <span className="shrink-0 flex items-center gap-1 text-slate-400 dark:text-slate-500">
                            <Clock className="w-2.5 h-2.5 shrink-0" />
                            {formatDateTime(task.updatedAt || task.createdAt).split(',')[0]}
                          </span>
                        </div>

                        {/* Quick Move status bar: if canModifyTask, allow status change; else View Detail prompt */}
                        {canModifyTask ? (
                          <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-700/60 text-2xs">
                            <span className="text-3xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Move</span>
                            <div className="relative inline-flex items-center">
                              <select
                                id={`move-task-status-${task.id}`}
                                value={task.status}
                                onChange={(e) =>
                                  onUpdateTaskStatus(task.id, e.target.value as StatusType)
                                }
                                className="appearance-none text-2xs py-0.5 pl-2 pr-5 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium cursor-pointer shadow-2xs focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                              >
                                <option value="In Progress">In Progress</option>
                                <option value="Ready Review">Ready Review</option>
                                <option value="Blocked">Blocked</option>
                                <option value="Completed">Completed</option>
                              </select>
                              <ChevronDown className="w-2.5 h-2.5 text-slate-400 dark:text-slate-500 absolute right-1.5 pointer-events-none" />
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-700/60 text-2xs">
                            <span className="text-3xs font-medium text-slate-400 dark:text-slate-500 flex items-center gap-1">
                              <Eye className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                              View detail mode
                            </span>
                            <button
                              onClick={() => onOpenTaskModal(task)}
                              className="text-3xs text-blue-600 dark:text-blue-400 hover:underline font-semibold cursor-pointer"
                            >
                              Inspect &rarr;
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {columnTasks.length === 0 && (
                    <div
                      onClick={() => onOpenTaskModal(null, status)}
                      className="p-5 border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-600 rounded-lg text-center text-2xs text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex flex-col items-center justify-center gap-1.5 bg-white/40 dark:bg-slate-800/30 cursor-pointer"
                    >
                      <Plus className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                      <span>{isAdmin ? 'Drag tasks here or click to add' : `Click to add ${status.toLowerCase()} task`}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* VIEW 2: Project Team & Workload */}
      {activeTab === 'team' && (
        <div id="project-team-workload-view" className="space-y-4">
          <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Team Workload & Assignment Distribution
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                See individual task load and deliverables for this project
              </p>
            </div>
            {isAdmin && (
              <button
                onClick={() => setIsManagingMembers(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
              >
                <Users className="w-3.5 h-3.5" />
                Manage Project Roster
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {projectTeam.map((member) => {
              const memberProjectTasks = projectTasks.filter((t) => t.assigneeId === member.id);
              const activeCount = memberProjectTasks.filter((t) => t.status === 'In Progress').length;
              const blockedCount = memberProjectTasks.filter((t) => t.status === 'Blocked').length;
              const completedCount = memberProjectTasks.filter((t) => t.status === 'Completed').length;

              return (
                <div
                  key={member.id}
                  className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-2xs space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {member.avatar ? (
                        <img
                          src={member.avatar}
                          alt={member.name}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div
                          style={{ backgroundColor: member.color || '#2563eb' }}
                          className="w-10 h-10 rounded-full text-white font-semibold flex items-center justify-center text-xs"
                        >
                          {getInitials(member.name)}
                        </div>
                      )}
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">{member.name}</h4>
                        <p className="text-2xs text-slate-500 dark:text-slate-400">{member.role}</p>
                        <span className="text-3xs text-slate-400 dark:text-slate-500">{member.email}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => onOpenTaskModal(null, 'In Progress')}
                      className="text-2xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline"
                    >
                      + Assign Task
                    </button>
                  </div>

                  {/* Task Workload Bar */}
                  <div className="grid grid-cols-3 gap-2 text-center text-2xs pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="p-1.5 bg-blue-50/60 dark:bg-blue-950/40 rounded-md border border-blue-100 dark:border-blue-900/50">
                      <span className="font-bold text-blue-700 dark:text-blue-400">{activeCount}</span>
                      <p className="text-3xs text-slate-500 dark:text-slate-400">In Progress</p>
                    </div>
                    <div className="p-1.5 bg-amber-50/60 dark:bg-amber-950/40 rounded-md border border-amber-100 dark:border-amber-900/50">
                      <span className="font-bold text-amber-700 dark:text-amber-400">{blockedCount}</span>
                      <p className="text-3xs text-slate-500 dark:text-slate-400">Blocked</p>
                    </div>
                    <div className="p-1.5 bg-emerald-50/60 dark:bg-emerald-950/40 rounded-md border border-emerald-100 dark:border-emerald-900/50">
                      <span className="font-bold text-emerald-700 dark:text-emerald-400">{completedCount}</span>
                      <p className="text-3xs text-slate-500 dark:text-slate-400">Completed</p>
                    </div>
                  </div>

                  {/* Task List */}
                  <div className="space-y-1 pt-1">
                    <span className="text-2xs font-semibold text-slate-400 dark:text-slate-500 block">
                      Deliverables ({memberProjectTasks.length}):
                    </span>
                    {memberProjectTasks.slice(0, 4).map((t) => {
                      const tDue = getDueDateStatus(t.dueDate);
                      return (
                        <div
                          key={t.id}
                          onClick={() => onOpenTaskModal(t)}
                          className="flex items-center justify-between p-1.5 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer text-2xs border border-slate-100 dark:border-slate-800 gap-1.5"
                        >
                          <span className="truncate max-w-[170px] text-slate-700 dark:text-slate-300 font-medium">
                            {t.title}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            {tDue.isToday && (
                              <span className="text-3xs font-bold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 px-1 py-0.2 rounded-sm flex items-center gap-0.5 ring-1 ring-rose-400/80 dark:ring-rose-800/80 animate-pulse">
                                <AlertCircle className="w-2.5 h-2.5 text-rose-600 dark:text-rose-400" />
                                Today
                              </span>
                            )}
                            <StatusBadge status={t.status} size="xs" />
                          </div>
                        </div>
                      );
                    })}
                    {memberProjectTasks.length === 0 && (
                      <p className="text-2xs text-slate-400 dark:text-slate-500 italic">No tasks currently assigned</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal: Manage Project Members Roster */}
      {isManagingMembers && (
        <div
          id="manage-project-members-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150"
        >
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Manage Project Members
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{project.name}</p>
                </div>
              </div>
              <button
                onClick={() => setIsManagingMembers(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 max-h-80 overflow-y-auto space-y-2">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Select team members to include on this project:
                </p>
                {onOpenAddMember && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsManagingMembers(false);
                      onOpenAddMember();
                    }}
                    className="text-2xs text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 font-semibold"
                  >
                    <UserPlus className="w-3 h-3" />
                    + New Member
                  </button>
                )}
              </div>

              {teamMembers.map((member) => {
                const isSelected = selectedMemberIds.includes(member.id);
                return (
                  <div
                    key={member.id}
                    onClick={() => toggleMemberInProject(member.id)}
                    className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer text-xs transition-colors ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200 font-medium'
                        : 'bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      {member.avatar ? (
                        <img
                          src={member.avatar}
                          alt={member.name}
                          className="w-8 h-8 rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <div
                          style={{ backgroundColor: member.color || '#2563eb' }}
                          className="w-8 h-8 rounded-full text-white text-xs font-semibold flex items-center justify-center shrink-0"
                        >
                          {getInitials(member.name)}
                        </div>
                      )}
                      <div className="truncate">
                        <p className="font-semibold text-slate-900 dark:text-white truncate">{member.name}</p>
                        <p className="text-2xs text-slate-500 dark:text-slate-400 truncate">{member.role}</p>
                      </div>
                    </div>
                    {isSelected ? (
                      <div className="w-5 h-5 rounded-md bg-blue-600 text-white flex items-center justify-center shrink-0">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-md border border-slate-300 dark:border-slate-600 shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsManagingMembers(false)}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveMembers}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs"
              >
                Save Project Team
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
