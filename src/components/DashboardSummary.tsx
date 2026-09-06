import React, { useState, useMemo } from 'react';
import {
  FolderKanban,
  CheckCircle2,
  Clock,
  AlertOctagon,
  Calendar,
  ChevronRight,
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
} from 'lucide-react';
import { Project, Task, TeamMember, StatusType, AuthUser } from '../types';
import { getDueDateStatus, isDueToday } from '../utils/dateUtils';
import { FORM_STYLES } from '../utils/formStyles';
import { TeamActivitiesFeed } from './TeamActivitiesFeed';
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
}) => {
  const isAdmin = currentUser?.role === 'admin';
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const safeProjects = Array.isArray(projects) ? projects : [];
  const safeTasks = Array.isArray(tasks) ? tasks : [];
  const safeMembers = Array.isArray(teamMembers) ? teamMembers : [];

  // Metrics computation
  const metrics = useMemo(() => {
    const totalProjects = safeProjects.length;
    const activeProjects = safeProjects.filter(
      (p) => p.status === 'In Progress' || p.status === 'Pending'
    ).length;
    const blockedProjects = safeProjects.filter((p) => p.status === 'Blocked').length;
    const completedProjects = safeProjects.filter((p) => p.status === 'Completed').length;

    const totalTasks = safeTasks.length;
    const inProgressTasks = safeTasks.filter((t) => t.status === 'In Progress').length;
    const blockedTasks = safeTasks.filter((t) => t.status === 'Blocked').length;
    const completedTasks = safeTasks.filter((t) => t.status === 'Completed').length;
    const pendingTasks = safeTasks.filter((t) => t.status === 'Pending').length;

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
      pendingTasks,
      overallCompletionRate,
    };
  }, [safeProjects, safeTasks]);

  // Upcoming deadlines (Tasks & Projects sorted by deadline)
  const upcomingDeadlines = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activeTasks = safeTasks
      .filter((t) => t.status !== 'Completed')
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

    return activeTasks.slice(0, 6);
  }, [safeTasks, safeProjects, safeMembers]);

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
            {metrics.pendingTasks} pending review
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

      {/* 2-Column Dashboard Body: Left = Deadlines & Projects, Right = Live Team Activities */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* Left Column (8 cols on xl): Deadlines & Projects Directory */}
        <div className="xl:col-span-8 space-y-8 min-w-0">
          {/* Upcoming Deadlines Section */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
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
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            {upcomingDeadlines.length} items queued
          </span>
        </div>

        {upcomingDeadlines.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400 py-6 text-center">
            No pending task deadlines. All current tasks completed!
          </p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {upcomingDeadlines.map((item) => {
              const isOverdue = item.diffDays < 0;
              const isToday = item.diffDays === 0;

              return (
                <div
                  key={item.id}
                  onClick={() => onSelectProject(item.projectId)}
                  className="py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 -mx-3 px-3 rounded-lg cursor-pointer transition-colors"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0"
                      style={{ backgroundColor: item.projectColor }}
                      title={`Project: ${item.projectName}`}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                          {item.title}
                        </span>
                        <PriorityBadge priority={item.priority} size="sm" />
                        <StatusBadge status={item.status} size="sm" />
                      </div>

                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                        <span className="font-medium text-slate-700 dark:text-slate-300">{item.projectName}</span>
                        {item.assignee && (
                          <>
                            <span>&bull;</span>
                            <div className="flex items-center gap-1.5">
                              {item.assignee.avatar ? (
                                <img
                                  src={item.assignee.avatar}
                                  alt={item.assignee.name}
                                  className="w-4 h-4 rounded-full object-cover"
                                />
                              ) : (
                                <div
                                  style={{ backgroundColor: item.assignee.color || '#2563eb' }}
                                  className="w-4 h-4 rounded-full text-white text-3xs flex items-center justify-center font-bold"
                                >
                                  {getInitials(item.assignee.name)}
                                </div>
                              )}
                              <span>{item.assignee.name}</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Deadline Countdown Pill */}
                  <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
                    <div
                      className={`text-xs px-2.5 py-1 rounded-lg border font-medium flex items-center gap-1.5 ${
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

                    <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Projects Directory & Summary Cards */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 mr-1">Filter by Status:</span>
            <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
              {['all', 'In Progress', 'Pending', 'Blocked', 'Completed'].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    statusFilter === st
                      ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-2xs font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {st === 'all' ? 'All Projects' : st}
                </button>
              ))}
            </div>
          </div>

          <div className="relative w-full sm:w-64">
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

        {/* Project Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                            <option value="Pending">Pending</option>
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
                </div>

                {/* Progress & Bottom Bar */}
                <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
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
      </div>
    </div>

    {/* Right Column: Live Team Activities Feed */}
    <div className="xl:col-span-4 xl:sticky xl:top-24 space-y-6">
      <TeamActivitiesFeed
        onSelectProject={onSelectProject}
        refreshTrigger={refreshTrigger}
      />
    </div>
  </div>
</div>
);
};
