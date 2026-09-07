import React, { useState, useMemo } from 'react';
import {
  FolderKanban,
  CheckCircle2,
  Clock,
  AlertOctagon,
  Calendar,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Search,
  Users,
  AlertTriangle,
  AlertCircle,
  ArrowUpRight,
  Plus,
  BarChart3,
  UserPlus,
  X,
  Edit2,
  Trash2,
  ShieldCheck,
  UserCheck,
  Table as TableIcon,
  LayoutGrid,
} from 'lucide-react';
import { Project, Task, TeamMember, StatusType, AuthUser } from '../types';
import { getDueDateStatus, isDueToday, formatDateTime } from '../utils/dateUtils';
import { FORM_STYLES } from '../utils/formStyles';
import { StatusBadge, PriorityBadge, getStatusBadgeClass, getPriorityBadgeClass } from './Badges';

interface DashboardSummaryProps {
  projects: Project[];
  tasks: Task[];
  teamMembers: TeamMember[];
  onSelectProject: (projectId: string) => void;
  onOpenNewProject: () => void;
  onUpdateProjectStatus: (projectId: string, newStatus: StatusType) => void;
  onNavigateToTeam?: () => void;
  onOpenAddMember?: () => void;
  currentUser?: AuthUser | null;
  onEditProject?: (project: Project) => void;
  onDeleteProject?: (project: Project) => void;
  refreshTrigger?: number;
  recycleBinCount?: number;
  onOpenRecycleBin?: () => void;
}

