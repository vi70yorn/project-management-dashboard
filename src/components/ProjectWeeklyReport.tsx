import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  AlertOctagon,
  Copy,
  Check,
  FileSpreadsheet,
  ArrowRight,
  Sparkles,
  Send,
  Share2,
} from 'lucide-react';
import { Project, Task, TeamMember, StatusType } from '../types';
import { TelegramSettingsModal } from './TelegramSettingsModal';

interface ProjectWeeklyReportProps {
  projects: Project[];
  tasks: Task[];
  teamMembers: TeamMember[];
  onSelectProject: (projectId: string) => void;
  onShowToast?: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const ProjectWeeklyReport: React.FC<ProjectWeeklyReportProps> = ({
  projects,
  tasks,
  teamMembers,
  onSelectProject,
  onShowToast,
}) => {
  // -1 = Last Week (Mon-Fri), 0 = This Week (Mon-Fri)
  const [weekOffset, setWeekOffset] = useState<number>(-1);
  const [copied, setCopied] = useState<boolean>(false);
  const [isTelegramModalOpen, setIsTelegramModalOpen] = useState<boolean>(false);

  // Calculate Monday to Friday working week bounds
  const weekRange = useMemo(() => {
    const now = new Date();
    const day = now.getDay();
    const isoDay = day === 0 ? 7 : day; // Treat Sunday as day 7

    // Monday of selected week
    const monday = new Date(now);
    monday.setDate(now.getDate() - (isoDay - 1) + weekOffset * 7);
    monday.setHours(0, 0, 0, 0);

    // Friday of selected week
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

  // Aggregate project statistics
  const projectSummaries = useMemo(() => {
    return projects.map((project) => {
      const pTasks = tasks.filter((t) => t.projectId === project.id);
      const total = pTasks.length;
      const completed = pTasks.filter((t) => t.status === 'Completed');
      const inProgress = pTasks.filter((t) => t.status === 'In Progress');
      const blocked = pTasks.filter((t) => t.status === 'Blocked');
      const pending = pTasks.filter((t) => t.status === 'Pending');

      const percent = total > 0 ? Math.round((completed.length / total) * 100) : 0;

      // Completed deliverables
      const completedList = completed.map((t) => ({
        ...t,
        assigneeName: teamMembers.find((m) => m.id === t.assigneeId)?.name || 'Unassigned',
      }));

      // In progress / ongoing deliverables
      const ongoingList = [...inProgress, ...blocked, ...pending].map((t) => ({
        ...t,
        assigneeName: teamMembers.find((m) => m.id === t.assigneeId)?.name || 'Unassigned',
      }));

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
        completedList,
        ongoingList,
        assignedMembers,
      };
    });
  }, [projects, tasks, teamMembers]);

  // Overall KPI metrics
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

  // Ultra-simple, easy-to-understand PM report text
  const generateSimplePMReport = (): string => {
    const lines = [
      `📊 WEEKLY PROJECT REPORT (${weekRange.label}, Mon-Fri)`,
      `Summary: ${overallMetrics.overallRate}% Complete | ${overallMetrics.totalCompleted}/${overallMetrics.totalTasks} Tasks Done | ${overallMetrics.totalBlocked} Blocked`,
      ``,
    ];

    projectSummaries.forEach((ps, idx) => {
      const p = ps.project;
      lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      lines.push(`${idx + 1}. ${p.name.toUpperCase()} (Client: ${p.client || 'Internal'})`);
      lines.push(`   • Status: ${p.status}`);
      lines.push(`   • Completion: ${ps.percent}% (${ps.completedCount}/${ps.totalTasks} Tasks Completed)`);

      if (ps.assignedMembers.length > 0) {
        lines.push(`   • Team: ${ps.assignedMembers.map((m) => m.name).join(', ')}`);
      }

      if (ps.completedList.length > 0) {
        lines.push(`   • Done:`);
        ps.completedList.forEach((t) => {
          lines.push(`     ✅ ${t.title} (${t.assigneeName})`);
        });
      }

      if (ps.ongoingList.length > 0) {
        lines.push(`   • Ongoing:`);
        ps.ongoingList.forEach((t) => {
          const statusIcon = t.status === 'Blocked' ? '⚠️' : '⏳';
          lines.push(`     ${statusIcon} ${t.title} [${t.status}] (${t.assigneeName})`);
        });
      }
    });

    lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    lines.push(`Report generated from Project Management Dashboard.`);

    return lines.join('\n');
  };

  const handleCopyReport = () => {
    const text = generateSimplePMReport();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
    if (onShowToast) {
      onShowToast('success', 'Simple Report copied! Ready to send to your Project Manager.');
    }
  };

  const handleExportExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      // -------------------------------------------------------------
      // SHEET 1: Executive Project Summary (PM Overview)
      // -------------------------------------------------------------
      const summaryData: (string | number)[][] = [
        ['PROJECT MANAGEMENT DASHBOARD - WEEKLY SUMMARY REPORT'],
        [`Working Week Period: ${weekRange.label} (Monday – Friday)`],
        [`Generated On: ${new Date().toLocaleString()}`],
        [], // spacing
        ['EXECUTIVE KPI METRICS'],
        ['Metric', 'Value', 'Details'],
        ['Overall Completion Rate', `${overallMetrics.overallRate}%`, `${overallMetrics.totalCompleted} of ${overallMetrics.totalTasks} deliverables done`],
        ['Total Projects', overallMetrics.totalProjects, `${overallMetrics.completedProjects} Completed, ${overallMetrics.inProgressProjects} In Progress, ${overallMetrics.blockedProjects} Blocked`],
        ['Total Tasks Deliverables', overallMetrics.totalTasks, `${overallMetrics.totalCompleted} Finished, ${overallMetrics.totalBlocked} Blocked`],
        ['Roadblocks / Blocked Tasks', overallMetrics.totalBlocked, overallMetrics.totalBlocked > 0 ? 'Requires immediate PM escalation' : 'No blockers identified'],
        [], // spacing
        ['PROJECT STATUS & PROGRESS BREAKDOWN'],
        [
          'No.',
          'Project Name',
          'Client / Category',
          'Status',
          'Completion (%)',
          'Completed Tasks',
          'Ongoing Tasks',
          'Blocked Tasks',
          'Total Tasks',
          'Target Deadline',
          'Assigned Team Members',
        ],
      ];

      projectSummaries.forEach((ps, idx) => {
        const p = ps.project;
        summaryData.push([
          idx + 1,
          p.name,
          p.client || 'Internal',
          p.status,
          `${ps.percent}%`,
          ps.completedCount,
          ps.inProgressCount + ps.pendingCount,
          ps.blockedCount,
          ps.totalTasks,
          p.targetDeadline || 'N/A',
          ps.assignedMembers.map((m) => m.name).join(', ') || 'Unassigned',
        ]);
      });

      const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);

      // Explicit, generous column widths for perfect readability
      wsSummary['!cols'] = [
        { wch: 6 },  // No.
        { wch: 28 }, // Project Name
        { wch: 20 }, // Client
        { wch: 15 }, // Status
        { wch: 16 }, // Completion (%)
        { wch: 16 }, // Completed Tasks
        { wch: 15 }, // Ongoing Tasks
        { wch: 15 }, // Blocked Tasks
        { wch: 14 }, // Total Tasks
        { wch: 18 }, // Target Deadline
        { wch: 36 }, // Assigned Team Members
      ];

      XLSX.utils.book_append_sheet(wb, wsSummary, 'Project Summary');

      // -------------------------------------------------------------
      // SHEET 2: Deliverables & Tasks Breakdown (Detailed)
      // -------------------------------------------------------------
      const taskData: (string | number)[][] = [
        ['DELIVERABLES & TASKS BREAKDOWN'],
        [`Working Week Period: ${weekRange.label}`],
        [],
        [
          'No.',
          'Project Name',
          'Task / Deliverable Title',
          'Status',
          'Priority',
          'Assignee',
          'Start Date',
          'Due Date',
          'Description',
        ],
      ];

      let taskIndex = 1;
      projects.forEach((proj) => {
        const projTasks = tasks.filter((t) => t.projectId === proj.id);
        projTasks.forEach((t) => {
          const assignee = teamMembers.find((m) => m.id === t.assigneeId)?.name || 'Unassigned';
          taskData.push([
            taskIndex++,
            proj.name,
            t.title,
            t.status,
            t.priority,
            assignee,
            t.startDate || '-',
            t.dueDate || '-',
            t.description || '',
          ]);
        });
      });

      const wsTasks = XLSX.utils.aoa_to_sheet(taskData);

      wsTasks['!cols'] = [
        { wch: 6 },  // No.
        { wch: 26 }, // Project Name
        { wch: 32 }, // Task Title
        { wch: 15 }, // Status
        { wch: 12 }, // Priority
        { wch: 22 }, // Assignee
        { wch: 14 }, // Start Date
        { wch: 14 }, // Due Date
        { wch: 45 }, // Description
      ];

      XLSX.utils.book_append_sheet(wb, wsTasks, 'All Deliverables');

      // File download
      const fileName = `Weekly_Project_Summary_${weekRange.mondayStr}_to_${weekRange.fridayStr}.xlsx`;
      XLSX.writeFile(wb, fileName);

      if (onShowToast) {
        onShowToast('success', `Excel report "${fileName}" downloaded successfully!`);
      }
    } catch (err: any) {
      console.error('Export Excel failed:', err);
      if (onShowToast) {
        onShowToast('error', 'Failed to export Excel report.');
      }
    }
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
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* Top Header & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                Project Weekly Summary
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Simple executive overview of project statuses & complete percentages (Mon – Fri)
              </p>
            </div>
          </div>
        </div>

