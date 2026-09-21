import React, { useState, useMemo } from 'react';
import {
  Users,
  Activity,
  AlertTriangle,
  AlertCircle,
  Plus,
  ChevronDown,
  ChevronUp,
  Check,
  Flame,
  Clock,
  Layers,
  Sparkles,
} from 'lucide-react';
import { Project, Task, TeamMember, StatusType, AuthUser, ProjectStage, DEFAULT_PROJECT_STAGES } from '../types';
import { isDueToday, getDueDateStatus } from '../utils/dateUtils';
import { CustomSelect, CustomSelectOption } from './ui/CustomSelect';

interface TeamCapacityBarometerProps {
  project?: Project;
  projects?: Project[];
  projectTeam: TeamMember[];
  projectTasks?: Task[];
  allTasks?: Task[];
  selectedMemberId: string;
  onSelectMember: (memberId: string) => void;
  onOpenTaskModal?: (task?: Task | null, defaultStatus?: StatusType, defaultAssigneeId?: string) => void;
  currentUser?: AuthUser | null;
  className?: string;
  style?: React.CSSProperties;
  isDashboardView?: boolean;
  showAllTeamCard?: boolean;
}

const DEFAULT_CAPACITY_LIMIT = 5;

export const TeamCapacityBarometer: React.FC<TeamCapacityBarometerProps> = ({
  project,
  projects = [],
  projectTeam = [],
  projectTasks = [],
  allTasks = [],
  selectedMemberId = 'all',
  onSelectMember,
  onOpenTaskModal,
  currentUser,
  className = '',
  style,
  isDashboardView = false,
  showAllTeamCard,
}) => {
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role?.toLowerCase() === 'admin';
  const shouldShowAllTeamCard = showAllTeamCard !== undefined ? showAllTeamCard : !isDashboardView;
  const storageKey = isDashboardView ? 'dashboard_capacity_barometer_collapsed' : 'capacity_barometer_collapsed';
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(storageKey) === 'true';
    } catch {
      return false;
    }
  });

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(storageKey, String(next));
      } catch {}
      return next;
    });
  };

  // Scope: 'project' (workload in this project only) vs 'all' (cross-project workload)
  const [workloadScope, setWorkloadScope] = useState<'project' | 'all'>(isDashboardView ? 'all' : 'project');
  // Scope for Dashboard view: filter by specific project or 'all'
  const [dashboardProjectFilter, setDashboardProjectFilter] = useState<string>('all');

  // Stages on the current project
  const projectStages = project?.stages && project.stages.length > 0 ? project.stages : DEFAULT_PROJECT_STAGES;

  // Active status check: count ONLY status 'In Progress'
  const isTaskActive = (task: Task) => {
    return task.status.trim().toLowerCase() === 'in progress';
  };

  // Tasks pool based on scope
  const targetTasksPool = useMemo(() => {
    if (project) {
      return workloadScope === 'all' && allTasks.length > 0 ? allTasks : projectTasks;
    }
    const baseTasks = allTasks.length > 0 ? allTasks : projectTasks;
    if (dashboardProjectFilter && dashboardProjectFilter !== 'all') {
      return baseTasks.filter((t) => t.projectId === dashboardProjectFilter);
    }
    return baseTasks;
  }, [project, workloadScope, allTasks, projectTasks, dashboardProjectFilter]);

  // Effective team based on filter
  const effectiveTeam = useMemo(() => {
    if (project) return projectTeam;
    if (dashboardProjectFilter && dashboardProjectFilter !== 'all' && projects.length > 0) {
      const p = projects.find((proj) => proj.id === dashboardProjectFilter);
      if (p && Array.isArray(p.memberIds) && p.memberIds.length > 0) {
        return projectTeam.filter((m) => p.memberIds.includes(m.id));
      }
    }
    return projectTeam;
  }, [project, projectTeam, dashboardProjectFilter, projects]);

  // Compute workload metrics for each member
  const memberWorkloadStats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return effectiveTeam.map((member) => {
      const memberTasks = targetTasksPool.filter(
        (t) => t.assigneeId === member.id && !t.deletedAt
      );

      const activeTasks = memberTasks.filter((t) => {
        return isTaskActive(t);
      });

      const activeCount = activeTasks.length;
      const completedCount = memberTasks.filter((t) => {
        let stages = project?.stages;
        if (!stages && projects && projects.length > 0) {
          const p = projects.find((proj) => proj.id === t.projectId);
          stages = p?.stages;
        }
        const stagesList = stages && stages.length > 0 ? stages : DEFAULT_PROJECT_STAGES;
        const stage = stagesList.find((s) => s.name.trim().toLowerCase() === t.status.trim().toLowerCase());
        if (stage) return stage.category === 'done';
        return t.status.trim().toLowerCase() === 'completed';
      }).length;

      // Overdue & Due Today
      let overdueCount = 0;
      let dueTodayCount = 0;

      activeTasks.forEach((t) => {
        if (!t.dueDate) return;
        if (isDueToday(t.dueDate)) {
          dueTodayCount++;
        } else {
          const dueObj = new Date(t.dueDate);
          if (dueObj.getTime() < today.getTime()) {
            overdueCount++;
          }
        }
      });

      // Capacity Tier
      let tier: 'available' | 'optimal' | 'limit' | 'overloaded' = 'available';
      let tierLabel = 'Available';
      let tierColor = '#10b981'; // emerald
      let badgeCls = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
      let progressCls = 'bg-emerald-500';

      if (activeCount >= 6) {
        tier = 'overloaded';
        tierLabel = 'Overloaded';
        tierColor = '#ef4444'; // rose
        badgeCls = 'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 border-rose-200 dark:border-rose-800 animate-pulse';
        progressCls = 'bg-rose-500';
      } else if (activeCount === 5) {
        tier = 'limit';
        tierLabel = 'At Limit';
        tierColor = '#f59e0b'; // amber
        badgeCls = 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border-amber-200 dark:border-amber-800';
        progressCls = 'bg-amber-500';
      } else if (activeCount >= 3) {
        tier = 'optimal';
        tierLabel = 'Optimal';
        tierColor = '#3b82f6'; // blue
        badgeCls = 'bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300 border-blue-200 dark:border-blue-800';
        progressCls = 'bg-blue-500';
      }

      const percentage = Math.min(Math.round((activeCount / DEFAULT_CAPACITY_LIMIT) * 100), 160);

      return {
        member,
        activeTasks,
        activeCount,
        completedCount,
        overdueCount,
        dueTodayCount,
        tier,
        tierLabel,
        tierColor,
        badgeCls,
        progressCls,
        percentage,
        isSelf: currentUser?.memberId === member.id,
      };
    });
  }, [effectiveTeam, targetTasksPool, project?.stages, projects, currentUser?.memberId, workloadScope]);

  // Overall Team Summary
  const teamOverview = useMemo(() => {
    const totalActive = memberWorkloadStats.reduce((sum, m) => sum + m.activeCount, 0);
    const overloadedCount = memberWorkloadStats.filter((m) => m.tier === 'overloaded').length;
    const availableCount = memberWorkloadStats.filter((m) => m.tier === 'available').length;
    const totalCapacity = effectiveTeam.length * DEFAULT_CAPACITY_LIMIT;
    const overallUtilization = totalCapacity > 0 ? Math.round((totalActive / totalCapacity) * 100) : 0;

    return {
      totalActive,
      overloadedCount,
      availableCount,
      overallUtilization,
    };
  }, [memberWorkloadStats, effectiveTeam.length]);

  if (effectiveTeam.length === 0) return null;

  return (
    <div
      id="team-capacity-barometer"
      style={style}
      className={`glass-panel rounded-2xl transition-all duration-200 shadow-2xs ${
        isCollapsed ? 'p-2.5 sm:p-3' : 'p-3 sm:p-4'
      } ${className}`}
    >
      {/* Barometer Header */}
      <div
        className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
          isCollapsed ? '' : 'pb-2 border-b border-slate-100/90 dark:border-slate-800/80'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                Team Workload & Capacity Barometer
              </h3>
              {teamOverview.overloadedCount > 0 ? (
                <span className="inline-flex items-center gap-1 text-3xs font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800 animate-pulse">
                  <Flame className="w-2.5 h-2.5" />
                  {teamOverview.overloadedCount} Overloaded
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-3xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  <Check className="w-2.5 h-2.5" />
                  Balanced Capacity
                </span>
              )}
            </div>
            <p className="text-2xs text-slate-500 dark:text-slate-400">
              {effectiveTeam.length} members • {teamOverview.totalActive} active tasks • {teamOverview.overallUtilization}% utilization (Limit: {DEFAULT_CAPACITY_LIMIT}/person)
            </p>
          </div>
        </div>

        {/* Header Controls: Scope Toggle + Collapse/Expand */}
        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          {project ? (
            /* Workload Scope Toggle: In Project vs All Projects */
            <div className="flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-2xs font-semibold">
              <button
                type="button"
                id="barometer-scope-project"
                onClick={() => setWorkloadScope('project')}
                className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                  workloadScope === 'project'
                    ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-2xs font-bold'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
                title="Show workload within this project only"
              >
                This Project
              </button>
              <button
                type="button"
                id="barometer-scope-all"
                onClick={() => setWorkloadScope('all')}
                className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                  workloadScope === 'all'
                    ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-2xs font-bold'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
                title="Show true workload across all projects in the company"
              >
                All Projects
              </button>
            </div>
          ) : projects && projects.length > 0 ? (
            /* Dashboard View: Project Filter Dropdown */
            <div className="flex items-center gap-1.5">
              <span className="text-3xs text-slate-400 font-semibold uppercase tracking-wider hidden sm:inline">Scope:</span>
              <div className="w-36 sm:w-44">
                <CustomSelect
                  id="dashboard-barometer-project-filter"
                  value={dashboardProjectFilter}
                  onChange={(val) => setDashboardProjectFilter(val)}
                  size="sm"
                  placeholder="All Projects"
                  options={[
                    { value: 'all', label: 'All Projects', badge: (allTasks.length > 0 ? allTasks : projectTasks).length },
                    ...projects.map((p) => ({
                      value: p.id,
                      label: p.name,
                      badge: (allTasks.length > 0 ? allTasks : projectTasks).filter((t) => t.projectId === p.id && !t.deletedAt).length,
                    })),
                  ]}
                />
              </div>
            </div>
          ) : null}

          {/* Collapse / Expand Toggle */}
          <button
            type="button"
            onClick={toggleCollapse}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title={isCollapsed ? 'Expand Team Barometer' : 'Collapse Team Barometer'}
          >
            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Barometer Cards Body */}
      {!isCollapsed && (
        <div className="pt-3">
          <div className="flex items-stretch gap-2.5 overflow-x-auto pb-1.5 scrollbar-thin">
            {/* "All Members" Overview Card (shown in ProjectDetail, hidden in DashboardSummary) */}
            {shouldShowAllTeamCard && (
              <button
                type="button"
                id="barometer-member-all"
                onClick={() => onSelectMember('all')}
                className={`group shrink-0 w-48 sm:w-52 rounded-xl p-2.5 border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  selectedMemberId === 'all'
                    ? 'bg-blue-50/90 dark:bg-blue-950/60 border-blue-400 dark:border-blue-500 ring-2 ring-blue-300/40 dark:ring-blue-800/60 shadow-xs'
                    : 'bg-white/60 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-700/60 hover:bg-white dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1.5 mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold text-xs flex items-center justify-center">
                        <Users className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white leading-none">
                          All Team
                        </div>
                        <span className="text-3xs text-slate-500 dark:text-slate-400">
                          {effectiveTeam.length} Members
                        </span>
                      </div>
                    </div>

                    {selectedMemberId === 'all' ? (
                      <span className="text-3xs font-bold px-1.5 py-0.5 rounded bg-blue-600 text-white shadow-2xs">
                        Active
                      </span>
                    ) : (
                      <span className="text-3xs text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        Filter &rarr;
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-2xs pt-1">
                    <span className="text-slate-500 dark:text-slate-400">Total Active:</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {teamOverview.totalActive} tasks
                    </span>
                  </div>
                </div>

                {/* Progress Bar for Overall Team Capacity */}
                <div className="mt-2.5 pt-2 border-t border-slate-100/90 dark:border-slate-700/50">
                  <div className="flex items-center justify-between text-3xs text-slate-500 dark:text-slate-400 mb-1 font-medium">
                    <span>Capacity Load</span>
                    <span>{teamOverview.overallUtilization}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        teamOverview.overallUtilization > 100
                          ? 'bg-rose-500'
                          : teamOverview.overallUtilization > 75
                          ? 'bg-amber-500'
                          : 'bg-blue-500'
                      }`}
                      style={{ width: `${Math.min(teamOverview.overallUtilization, 100)}%` }}
                    />
                  </div>
                </div>
              </button>
            )}

            {/* Individual Member Capacity Cards */}
            {memberWorkloadStats.map((stat) => {
              const {
                member,
                activeCount,
                completedCount,
                overdueCount,
                dueTodayCount,
                tierLabel,
                badgeCls,
                progressCls,
                percentage,
                isSelf,
              } = stat;

              const isSelected = selectedMemberId === member.id;

              return (
                <div
                  key={member.id}
                  id={`barometer-member-${member.id}`}
                  onClick={() => onSelectMember(isSelected ? 'all' : member.id)}
                  className={`group shrink-0 w-52 sm:w-56 rounded-xl p-2.5 border text-left transition-all cursor-pointer flex flex-col justify-between select-none relative ${
                    isSelected
                      ? 'bg-blue-50/90 dark:bg-blue-950/60 border-blue-400 dark:border-blue-500 ring-2 ring-blue-300/40 dark:ring-blue-800/60 shadow-xs'
                      : 'bg-white/60 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-700/60 hover:bg-white dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <div>
                    {/* Top: Avatar, Name, Tier Badge */}
                    <div className="flex items-start justify-between gap-1.5 mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        {member.avatar ? (
                          <img
                            src={member.avatar}
                            alt={member.name}
                            className="w-8 h-8 rounded-full object-cover shrink-0 ring-1 ring-slate-200 dark:ring-slate-700 shadow-2xs"
                          />
                        ) : (
                          <div
                            style={{ backgroundColor: member.color || '#2563eb' }}
                            className="w-8 h-8 rounded-full text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs"
                          >
                            {member.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 dark:text-white truncate flex items-center gap-1">
                            <span>{member.name}</span>
                            {isSelf && (
                              <span className="text-3xs font-semibold text-blue-600 dark:text-blue-400">
                                (You)
                              </span>
                            )}
                          </div>
                          <p className="text-3xs text-slate-500 dark:text-slate-400 truncate">
                            {member.role || 'Team Member'}
                          </p>
                        </div>
                      </div>

                      {/* Tier Badge */}
                      <span
                        className={`text-3xs px-1.5 py-0.5 rounded-md font-bold border shrink-0 ${badgeCls}`}
                      >
                        {tierLabel}
                      </span>
                    </div>

                    {/* Active vs Capacity Metric */}
                    <div className="flex items-baseline justify-between mt-2">
                      <div className="flex items-baseline gap-1">
                        <span className="text-base font-extrabold text-slate-900 dark:text-white leading-none">
                          {activeCount}
                        </span>
                        <span className="text-3xs text-slate-500 dark:text-slate-400">
                          / {DEFAULT_CAPACITY_LIMIT} active tasks
                        </span>
                      </div>
                      <span className="text-3xs font-semibold text-slate-400 dark:text-slate-500">
                        {completedCount} done
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mt-1.5">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${progressCls}`}
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Bottom: Urgency Alert & Quick Actions */}
                  <div className="pt-2 mt-2 border-t border-slate-100/90 dark:border-slate-700/50 flex items-center justify-between gap-1 text-3xs">
                    <div className="flex items-center gap-1 min-w-0">
                      {overdueCount > 0 ? (
                        <span className="font-bold text-rose-600 dark:text-rose-400 flex items-center gap-0.5 truncate">
                          <AlertCircle className="w-2.5 h-2.5 shrink-0" />
                          {overdueCount} overdue
                        </span>
                      ) : dueTodayCount > 0 ? (
                        <span className="font-bold text-amber-600 dark:text-amber-400 flex items-center gap-0.5 truncate">
                          <Flame className="w-2.5 h-2.5 shrink-0" />
                          {dueTodayCount} due today
                        </span>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500 truncate">
                          {isSelected ? 'Filtered' : 'Click to filter'}
                        </span>
                      )}
                    </div>

                    {/* Quick + Assign Button (Admin only) */}
                    {isAdmin && onOpenTaskModal && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenTaskModal(null, 'In Progress', member.id);
                        }}
                        className="p-1 rounded-md text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer shrink-0"
                        title={`Assign new deliverable to ${member.name}`}
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

