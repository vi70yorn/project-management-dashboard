import React, { useState, useMemo } from 'react';
import {
  X,
  Calendar,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  AlertOctagon,
  Copy,
  Check,
  Printer,
  TrendingUp,
  FolderKanban,
  ListTodo,
  Users,
  Briefcase,
  FileSpreadsheet,
} from 'lucide-react';
import { Project, Task, TeamMember, StatusType } from '../types';

interface ProjectWeeklySummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  tasks: Task[];
  teamMembers: TeamMember[];
  onShowToast?: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const ProjectWeeklySummaryModal: React.FC<ProjectWeeklySummaryModalProps> = ({
  isOpen,
  onClose,
  projects,
  tasks,
  teamMembers,
  onShowToast,
}) => {
  // -1 = Last Week (Mon-Fri), 0 = This Week (Mon-Fri), etc.
  const [weekOffset, setWeekOffset] = useState<number>(-1);
  const [copied, setCopied] = useState<boolean>(false);

  // Compute Monday to Friday working week bounds for the given offset
  const weekRange = useMemo(() => {
    const now = new Date();
    const day = now.getDay();
    const isoDay = day === 0 ? 7 : day; // Treat Sunday as day 7

    // Monday of the selected week (00:00:00.000)
    const monday = new Date(now);
    monday.setDate(now.getDate() - (isoDay - 1) + weekOffset * 7);
    monday.setHours(0, 0, 0, 0);

    // Friday of the selected week (23:59:59.999)
    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);
    friday.setHours(23, 59, 59, 999);

    const formatShort = (d: Date) =>
      d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    return {
      monday,
      friday,
      label: `${formatShort(monday)} – ${formatShort(friday)}`,
      mondayStr: monday.toISOString().split('T')[0],
      fridayStr: friday.toISOString().split('T')[0],
      isLastWeek: weekOffset === -1,
      isThisWeek: weekOffset === 0,
    };
  }, [weekOffset]);

  // Calculate per-project analytics
  const projectSummaries = useMemo(() => {
    return projects.map((project) => {
      const pTasks = tasks.filter((t) => t.projectId === project.id);
      const total = pTasks.length;
      const completed = pTasks.filter((t) => t.status === 'Completed');
      const inProgress = pTasks.filter((t) => t.status === 'In Progress');
      const blocked = pTasks.filter((t) => t.status === 'Blocked');
      const pending = pTasks.filter((t) => t.status === 'Pending');

      const percent = total > 0 ? Math.round((completed.length / total) * 100) : 0;

      // Tasks completed or active during this working week (Monday - Friday)
      const completedInWeek = completed.filter((t) => {
        if (!t.updatedAt && !t.createdAt) return true;
        const taskDate = new Date(t.updatedAt || t.createdAt);
        return taskDate >= weekRange.monday && taskDate <= weekRange.friday;
      });

      // Tasks due or worked on in this week
      const dueInWeek = pTasks.filter((t) => {
        if (!t.dueDate) return false;
        return t.dueDate >= weekRange.mondayStr && t.dueDate <= weekRange.fridayStr;
      });

      // Assigned member names
      const assignedMembers = teamMembers.filter((m) =>
        project.memberIds?.includes(m.id) || project.managerId === m.id
      );

      return {
        project,
        totalTasks: total,
        completedCount: completed.length,
        inProgressCount: inProgress.length,
        blockedCount: blocked.length,
        pendingCount: pending.length,
        percent,
        completedInWeek: completedInWeek.length > 0 ? completedInWeek : completed,
        ongoingTasks: [...inProgress, ...blocked, ...pending],
        blockedTasks: blocked,
        assignedMembers,
      };
    });
  }, [projects, tasks, teamMembers, weekRange]);

  // Overall aggregate metrics across all projects
  const overallMetrics = useMemo(() => {
    const totalProjects = projects.length;
    const completedProjects = projects.filter((p) => p.status === 'Completed').length;
    const inProgressProjects = projects.filter((p) => p.status === 'In Progress').length;
    const blockedProjects = projects.filter((p) => p.status === 'Blocked').length;

    const totalTasks = tasks.length;
    const totalCompleted = tasks.filter((t) => t.status === 'Completed').length;
    const totalBlocked = tasks.filter((t) => t.status === 'Blocked').length;
    const overallRate = totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0;

    return {
      totalProjects,
      completedProjects,
      inProgressProjects,
      blockedProjects,
      totalTasks,
      totalCompleted,
      totalBlocked,
      overallRate,
    };
  }, [projects, tasks]);

  if (!isOpen) return null;

  // Build a formatted copyable text report for the Project Manager
  const generatePMReportText = (): string => {
    const header = [
      `==================================================`,
      `📊 WEEKLY PROJECT STATUS REPORT`,
      `📅 Working Week: ${weekRange.label} (Mon - Fri)`,
      `👥 Team: UX/UI Design & Development Team`,
      `==================================================`,
      ``,
      `🎯 EXECUTIVE SUMMARY:`,
      `• Total Projects: ${overallMetrics.totalProjects} (${overallMetrics.completedProjects} Completed, ${overallMetrics.inProgressProjects} In Progress, ${overallMetrics.blockedProjects} Blocked)`,
      `• Overall Task Completion: ${overallMetrics.overallRate}% (${overallMetrics.totalCompleted}/${overallMetrics.totalTasks} Tasks)`,
      `• Blocked Items Requiring Escalation: ${overallMetrics.totalBlocked}`,
      ``,
      `--------------------------------------------------`,
      `📁 DETAILED PROJECT BREAKDOWN:`,
      `--------------------------------------------------`,
    ];

    const projectSections = projectSummaries.map((ps, idx) => {
      const p = ps.project;
      const lines = [
        `${idx + 1}. [${p.status.toUpperCase()}] ${p.name} (Client: ${p.client || 'Internal'})`,
        `   • Progress: ${ps.percent}% (${ps.completedCount}/${ps.totalTasks} tasks complete)`,
        `   • Status: ${p.status} | Deadline: ${p.targetDeadline || 'TBD'}`,
      ];

      if (ps.assignedMembers.length > 0) {
        lines.push(`   • Team Members: ${ps.assignedMembers.map((m) => m.name).join(', ')}`);
      }

      if (ps.completedInWeek.length > 0) {
        lines.push(`   • Completed Deliverables:`);
        ps.completedInWeek.forEach((t) => {
          const assignee = teamMembers.find((m) => m.id === t.assigneeId)?.name || 'Unassigned';
          lines.push(`     ✅ ${t.title} (Assignee: ${assignee})`);
        });
      }

      if (ps.blockedTasks.length > 0) {
        lines.push(`   • ⚠️ Blocked Tasks (Attention Needed):`);
        ps.blockedTasks.forEach((t) => {
          const assignee = teamMembers.find((m) => m.id === t.assigneeId)?.name || 'Unassigned';
          lines.push(`     🛑 ${t.title} (Assignee: ${assignee} | Priority: ${t.priority})`);
        });
      }

      if (ps.ongoingTasks.length > 0 && ps.blockedTasks.length === 0) {
        lines.push(`   • Ongoing Next Steps:`);
        ps.ongoingTasks.slice(0, 3).forEach((t) => {
          const assignee = teamMembers.find((m) => m.id === t.assigneeId)?.name || 'Unassigned';
          lines.push(`     ⏳ ${t.title} [${t.status}] (Assignee: ${assignee})`);
        });
      }

      return lines.join('\n');
    });

    const footer = [
      ``,
      `--------------------------------------------------`,
      `Report generated automatically from Project Management Dashboard.`,
    ];

    return [...header, ...projectSections, ...footer].join('\n');
  };

  const handleCopyReport = () => {
    const text = generatePMReportText();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
    if (onShowToast) {
      onShowToast('success', 'Project Summary Report copied to clipboard for your PM!');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const getStatusBadge = (status: StatusType) => {
    switch (status) {
      case 'Completed':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800';
      case 'In Progress':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300 border-blue-300 dark:border-blue-800';
      case 'Blocked':
        return 'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 border-rose-300 dark:border-rose-800';
      default:
        return 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border-amber-300 dark:border-amber-800';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/90 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight">
                  Project Weekly Summary
                </h2>
                <span className="px-2 py-0.5 rounded-full text-3xs font-bold uppercase tracking-wider bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  Mon – Fri
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Full-week status & task completion report for Project Management
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Working Week Selector Bar */}
        <div className="px-6 py-3 bg-slate-100/70 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          {/* Quick preset buttons */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setWeekOffset(-1)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                weekRange.isLastWeek
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              Last Week (Previous)
            </button>
            <button
              onClick={() => setWeekOffset(0)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                weekRange.isThisWeek
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              This Week (Current)
            </button>
          </div>

          {/* Stepper navigator */}
          <div className="flex items-center gap-2 bg-white dark:bg-slate-800 px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 shadow-2xs">
            <button
              onClick={() => setWeekOffset((prev) => prev - 1)}
              className="p-1 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              title="Previous Week"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 px-1">
              <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>{weekRange.label}</span>
            </div>
            <button
              onClick={() => setWeekOffset((prev) => prev + 1)}
              className="p-1 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              title="Next Week"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Executive Overview KPI Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
              <span className="text-2xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Overall Progress
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900 dark:text-white">
                  {overallMetrics.overallRate}%
                </span>
                <span className="text-3xs text-emerald-600 dark:text-emerald-400 font-medium">
                  {overallMetrics.totalCompleted} / {overallMetrics.totalTasks} Tasks
                </span>
              </div>
              <div className="mt-2 w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-blue-600 h-full rounded-full transition-all duration-300"
                  style={{ width: `${overallMetrics.overallRate}%` }}
                />
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
              <span className="text-2xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Total Projects
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900 dark:text-white">
                  {overallMetrics.totalProjects}
                </span>
                <span className="text-3xs text-slate-500 dark:text-slate-400">
                  {overallMetrics.inProgressProjects} Active
                </span>
              </div>
              <p className="mt-2 text-3xs text-slate-500 dark:text-slate-400">
                {overallMetrics.completedProjects} Completed | {overallMetrics.blockedProjects} Blocked
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-900/60">
              <span className="text-2xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Completed Tasks
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                  {overallMetrics.totalCompleted}
                </span>
                <span className="text-3xs text-emerald-600 dark:text-emerald-400 font-medium">
                  Finished
                </span>
              </div>
              <p className="mt-2 text-3xs text-emerald-600/80 dark:text-emerald-400/80">
                Deliverables ready for review
              </p>
            </div>

            <div
              className={`p-3.5 rounded-xl border ${
                overallMetrics.totalBlocked > 0
                  ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900'
                  : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-800'
              }`}
            >
              <span
                className={`text-2xs font-semibold uppercase tracking-wider ${
                  overallMetrics.totalBlocked > 0
                    ? 'text-rose-700 dark:text-rose-400'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                Blocked Roadblocks
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span
                  className={`text-2xl font-bold ${
                    overallMetrics.totalBlocked > 0
                      ? 'text-rose-700 dark:text-rose-300'
                      : 'text-slate-900 dark:text-white'
                  }`}
                >
                  {overallMetrics.totalBlocked}
                </span>
                <span
                  className={`text-3xs font-medium ${
                    overallMetrics.totalBlocked > 0
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {overallMetrics.totalBlocked > 0 ? 'Action Needed' : 'All Clear'}
                </span>
              </div>
              <p
                className={`mt-2 text-3xs ${
                  overallMetrics.totalBlocked > 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {overallMetrics.totalBlocked > 0 ? 'Escalate to PM' : 'No blockers reported'}
              </p>
            </div>
          </div>

          {/* Project Cards Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Project Progress & Deliverables ({projectSummaries.length})
              </h3>
              <span className="text-3xs text-slate-400 dark:text-slate-500">
                Period: {weekRange.mondayStr} to {weekRange.fridayStr}
              </span>
            </div>

            {projectSummaries.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-500 text-xs">
                No active projects found in this workspace.
              </div>
            ) : (
              projectSummaries.map(({ project, totalTasks, completedCount, inProgressCount, blockedCount, percent, completedInWeek, ongoingTasks, assignedMembers }) => (
                <div
                  key={project.id}
                  className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition-all"
                >
                  {/* Project Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3.5 h-3.5 rounded-full ring-2 ring-white dark:ring-slate-900 shadow-2xs shrink-0"
                        style={{ backgroundColor: project.color || '#2563eb' }}
                      />
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                          {project.name}
                        </h4>
                        <div className="flex items-center gap-2 mt-0.5 text-2xs text-slate-500 dark:text-slate-400">
                          {project.client && (
                            <span className="font-medium text-slate-700 dark:text-slate-300">
                              Client: {project.client}
                            </span>
                          )}
                          <span>•</span>
                          <span>Deadline: {project.targetDeadline || 'No deadline'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-center">
                      <span
                        className={`px-2.5 py-0.8 rounded-full text-2xs font-bold border ${getStatusBadge(
                          project.status
                        )}`}
                      >
                        {project.status}
                      </span>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {percent}% Done
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-2xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                      <span>Task Completion Rate</span>
                      <span>
                        {completedCount} of {totalTasks} tasks completed ({percent}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden p-0.5 border border-slate-200/60 dark:border-slate-700/60">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          percent === 100
                            ? 'bg-emerald-500'
                            : percent >= 50
                            ? 'bg-blue-600'
                            : 'bg-amber-500'
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>

                  {/* Task counts pill summary */}
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-3xs font-semibold">
                    <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      ✓ {completedCount} Completed
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                      ⏳ {inProgressCount} In Progress
                    </span>
                    {blockedCount > 0 && (
                      <span className="px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                        ⚠️ {blockedCount} Blocked
                      </span>
                    )}
                    {assignedMembers.length > 0 && (
                      <span className="ml-auto text-slate-500 dark:text-slate-400 font-normal">
                        Team: {assignedMembers.map((m) => m.name).join(', ')}
                      </span>
                    )}
                  </div>

                  {/* Deliverables lists */}
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Completed Deliverables */}
                    <div className="bg-slate-50/80 dark:bg-slate-800/40 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-1.5 text-2xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider mb-2">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Completed Deliverables ({completedInWeek.length})</span>
                      </div>
                      {completedInWeek.length === 0 ? (
                        <p className="text-3xs text-slate-400 italic">No tasks completed yet.</p>
                      ) : (
                        <ul className="space-y-1.5">
                          {completedInWeek.map((t) => {
                            const assignee =
                              teamMembers.find((m) => m.id === t.assigneeId)?.name || 'Unassigned';
                            return (
                              <li
                                key={t.id}
                                className="flex items-start justify-between text-2xs gap-2"
                              >
                                <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                                  • {t.title}
                                </span>
                                <span className="text-3xs text-slate-500 dark:text-slate-400 shrink-0">
                                  {assignee}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>

                    {/* Ongoing Tasks / Next Steps */}
                    <div className="bg-slate-50/80 dark:bg-slate-800/40 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-1.5 text-2xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider mb-2">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Ongoing Deliverables ({ongoingTasks.length})</span>
                      </div>
                      {ongoingTasks.length === 0 ? (
                        <p className="text-3xs text-slate-400 italic">All deliverables completed!</p>
                      ) : (
                        <ul className="space-y-1.5">
                          {ongoingTasks.slice(0, 4).map((t) => {
                            const assignee =
                              teamMembers.find((m) => m.id === t.assigneeId)?.name || 'Unassigned';
                            return (
                              <li
                                key={t.id}
                                className="flex items-start justify-between text-2xs gap-2"
                              >
                                <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                                  • {t.title}
                                </span>
                                <span className="text-3xs font-semibold px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 shrink-0">
                                  {t.status}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50/80 dark:bg-slate-900/90">
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <span>Ready to submit report for working week</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {weekRange.label}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer shadow-2xs"
            >
              <Printer className="w-3.5 h-3.5" />
              Print / PDF
            </button>

            <button
              onClick={handleCopyReport}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer ${
                copied
                  ? 'bg-emerald-600 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  Report Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy Report for PM
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