        {/* Week Selector & Stepper Controls */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Week selector toggles */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setWeekOffset(-1)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                weekRange.isLastWeek
                  ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Last Week
            </button>
            <button
              onClick={() => setWeekOffset(0)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                weekRange.isThisWeek
                  ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              This Week
            </button>
          </div>

          {/* Stepper navigator */}
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/80 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200">
            <button
              onClick={() => setWeekOffset((p) => p - 1)}
              className="p-1 text-slate-400 hover:text-slate-800 dark:hover:text-white rounded hover:bg-slate-200/60 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              title="Previous Week"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <div className="flex items-center gap-1.5 px-1">
              <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>{weekRange.label}</span>
            </div>
            <button
              onClick={() => setWeekOffset((p) => p + 1)}
              className="p-1 text-slate-400 hover:text-slate-800 dark:hover:text-white rounded hover:bg-slate-200/60 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              title="Next Week"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Dedicated Actions & Export Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                Report Actions & Distribution
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Download spreadsheet, configure automated Telegram, or copy quick PM summary
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Export Excel Button */}
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors cursor-pointer shadow-2xs"
            title="Export Weekly Report to Excel (.xlsx)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Export Excel</span>
          </button>

          {/* Telegram Auto-Report Button */}
          <button
            onClick={() => setIsTelegramModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 hover:bg-sky-100 dark:hover:bg-sky-900/60 transition-colors cursor-pointer shadow-2xs"
            title="Configure Telegram Weekly Auto-Report"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Telegram Auto-Report</span>
          </button>

          {/* Copy Report to PM Button */}
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
                Copy Report
              </>
            )}
          </button>
        </div>
      </div>