export const DashboardSummary: React.FC<DashboardSummaryProps> = ({
  projects = [],
  tasks = [],
  teamMembers = [],
  onSelectProject,
  onOpenNewProject,
  onUpdateProjectStatus,
  onNavigateToTeam,
  onOpenAddMember,
  currentUser,
  onEditProject,
  onDeleteProject,
  refreshTrigger,
  recycleBinCount = 0,
  onOpenRecycleBin,
}) => {
  const isAdmin = currentUser?.role === 'admin';
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Projects Directory View Mode State (Table vs Cards - Table default)
  const [projectListViewMode, setProjectListViewMode] = useState<'card' | 'table'>('table');

  // Deadlines Section Filter & Pagination State
  const [deadlineStatusFilter, setDeadlineStatusFilter] = useState<'all' | 'In Progress' | 'Ready Review' | 'Blocked'>('all');
  const [deadlinePageSize, setDeadlinePageSize] = useState<number | 'all'>(6);
  const [deadlineCurrentPage, setDeadlineCurrentPage] = useState<number>(1);

  const safeProjects = Array.isArray(projects) ? projects : [];
  const safeTasks = Array.isArray(tasks) ? tasks : [];
  const safeMembers = Array.isArray(teamMembers) ? teamMembers : [];

  // Metrics computation
  const metrics = useMemo(() => {
    const totalProjects = safeProjects.length;
    const activeProjects = safeProjects.filter(
      (p) => p.status === 'In Progress' || p.status === 'Ready Review' || p.status === 'Pending'
    ).length;
    const blockedProjects = safeProjects.filter((p) => p.status === 'Blocked').length;
    const completedProjects = safeProjects.filter((p) => p.status === 'Completed').length;

    const totalTasks = safeTasks.length;
    const inProgressTasks = safeTasks.filter((t) => t.status === 'In Progress').length;
    const blockedTasks = safeTasks.filter((t) => t.status === 'Blocked').length;
    const completedTasks = safeTasks.filter((t) => t.status === 'Completed').length;
    const readyReviewTasks = safeTasks.filter((t) => t.status === 'Ready Review' || t.status === 'Pending').length;

    const overallCompletionRate =
      totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return {
      totalProjects,
      activeProjects,
      blockedProjects,
      completedProjects,
      totalTasks,
      inProgressTasks,
      blockedTasks,
      completedTasks,
      readyReviewTasks,
      pendingTasks: readyReviewTasks,
      overallCompletionRate,
    };
  }, [safeProjects, safeTasks]);

  // All open tasks (In Progress, Ready Review, Blocked) sorted by nearest deadline
  const allActiveDeadlines = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return safeTasks
      .filter((t) => t.status === 'In Progress' || t.status === 'Ready Review' || t.status === 'Pending' || t.status === 'Blocked')
      .map((t) => {
        const proj = safeProjects.find((p) => p.id === t.projectId);
        const assignee = safeMembers.find((m) => m.id === t.assigneeId);
        const dueDateObj = new Date(t.dueDate);
        const diffDays = Math.ceil(
          (dueDateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );
        return {
          id: t.id,
          title: t.title,
          projectName: proj?.name || 'Unknown Project',
          projectColor: proj?.color || '#2563eb',
          projectId: t.projectId,
          dueDate: t.dueDate,
          diffDays,
          priority: t.priority,
          status: t.status,
          assignee,
        };
      })
      .sort((a, b) => a.diffDays - b.diffDays);
  }, [safeTasks, safeProjects, safeMembers]);

  // Counts by status for quick tabs
  const deadlineCounts = useMemo(() => {
    const readyReview = allActiveDeadlines.filter((d) => d.status === 'Ready Review' || d.status === 'Pending').length;
    return {
      all: allActiveDeadlines.length,
      inProgress: allActiveDeadlines.filter((d) => d.status === 'In Progress').length,
      readyReview,
      pending: readyReview,
      blocked: allActiveDeadlines.filter((d) => d.status === 'Blocked').length,
    };
  }, [allActiveDeadlines]);

  // Filtered by selected tab
  const filteredDeadlines = useMemo(() => {
    if (deadlineStatusFilter === 'all') return allActiveDeadlines;
    return allActiveDeadlines.filter((d) => d.status === deadlineStatusFilter);
  }, [allActiveDeadlines, deadlineStatusFilter]);

  // Pagination calculation
  const totalDeadlineItems = filteredDeadlines.length;
  const effectivePageSize = deadlinePageSize === 'all' ? (totalDeadlineItems || 1) : deadlinePageSize;
  const totalDeadlinePages = Math.max(1, Math.ceil(totalDeadlineItems / effectivePageSize));
  const safeCurrentPage = Math.min(Math.max(1, deadlineCurrentPage), totalDeadlinePages);

  const displayedDeadlines = useMemo(() => {
    if (deadlinePageSize === 'all') return filteredDeadlines;
    const startIdx = (safeCurrentPage - 1) * effectivePageSize;
    return filteredDeadlines.slice(startIdx, startIdx + effectivePageSize);
  }, [filteredDeadlines, deadlinePageSize, safeCurrentPage, effectivePageSize]);

  const handleStatusFilterChange = (status: 'all' | 'In Progress' | 'Ready Review' | 'Blocked') => {
    setDeadlineStatusFilter(status);
    setDeadlineCurrentPage(1);
  };

  // Project counts per status
  const projectStatusCounts = useMemo(() => {
    const readyReview = safeProjects.filter((p) => p.status === 'Ready Review' || p.status === 'Pending').length;
    return {
      all: safeProjects.length,
      inProgress: safeProjects.filter((p) => p.status === 'In Progress').length,
      readyReview,
      pending: readyReview,
      blocked: safeProjects.filter((p) => p.status === 'Blocked').length,
      completed: safeProjects.filter((p) => p.status === 'Completed').length,
    };
  }, [safeProjects]);

  // Filtered Projects list
  const filteredProjects = useMemo(() => {
    return safeProjects.filter((p) => {
      const matchesStatus =
        statusFilter === 'all' ? true : p.status.toLowerCase() === statusFilter.toLowerCase();
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.client.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.tags || []).some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesStatus && matchesSearch;
    });
  }, [safeProjects, statusFilter, searchQuery]);

  const getStatusBadge = (status: StatusType) => getStatusBadgeClass(status, 'sm');
  const getPriorityBadge = (priority: string) => getPriorityBadgeClass(priority, 'sm');

  const getInitials = (fullName: string) => {
    if (!fullName) return '?';
    const parts = fullName.trim().split(' ');
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <div id="dashboard-summary-view" className="space-y-8 pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 id="portfolio-title" className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Dashboard Summary
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Overview of active projects, deliverables, team workload, and upcoming deadlines.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
         {/*  {onNavigateToTeam && (
            <button
              id="dash-team-btn"
              onClick={onNavigateToTeam}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            >
              <Users className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              Manage Team ({teamMembers.length})
            </button>
          )} */}

         {/*  {isAdmin && onOpenAddMember && (
            <button
              id="dash-add-member-btn"
              onClick={onOpenAddMember}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            >
              <UserPlus className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              + Add Member
            </button>
          )}
 */}
         {/*  {onOpenRecycleBin && (
            <button
              id="dash-recycle-bin-btn"
              onClick={onOpenRecycleBin}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-rose-50 hover:border-rose-200 dark:hover:bg-rose-950/40 dark:hover:border-rose-800/60 text-slate-700 hover:text-rose-600 dark:text-slate-200 dark:hover:text-rose-400 rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
              title="Recycle Bin (1-week retention for deleted items)"
            >
              <Trash2 className="w-4 h-4 text-rose-500 dark:text-rose-400" />
              <span>Recycle Bin</span>
              {recycleBinCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-3xs font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                  {recycleBinCount}
                </span>
              )}
            </button>
          )} */}

          {isAdmin && (
            <button
              id="dash-create-project-btn"
              onClick={onOpenNewProject}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              New Project
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5 sm:gap-4">
        {/* Active Projects */}
        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Active Projects
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <FolderKanban className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">{metrics.activeProjects}</p>
          <p className="text-2xs text-slate-500 dark:text-slate-400 mt-1">
            {metrics.completedProjects} completed • {metrics.totalProjects} total
          </p>
        </div>

        {/* In Progress Tasks */}
        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              In Progress Tasks
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">{metrics.inProgressTasks}</p>
          <p className="text-2xs text-slate-500 dark:text-slate-400 mt-1">
            {metrics.readyReviewTasks} ready review
          </p>
        </div>

        {/* Blocked Bottlenecks */}
        <div
          className={`p-4 rounded-xl border shadow-2xs ${
            metrics.blockedTasks > 0
              ? 'bg-rose-50/50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/50'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-2xs font-semibold uppercase tracking-wider ${
                metrics.blockedTasks > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              Blocked Tasks
            </span>
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                metrics.blockedTasks > 0
                  ? 'bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
              }`}
            >
              <AlertOctagon className="w-4 h-4" />
            </div>
          </div>
          <p
            className={`text-2xl font-bold mt-2 ${
              metrics.blockedTasks > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-slate-900 dark:text-white'
            }`}
          >
            {metrics.blockedTasks}
          </p>
          <p
            className={`text-2xs mt-1 ${
              metrics.blockedTasks > 0 ? 'text-rose-600 dark:text-rose-300 font-medium' : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {metrics.blockedProjects} project(s) affected
          </p>
        </div>

        {/* Completed Deliverables */}
        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Completed Tasks
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">{metrics.completedTasks}</p>
          <p className="text-2xs text-slate-500 dark:text-slate-400 mt-1">
            Out of {metrics.totalTasks} total tasks
          </p>
        </div>

        {/* Team & Velocity */}
        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Team Members
            </span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">{teamMembers.length}</p>
          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
            <div
              className="bg-blue-600 dark:bg-blue-500 h-full rounded-full transition-all"
              style={{ width: `${metrics.overallCompletionRate}%` }}
            />
          </div>
          <p className="text-3xs text-slate-400 dark:text-slate-500 mt-1">
            Overall {metrics.overallCompletionRate}% complete
          </p>
        </div>
      </div>

      {/* Deadlines & Projects Directory */}
      <div className="space-y-8 min-w-0">
        {/* Upcoming Deadlines Section */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <h3 id="deadlines-heading" className="text-base font-semibold text-slate-900 dark:text-white">
                    Upcoming Deadlines & Milestones
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Sorted by nearest target due date across all projects
                  </p>
                </div>
              </div>

              {/* Status Filter Tabs */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {[
                  { label: 'All', value: 'all', count: deadlineCounts.all },
                  { label: 'In Progress', value: 'In Progress', count: deadlineCounts.inProgress },
                  { label: 'Ready Review', value: 'Ready Review', count: deadlineCounts.readyReview },
                  { label: 'Blocked', value: 'Blocked', count: deadlineCounts.blocked },
                ].map((tab) => (
                  <button
                    key={tab.value}
                    onClick={() => handleStatusFilterChange(tab.value as any)}
                    className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                      deadlineStatusFilter === tab.value
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`text-3xs px-1.5 py-0.2 rounded-full font-semibold ${
                        deadlineStatusFilter === tab.value
                          ? 'bg-white/25 text-white'
                          : tab.value === 'Blocked' && tab.count > 0
                          ? 'bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {displayedDeadlines.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  {deadlineStatusFilter === 'all'
                    ? 'No pending task deadlines. All current tasks completed!'
                    : `No tasks found with status "${deadlineStatusFilter}".`}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto -mx-6">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-y border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/50 text-2xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      <th className="py-3 pl-6 pr-3 text-center w-14">#</th>
                      <th className="py-3 px-4 min-w-[200px]">Task / Deliverable</th>
                      <th className="py-3 px-4 min-w-[150px]">Project</th>
                      <th className="py-3 px-4 min-w-[140px]">Assignee</th>
                      <th className="py-3 px-3 min-w-[95px]">Priority</th>
                      <th className="py-3 px-3 min-w-[105px]">Status</th>
                      <th className="py-3 px-4 min-w-[200px]">Deadline</th>
                      <th className="py-3 pr-6 pl-3 text-right w-24">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                    {displayedDeadlines.map((item, idx) => {
                      const isOverdue = item.diffDays < 0;
                      const isToday = item.diffDays === 0;
                      const rowNumber =
                        deadlinePageSize === 'all'
                          ? idx + 1
                          : (safeCurrentPage - 1) * (deadlinePageSize as number) + idx + 1;

                      return (
                        <tr
                          key={item.id}
                          onClick={() => onSelectProject(item.projectId)}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 cursor-pointer transition-colors group"
                        >
                          {/* # Row Index */}
                          <td className="py-3.5 pl-6 pr-3 text-center">
                            <span className="text-3xs font-bold text-slate-400 dark:text-slate-500">
                              {rowNumber}
                            </span>
                          </td>

                          {/* Task / Deliverable Title */}
                          <td className="py-3.5 px-4">
                            <span className="font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-1">
                              {item.title}
                            </span>
                          </td>

                          {/* Project Name with Color Dot */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs"
                                style={{ backgroundColor: item.projectColor }}
                              />
                              <span className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-[150px]">
                                {item.projectName}
                              </span>
                            </div>
                          </td>

                          {/* Assignee */}
                          <td className="py-3.5 px-4">
                            {item.assignee ? (
                              <div className="flex items-center gap-2">
                                {item.assignee.avatar ? (
                                  <img
                                    src={item.assignee.avatar}
                                    alt={item.assignee.name}
                                    className="w-5 h-5 rounded-full object-cover shrink-0"
                                  />
                                ) : (
                                  <div
                                    style={{ backgroundColor: item.assignee.color || '#2563eb' }}
                                    className="w-5 h-5 rounded-full text-white text-3xs flex items-center justify-center font-bold shrink-0"
                                  >
                                    {getInitials(item.assignee.name)}
                                  </div>
                                )}
                                <span className="text-xs text-slate-700 dark:text-slate-300 font-medium truncate max-w-[110px]">
                                  {item.assignee.name}
                                </span>
                              </div>
                            ) : (
                              <span className="text-2xs text-slate-400 italic">Unassigned</span>
                            )}
                          </td>

                          {/* Priority */}
                          <td className="py-3.5 px-3">
                            <PriorityBadge priority={item.priority} size="sm" />
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-3">
                            <StatusBadge status={item.status} size="sm" />
                          </td>

                          {/* Deadline countdown badge */}
                          <td className="py-3.5 px-4">
                            <div
                              className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border font-medium ${
                                isToday
                                  ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800 font-bold ring-1 ring-rose-400/80 shadow-2xs'
                                  : isOverdue
                                  ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800 font-semibold'
                                  : item.diffDays <= 3
                                  ? 'bg-amber-50/70 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                                  : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                              }`}
                            >
                              {isToday ? (
                                <AlertCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 animate-pulse shrink-0" />
                              ) : isOverdue ? (
                                <AlertOctagon className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                              ) : (
                                <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                              )}
                              <span>
                                {isToday
                                  ? 'Due Today!'
                                  : isOverdue
                                  ? `Overdue by ${Math.abs(item.diffDays)}d`
                                  : `Due in ${item.diffDays} days (${item.dueDate})`}
                              </span>
                            </div>
                          </td>

                          {/* Action */}
                          <td className="py-3.5 pr-6 pl-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-2xs font-semibold text-blue-600 dark:text-blue-400 group-hover:underline flex items-center gap-0.5">
                                View
                                <ArrowUpRight className="w-3 h-3" />
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Footer Pagination & View Controls */}
            {totalDeadlineItems > 0 && (
              <div className="pt-3.5 mt-3 border-t border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-1.5">
                  <span>
                    Showing{' '}
                    <strong className="text-slate-700 dark:text-slate-200">
                      {deadlinePageSize === 'all'
                        ? totalDeadlineItems
                        : `${(safeCurrentPage - 1) * (deadlinePageSize as number) + 1}–${Math.min(
                            safeCurrentPage * (deadlinePageSize as number),
                            totalDeadlineItems
                          )}`}
                    </strong>{' '}
                    of <strong className="text-slate-700 dark:text-slate-200">{totalDeadlineItems}</strong> tasks
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  {/* View mode switcher */}
                  <div className="flex items-center gap-1 text-2xs">
                    <span className="text-slate-400 mr-0.5">Show:</span>
                    {[6, 12, 'all'].map((size) => (
                      <button
                        key={size}
                        onClick={() => {
                          setDeadlinePageSize(size as any);
                          setDeadlineCurrentPage(1);
                        }}
                        className={`px-2 py-0.5 rounded cursor-pointer font-medium transition-colors ${
                          deadlinePageSize === size
                            ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        {size === 'all' ? 'All' : size}
                      </button>
                    ))}
                  </div>

                  {/* Pagination Buttons (when not viewing 'all' and more than 1 page) */}
                  {deadlinePageSize !== 'all' && totalDeadlinePages > 1 && (
                    <div className="flex items-center gap-1">
                      <button
                        disabled={safeCurrentPage <= 1}
                        onClick={() => setDeadlineCurrentPage((p) => Math.max(1, p - 1))}
                        className="p-1 rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                        title="Previous page"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-2xs font-semibold px-1 text-slate-600 dark:text-slate-300">
                        {safeCurrentPage} / {totalDeadlinePages}
                      </span>
                      <button
                        disabled={safeCurrentPage >= totalDeadlinePages}
                        onClick={() => setDeadlineCurrentPage((p) => Math.min(totalDeadlinePages, p + 1))}
                        className="p-1 rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                        title="Next page"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Projects Directory & Summary Cards */}
      <div className="space-y-4">
        {/* Row 1: Filter by Status + Search */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Filter by Status:</span>
            <div className="flex items-center min-h-9 sm:h-9 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs flex-wrap gap-0.5">
              {[
                { label: 'All Projects', value: 'all', count: projectStatusCounts.all },
                { label: 'In Progress', value: 'In Progress', count: projectStatusCounts.inProgress },
                { label: 'Ready Review', value: 'Ready Review', count: projectStatusCounts.readyReview },
                { label: 'Blocked', value: 'Blocked', count: projectStatusCounts.blocked },
                { label: 'Completed', value: 'Completed', count: projectStatusCounts.completed },
              ].map((st) => (
                <button
                  key={st.value}
                  onClick={() => setStatusFilter(st.value)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                    statusFilter === st.value
                      ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-2xs font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span>{st.label}</span>
                  <span
                    className={`text-3xs px-1.5 py-0.5 rounded-full font-semibold ${
                      statusFilter === st.value
                        ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300'
                        : st.value === 'Blocked' && st.count > 0
                        ? 'bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300'
                        : 'bg-slate-200/80 dark:bg-slate-700/80 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {st.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="relative w-full sm:w-64 shrink-0">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" />
            <input
              id="search-projects-input"
              type="text"
              placeholder="Search projects, clients, tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={FORM_STYLES.searchInput}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded cursor-pointer"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Below Status - View Mode Switcher (Cards vs Table) & Summary Info */}
        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Showing <strong className="text-slate-700 dark:text-slate-200">{filteredProjects.length}</strong> {filteredProjects.length === 1 ? 'project' : 'projects'}
            {searchQuery && <span className="text-slate-400"> matching &ldquo;{searchQuery}&rdquo;</span>}
          </div>

          {/* View Mode Switcher: Table vs Cards */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              id="projects-view-table-btn"
              onClick={() => setProjectListViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                projectListViewMode === 'table'
                  ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-2xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Table View"
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Table</span>
            </button>
            <button
              type="button"
              id="projects-view-cards-btn"
              onClick={() => setProjectListViewMode('card')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                projectListViewMode === 'card'
                  ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-2xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Card View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Cards</span>
            </button>
          </div>
        </div>

        {/* Content Section: Empty state vs Table View vs Cards View */}
        {filteredProjects.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-12 text-center shadow-2xs">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No matching projects found</p>
            <p className="text-xs text-slate-400 mt-1">Try adjusting your search query or status filter.</p>
          </div>
        ) : projectListViewMode === 'table' ? (
          /* Table View */
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60 text-2xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-3 text-center w-10">#</th>
                    <th className="py-3 px-4 min-w-[200px]">Project</th>
                    <th className="py-3 px-4 min-w-[120px]">Status</th>
                    <th className="py-3 px-4 min-w-[130px]">Progress</th>
                    <th className="py-3 px-4 min-w-[180px]">Deliverables</th>
                    <th className="py-3 px-4 min-w-[110px]">Deadline</th>
                    <th className="py-3 px-4 min-w-[130px]">Team</th>
                    <th className="py-3 px-4 text-right min-w-[110px]">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {filteredProjects.map((project, idx) => {
                    const projectTasks = tasks.filter((t) => t.projectId === project.id);
                    const completedCount = projectTasks.filter((t) => t.status === 'Completed').length;
                    const inProgressCount = projectTasks.filter((t) => t.status === 'In Progress').length;
                    const blockedCount = projectTasks.filter((t) => t.status === 'Blocked').length;
                    const readyReviewCount = projectTasks.filter((t) => t.status === 'Ready Review' || t.status === 'Pending').length;
                    const completionPercent =
                      projectTasks.length > 0
                        ? Math.round((completedCount / projectTasks.length) * 100)
                        : 0;
                    const projectTeam = teamMembers.filter((m) => project.memberIds?.includes(m.id));
                    const isCurrentUserAssigned =
                      currentUser && (project.memberIds || []).includes(currentUser.memberId);

                    return (
                      <tr
                        key={project.id}
                        id={`project-row-${project.id}`}
                        onClick={() => onSelectProject(project.id)}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                      >
                        {/* # Index */}
                        <td className="py-3.5 px-3 text-center">
                          <span className="text-3xs font-bold text-slate-400 dark:text-slate-500">
                            {idx + 1}
                          </span>
                        </td>

                        {/* Project Name, Client & Creator */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <span
                              className="w-3 h-3 rounded-full shrink-0 shadow-2xs"
                              style={{ backgroundColor: project.color || '#2563eb' }}
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                                  {project.name}
                                </span>
                                {project.client && (
                                  <span className="px-1.5 py-0.2 rounded text-3xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                    {project.client}
                                  </span>
                                )}
                                {isCurrentUserAssigned && (
                                  <span className="inline-flex items-center gap-0.5 text-4xs font-bold px-1 py-0.2 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                    <UserCheck className="w-2.5 h-2.5" />
                                    You
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-3xs text-slate-400 dark:text-slate-500 mt-0.5">
                                {project.createdByName && (
                                  <span>By: {project.createdByName}</span>
                                )}
                                {project.updatedAt && (
                                  <>
                                    <span>&bull;</span>
                                    <span>Updated {formatDateTime(project.updatedAt).split(',')[0]}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                          {isAdmin ? (
                            <div className="relative inline-block">
                              <select
                                id={`project-status-select-${project.id}`}
                                value={project.status}
                                onChange={(e) =>
                                  onUpdateProjectStatus(project.id, e.target.value as StatusType)
                                }
                                className={`text-2xs font-semibold px-2 py-1 rounded-md border appearance-none pr-6 cursor-pointer ${
                                  project.status === 'Completed'
                                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                    : project.status === 'Blocked'
                                    ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                                    : project.status === 'Ready Review' || project.status === 'Pending'
                                    ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                                    : 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                                }`}
                              >
                                <option value="In Progress">In Progress</option>
                                <option value="Ready Review">Ready Review</option>
                                <option value="Blocked">Blocked</option>
                                <option value="Completed">Completed</option>
                              </select>
                              <ChevronDown className="w-3 h-3 text-slate-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                            </div>
                          ) : (
                            <StatusBadge status={project.status} size="sm" />
                          )}
                        </td>

                        {/* Progress */}
                        <td className="py-3.5 px-4">
                          <div className="space-y-1 max-w-[120px]">
                            <div className="flex items-center justify-between text-2xs">
                              <span className="font-bold text-slate-800 dark:text-slate-200">
                                {completionPercent}%
                              </span>
                              <span className="text-3xs text-slate-400 dark:text-slate-500">
                                {completedCount}/{projectTasks.length}
                              </span>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${
                                  completionPercent === 100
                                    ? 'bg-emerald-500'
                                    : completionPercent >= 50
                                    ? 'bg-blue-600'
                                    : 'bg-amber-500'
                                }`}
                                style={{ width: `${completionPercent}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Deliverables Overview */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {completedCount > 0 && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-4xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800">
                                <CheckCircle2 className="w-2.5 h-2.5" />
                                {completedCount} Done
                              </span>
                            )}
                            {inProgressCount + readyReviewCount > 0 && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-4xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800">
                                <Clock className="w-2.5 h-2.5" />
                                {inProgressCount + readyReviewCount} Ongoing
                              </span>
                            )}
                            {blockedCount > 0 && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-4xs font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200/60 dark:border-rose-800">
                                <AlertOctagon className="w-2.5 h-2.5" />
                                {blockedCount} Blocked
                              </span>
                            )}
                            {projectTasks.length === 0 && (
                              <span className="text-3xs text-slate-400 italic">No tasks</span>
                            )}
                          </div>
                        </td>

                        {/* Deadline */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1 text-2xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            <span>
                              {project.targetDeadline
                                ? project.targetDeadline.slice(0, 10)
                                : project.dueDate
                                ? project.dueDate.slice(0, 10)
                                : '—'}
                            </span>
                          </div>
                        </td>

                        {/* Team Avatars */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center -space-x-1.5 overflow-hidden">
                            {projectTeam.slice(0, 3).map((m) =>
                              m.avatar ? (
                                <img
                                  key={m.id}
                                  src={m.avatar}
                                  alt={m.name}
                                  title={`${m.name} (${m.role})`}
                                  className="w-6 h-6 rounded-full object-cover border-2 border-white dark:border-slate-900"
                                />
                              ) : (
                                <div
                                  key={m.id}
                                  style={{ backgroundColor: m.color || '#2563eb' }}
                                  title={`${m.name} (${m.role})`}
                                  className="w-6 h-6 rounded-full text-white text-4xs flex items-center justify-center font-bold border-2 border-white dark:border-slate-900"
                                >
                                  {getInitials(m.name)}
                                </div>
                              )
                            )}
                            {projectTeam.length > 3 && (
                              <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-white dark:border-slate-900 flex items-center justify-center text-4xs text-slate-500 font-semibold">
                                +{projectTeam.length - 3}
                              </div>
                            )}
                            {projectTeam.length === 0 && (
                              <span className="text-3xs text-slate-400">None</span>
                            )}
                          </div>
                        </td>

                        {/* Action Buttons */}
                        <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            {isAdmin && onEditProject && (
                              <button
                                onClick={() => onEditProject(project)}
                                title="Edit Project"
                                className="p-1 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {isAdmin && onDeleteProject && (
                              <button
                                onClick={() => onDeleteProject(project)}
                                title="Delete Project"
                                className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => onSelectProject(project.id)}
                              className="inline-flex items-center gap-1 text-2xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer ml-1"
                            >
                              <span>{isAdmin ? 'Workspace' : 'Details'}</span>
                              <ArrowUpRight className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Project Cards Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProjects.map((project) => {
            const projectTasks = tasks.filter((t) => t.projectId === project.id);
            const completedCount = projectTasks.filter((t) => t.status === 'Completed').length;
            const blockedCount = projectTasks.filter((t) => t.status === 'Blocked').length;
            const completionPercent =
              projectTasks.length > 0
                ? Math.round((completedCount / projectTasks.length) * 100)
                : 0;

            const projectTeam = teamMembers.filter((m) => project.memberIds.includes(m.id));

            const isCurrentUserAssigned =
              currentUser && (project.memberIds || []).includes(currentUser.memberId);

            return (
              <div
                key={project.id}
                id={`project-card-${project.id}`}
                className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: project.color }}
                      />
                      <span className="text-2xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        {project.client}
                      </span>
                      {isCurrentUserAssigned && (
                        <span className="inline-flex items-center gap-1 text-3xs font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          <UserCheck className="w-2.5 h-2.5" />
                          Assigned to You
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Admin Project Actions: Edit & Delete */}
                      {isAdmin && (
                        <div className="flex items-center gap-0.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-0.5">
                          {onEditProject && (
                            <button
                              id={`dash-edit-project-btn-${project.id}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                onEditProject(project);
                              }}
                              title="Edit Project Details"
                              className="p-1 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-white dark:hover:bg-slate-700 rounded-md transition-colors cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {onDeleteProject && (
                            <button
                              id={`dash-delete-project-btn-${project.id}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteProject(project);
                              }}
                              title="Delete Project"
                              className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-white dark:hover:bg-slate-700 rounded-md transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}

                      {/* Status: editable for Admin, static badge for Staff */}
                      {isAdmin ? (
                        <div className="relative inline-flex items-center">
                          <select
                            id={`project-status-selector-${project.id}`}
                            value={project.status}
                            onClick={(e) => e.stopPropagation()}
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
                  </div>

                  <h3
                    id={`project-title-${project.id}`}
                    onClick={() => onSelectProject(project.id)}
                    className="text-base font-bold text-slate-900 dark:text-white mt-2 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer transition-colors"
                  >
                    {project.name}
                  </h3>

                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 line-clamp-2 leading-relaxed">
                    {project.description}
                  </p>

                  {/* Tags */}
                  <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                    {project.tags.map((tag, i) => (
                      <span
                        key={i}
                        className="text-2xs px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium"
                      >
                        {tag}
                      </span>
                    ))}
                    <span className="text-2xs px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-medium flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {projectTeam.length} members
                    </span>
                  </div>

                  {/* Project Audit Attribution */}
                  <div
                    className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-3xs text-slate-400 dark:text-slate-500 gap-2"
                    title={`Created by ${project.createdByName || 'Admin'} on ${formatDateTime(project.createdAt)} • Last updated by ${project.updatedByName || project.createdByName || 'Admin'} on ${formatDateTime(project.updatedAt || project.createdAt)}`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-slate-400 dark:text-slate-500">By:</span>
                      {project.createdByAvatar ? (
                        <img
                          src={project.createdByAvatar}
                          alt={project.createdByName || 'Creator'}
                          className="w-3.5 h-3.5 rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <span className="w-3.5 h-3.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-bold text-4xs flex items-center justify-center shrink-0">
                          {(project.createdByName || 'U').charAt(0).toUpperCase()}
                        </span>
                      )}
                      <span className="font-medium text-slate-600 dark:text-slate-300 truncate">
                        {project.createdByName || 'Admin'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 text-slate-400 dark:text-slate-500">
                      <span>Updated</span>
                      <span className="font-medium text-slate-600 dark:text-slate-300">
                        {formatDateTime(project.updatedAt || project.createdAt).split(',')[0]}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Progress & Bottom Bar */}
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">
                      {completedCount} of {projectTasks.length} deliverables completed
                    </span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{completionPercent}%</span>
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
                      style={{ width: `${completionPercent}%` }}
                    />
                  </div>

                  {blockedCount > 0 && (
                    <div className="mt-2 text-2xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 px-2 py-1 rounded-md flex items-center gap-1.5 font-medium">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      {blockedCount} deliverable currently blocked!
                    </div>
                  )}

                  <div className="mt-4 flex items-center justify-between">
                    {/* Team Members Avatars */}
                    <div className="flex items-center -space-x-1.5">
                      {projectTeam.map((mem) => (
                        <div key={mem.id} title={`${mem.name} (${mem.role})`}>
                          {mem.avatar ? (
                            <img
                              src={mem.avatar}
                              alt={mem.name}
                              className="w-6 h-6 rounded-full ring-2 ring-white dark:ring-slate-900 object-cover"
                            />
                          ) : (
                            <div
                              style={{ backgroundColor: mem.color || '#2563eb' }}
                              className="w-6 h-6 rounded-full ring-2 ring-white dark:ring-slate-900 text-white text-3xs font-semibold flex items-center justify-center shadow-2xs"
                            >
                              {getInitials(mem.name)}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      {(() => {
                        const projDue = getDueDateStatus(project.targetDeadline);
                        if (projDue.isToday) {
                          return (
                            <span className="text-2xs font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 px-2 py-0.5 rounded-md flex items-center gap-1 ring-1 ring-rose-400/80 shadow-2xs animate-pulse">
                              <AlertCircle className="w-3 h-3 text-rose-600 dark:text-rose-400 shrink-0" />
                              Due Today!
                            </span>
                          );
                        }
                        if (projDue.isOverdue) {
                          return (
                            <span className="text-2xs font-semibold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                              <AlertOctagon className="w-3 h-3 text-rose-600 dark:text-rose-400 shrink-0" />
                              Overdue ({project.targetDeadline})
                            </span>
                          );
                        }
                        return (
                          <span className="text-2xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-400 dark:text-slate-500 shrink-0" />
                            Due: {project.targetDeadline}
                          </span>
                        );
                      })()}
                      <button
                        id={`open-project-btn-${project.id}`}
                        onClick={() => onSelectProject(project.id)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline ml-auto cursor-pointer"
                      >
                        {isAdmin ? 'Open Workspace' : 'View Details'}
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      </div>
    </div>
  </div>
);
};