      {/* 4 Simple KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-2xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Overall Completion
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {overallMetrics.overallRate}%
            </span>
            <span className="text-2xs font-medium text-slate-500 dark:text-slate-400">
              ({overallMetrics.totalCompleted} / {overallMetrics.totalTasks} Tasks)
            </span>
          </div>
          <div className="mt-2.5 w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className="bg-blue-600 h-full rounded-full transition-all duration-500"
              style={{ width: `${overallMetrics.overallRate}%` }}
            />
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-2xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Total Projects
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {overallMetrics.totalProjects}
            </span>
            <span className="text-2xs font-medium text-emerald-600 dark:text-emerald-400">
              {overallMetrics.completedProjects} Completed
            </span>
          </div>
          <p className="mt-2 text-3xs text-slate-500 dark:text-slate-400">
            {overallMetrics.inProgressProjects} In Progress • {overallMetrics.blockedProjects} Blocked
          </p>
        </div>

        <div className="p-4 bg-emerald-50/70 dark:bg-emerald-950/30 rounded-xl border border-emerald-200/80 dark:border-emerald-900/60 shadow-2xs">
          <span className="text-2xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
            Tasks Completed
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-700 dark:text-emerald-300">
              {overallMetrics.totalCompleted}
            </span>
            <span className="text-2xs font-semibold text-emerald-600 dark:text-emerald-400">
              Done
            </span>
          </div>
          <p className="mt-2 text-3xs text-emerald-600/80 dark:text-emerald-400/80">
            Deliverables completed for review
          </p>
        </div>

        <div
          className={`p-4 rounded-xl border shadow-2xs ${
            overallMetrics.totalBlocked > 0
              ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
          }`}
        >
          <span
            className={`text-2xs font-semibold uppercase tracking-wider ${
              overallMetrics.totalBlocked > 0
                ? 'text-rose-700 dark:text-rose-400'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            Blocked Items
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span
              className={`text-2xl font-black ${
                overallMetrics.totalBlocked > 0
                  ? 'text-rose-700 dark:text-rose-300'
                  : 'text-slate-900 dark:text-white'
              }`}
            >
              {overallMetrics.totalBlocked}
            </span>
            <span
              className={`text-2xs font-semibold ${
                overallMetrics.totalBlocked > 0
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {overallMetrics.totalBlocked > 0 ? 'Need Escalation' : 'All Clear'}
            </span>
          </div>
          <p
            className={`mt-2 text-3xs ${
              overallMetrics.totalBlocked > 0
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {overallMetrics.totalBlocked > 0 ? 'Action required by PM' : 'No blockers reported'}
          </p>
        </div>
      </div>

      {/* Simple Project Reports Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
            Projects Overview ({projectSummaries.length})
          </h3>
          <span className="text-2xs text-slate-500 dark:text-slate-400">
            Working Week: {weekRange.label} (Mon - Fri)
          </span>
        </div>

        {projectSummaries.length === 0 ? (
          <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-500 text-xs">
            No projects found in the system.
          </div>
        ) : (
          projectSummaries.map(({ project, totalTasks, completedCount, percent, completedList, ongoingList, assignedMembers }) => (
            <div
              key={project.id}
              className="p-5 sm:p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs hover:shadow-xs transition-all"
            >
              {/* Project Title, Client, Status & Completion Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded-full ring-2 ring-white dark:ring-slate-900 shadow-xs shrink-0"
                    style={{ backgroundColor: project.color || '#2563eb' }}
                  />
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                        {project.name}
                      </h4>
                      {project.client && (
                        <span className="px-2 py-0.5 rounded-md text-2xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {project.client}
                        </span>
                      )}
                    </div>
                    <p className="text-2xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Deadline: {project.targetDeadline || 'No deadline'} • Team:{' '}
                      {assignedMembers.length > 0
                        ? assignedMembers.map((m) => m.name).join(', ')
                        : 'Unassigned'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-start sm:self-center">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusBadge(
                      project.status
                    )}`}
                  >
                    {project.status}
                  </span>
                  <div className="text-right">
                    <span className="text-base font-black text-slate-900 dark:text-white">
                      {percent}%
                    </span>
                    <p className="text-3xs text-slate-400 dark:text-slate-500">
                      {completedCount}/{totalTasks} Tasks
                    </p>
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mt-4">
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
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

              {/* Simple 2-Column Task Breakdown: Completed vs Ongoing */}
              <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {/* Completed Tasks */}
                <div className="p-3.5 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-100 dark:border-emerald-900/40">
                  <div className="flex items-center justify-between text-2xs font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider mb-2.5">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>Completed Tasks ({completedList.length})</span>
                    </div>
                  </div>
                  {completedList.length === 0 ? (
                    <p className="text-3xs text-slate-400 italic">No tasks completed yet.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {completedList.map((t) => (
                        <li
                          key={t.id}
                          className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-white/80 dark:bg-slate-900/60 border border-emerald-100/60 dark:border-emerald-900/30 gap-2"
                        >
                          <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                            ✓ {t.title}
                          </span>
                          <span className="text-2xs text-slate-500 dark:text-slate-400 shrink-0 font-medium">
                            {t.assigneeName}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Ongoing Tasks */}
                <div className="p-3.5 bg-slate-50/80 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-800">
                  <div className="flex items-center justify-between text-2xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2.5">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span>Ongoing Tasks ({ongoingList.length})</span>
                    </div>
                  </div>
                  {ongoingList.length === 0 ? (
                    <p className="text-3xs text-emerald-600 dark:text-emerald-400 font-medium">
                      All tasks in this project are completed! 🎉
                    </p>
                  ) : (
                    <ul className="space-y-1.5">
                      {ongoingList.map((t) => (
                        <li
                          key={t.id}
                          className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-700 gap-2"
                        >
                          <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                            {t.title}
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span
                              className={`px-1.5 py-0.2 rounded text-3xs font-semibold ${
                                t.status === 'Blocked'
                                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                  : 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                              }`}
                            >
                              {t.status}
                            </span>
                            <span className="text-3xs text-slate-500 dark:text-slate-400">
                              {t.assigneeName}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Bottom Quick Jump Link */}
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end">
                <button
                  onClick={() => onSelectProject(project.id)}
                  className="inline-flex items-center gap-1 text-2xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  <span>Open Kanban Board</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Telegram Automation Settings Modal */}
      <TelegramSettingsModal
        isOpen={isTelegramModalOpen}
        onClose={() => setIsTelegramModalOpen(false)}
        onShowToast={onShowToast}
      />
    </div>
  );
};

