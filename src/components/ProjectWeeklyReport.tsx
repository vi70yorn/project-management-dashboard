import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
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
  Table as TableIcon,
  LayoutGrid,
  Search,
  X,
} from 'lucide-react';
import { Project, Task, TeamMember, StatusType } from '../types';
import { TelegramSettingsModal } from './TelegramSettingsModal';
import { StatusBadge, PriorityBadge, getStatusBadgeClass, getPriorityBadgeClass } from './Badges';

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
  const [weekOffset, setWeekOffset] = useState<number>(-1);
  const [copied, setCopied] = useState<boolean>(false);
  const [isTelegramModalOpen, setIsTelegramModalOpen] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');
  const [expandedProjectIds, setExpandedProjectIds] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('All');

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
      const completedList = completed.map((t) => {
        const mem = teamMembers.find((m) => m.id === t.assigneeId);
        return {
          ...t,
          assigneeName: mem?.name || 'Unassigned',
          assigneeAvatar: mem?.avatar,
          assigneeColor: mem?.color,
        };
      });

      // In progress / ongoing deliverables
      const ongoingList = [...inProgress, ...blocked, ...pending].map((t) => {
        const mem = teamMembers.find((m) => m.id === t.assigneeId);
        return {
          ...t,
          assigneeName: mem?.name || 'Unassigned',
          assigneeAvatar: mem?.avatar,
          assigneeColor: mem?.color,
        };
      });

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

  // Filtered summaries according to search & status filter
  const filteredProjectSummaries = useMemo(() => {
    return projectSummaries.filter((ps) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        ps.project.name.toLowerCase().includes(q) ||
        (ps.project.client && ps.project.client.toLowerCase().includes(q)) ||
        ps.assignedMembers.some((m) => m.name.toLowerCase().includes(q));

      const matchesStatus = statusFilter === 'All' || ps.project.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [projectSummaries, searchQuery, statusFilter]);

  const toggleProjectExpanded = (projectId: string) => {
    setExpandedProjectIds((prev) => ({
      ...prev,
      [projectId]: !prev[projectId],
    }));
  };

  const toggleExpandAll = () => {
    const allExpanded = filteredProjectSummaries.every((ps) => expandedProjectIds[ps.project.id]);
    if (allExpanded) {
      setExpandedProjectIds({});
    } else {
      const next: Record<string, boolean> = {};
      filteredProjectSummaries.forEach((ps) => {
        next[ps.project.id] = true;
      });
      setExpandedProjectIds(next);
    }
  };

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

  const getStatusBadge = (status: StatusType) => getStatusBadgeClass(status, 'sm');

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

      {/* Projects Overview Section */}
      <div className="space-y-4">
        {/* Header & Controls Toolbar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                Projects Overview ({filteredProjectSummaries.length})
              </h3>
              {filteredProjectSummaries.length !== projectSummaries.length && (
                <span className="text-3xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                  Filtered from {projectSummaries.length}
                </span>
              )}
            </div>
            <p className="text-2xs text-slate-500 dark:text-slate-400 mt-0.5">
              Working Week: {weekRange.label} (Monday – Friday)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            {/* Search Input */}
           {/*  <div className="relative min-w-[170px] sm:min-w-[210px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search projects, client, team..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-7 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div> */}

            {/* Status Filters */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
              {(['All', 'In Progress', 'Completed', 'Blocked'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    statusFilter === st
                      ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-2xs font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            {/* Expand / Collapse All (in Table view) */}
            {viewMode === 'table' && (
              <button
                onClick={toggleExpandAll}
                className="px-2.5 py-1.5 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border border-slate-200 dark:border-slate-800 cursor-pointer shadow-2xs"
                title="Expand or collapse deliverable details"
              >
                {filteredProjectSummaries.length > 0 &&
                filteredProjectSummaries.every((ps) => expandedProjectIds[ps.project.id])
                  ? 'Collapse All'
                  : 'Expand All'}
              </button>
            )}

            {/* View Mode Toggle: Table (default) vs Cards */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Table View (Compact Overview)"
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Table</span>
              </button>
              <button
                onClick={() => setViewMode('card')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  viewMode === 'card'
                    ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Card View"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Cards</span>
              </button>
            </div>
          </div>
        </div>

        {/* Content Section */}
        {filteredProjectSummaries.length === 0 ? (
          <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-500 text-xs shadow-2xs">
            <p className="font-semibold text-sm text-slate-700 dark:text-slate-300">
              No matching projects found
            </p>
            <p className="text-slate-400 text-xs mt-1">
              Try adjusting your search query or status filter.
            </p>
          </div>
        ) : viewMode === 'table' ? (
          /* Table View */
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60 text-2xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-3 text-center w-12">#</th>
                    <th className="py-3 px-4 min-w-[210px]">Project</th>
                    <th className="py-3 px-4 min-w-[120px]">Status</th>
                    <th className="py-3 px-4 min-w-[140px]">Progress</th>
                    <th className="py-3 px-4 min-w-[240px]">Deliverables</th>
                    <th className="py-3 px-4 min-w-[120px]">Deadline</th>
                    <th className="py-3 px-4 min-w-[150px]">Team</th>
                    <th className="py-3 px-4 text-right min-w-[95px]">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {filteredProjectSummaries.map(
                    (
                      {
                        project,
                        totalTasks,
                        completedCount,
                        inProgressCount,
                        blockedCount,
                        pendingCount,
                        percent,
                        completedList,
                        ongoingList,
                        assignedMembers,
                      },
                      idx
                    ) => {
                      const isExpanded = !!expandedProjectIds[project.id];
                      return (
                        <React.Fragment key={project.id}>
                          <tr
                            onClick={() => toggleProjectExpanded(project.id)}
                            className={`group cursor-pointer transition-colors ${
                              isExpanded
                                ? 'bg-blue-50/40 dark:bg-blue-950/20'
                                : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/40'
                            }`}
                          >
                            {/* # and Expand icon */}
                            <td className="py-3.5 px-3 text-center">
                              <div className="flex items-center justify-center gap-1 text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                <span className="text-3xs font-bold text-slate-500 dark:text-slate-400">
                                  {idx + 1}
                                </span>
                                {isExpanded ? (
                                  <ChevronUp className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                                ) : (
                                  <ChevronDown className="w-3.5 h-3.5" />
                                )}
                              </div>
                            </td>

                            {/* Project Name & Client */}
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-2.5">
                                <span
                                  className="w-3.5 h-3.5 rounded-full shrink-0 shadow-2xs ring-2 ring-white dark:ring-slate-900"
                                  style={{ backgroundColor: project.color || '#2563eb' }}
                                />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                      {project.name}
                                    </span>
                                    {project.client && (
                                      <span className="px-1.5 py-0.2 rounded text-3xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                        {project.client}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Status */}
                            <td className="py-3.5 px-4">
                              <StatusBadge status={project.status} size="sm" />
                            </td>

                            {/* Progress */}
                            <td className="py-3.5 px-4">
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-2xs">
                                  <span className="font-black text-slate-800 dark:text-slate-200">
                                    {percent}%
                                  </span>
                                  <span className="text-3xs text-slate-400 dark:text-slate-500 font-medium">
                                    {completedCount}/{totalTasks}
                                  </span>
                                </div>
                                <div className="w-24 bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all duration-300 ${
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
                            </td>

                            {/* Deliverables Overview */}
                            <td className="py-3.5 px-4">
                              <div className="space-y-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {completedCount > 0 && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-3xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                      {completedCount} Done
                                    </span>
                                  )}
                                  {inProgressCount + pendingCount > 0 && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-3xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800">
                                      <Clock className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                                      {inProgressCount + pendingCount} Ongoing
                                    </span>
                                  )}
                                  {blockedCount > 0 && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-3xs font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200/60 dark:border-rose-800">
                                      <AlertOctagon className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                                      {blockedCount} Blocked
                                    </span>
                                  )}
                                  {totalTasks === 0 && (
                                    <span className="text-3xs text-slate-400 italic">No tasks</span>
                                  )}
                                </div>

                                <div className="text-3xs text-slate-500 dark:text-slate-400 truncate max-w-xs">
                                  {completedList.length > 0 && (
                                    <span className="text-emerald-700 dark:text-emerald-400">
                                      ✓ {completedList[0].title}
                                    </span>
                                  )}
                                  {completedList.length > 0 && ongoingList.length > 0 && (
                                    <span> • </span>
                                  )}
                                  {ongoingList.length > 0 && (
                                    <span>⏳ {ongoingList[0].title}</span>
                                  )}
                                  {completedList.length + ongoingList.length > 2 && (
                                    <span className="text-slate-400 font-medium">
                                      {' '}
                                      +{completedList.length + ongoingList.length - 2} more
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Deadline */}
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span>{project.targetDeadline || 'No deadline'}</span>
                              </div>
                            </td>

                            {/* Team */}
                            <td className="py-3.5 px-4">
                              {assignedMembers.length > 0 ? (
                                <div className="flex items-center gap-2">
                                  <div className="flex items-center -space-x-1.5 shrink-0">
                                    {assignedMembers.slice(0, 3).map((m) =>
                                      m.avatar ? (
                                        <img
                                          key={m.id}
                                          src={m.avatar}
                                          alt={m.name}
                                          title={`${m.name} (${m.role})`}
                                          className="w-5.5 h-5.5 rounded-full ring-2 ring-white dark:ring-slate-900 object-cover shrink-0 shadow-2xs"
                                        />
                                      ) : (
                                        <div
                                          key={m.id}
                                          title={`${m.name} (${m.role})`}
                                          style={{ backgroundColor: m.color || '#2563eb' }}
                                          className="w-5.5 h-5.5 rounded-full text-white text-3xs font-bold flex items-center justify-center ring-2 ring-white dark:ring-slate-900 shadow-2xs shrink-0"
                                        >
                                          {m.name.charAt(0).toUpperCase()}
                                        </div>
                                      )
                                    )}
                                    {assignedMembers.length > 3 && (
                                      <span
                                        className="w-5.5 h-5.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-3xs font-bold flex items-center justify-center ring-2 ring-white dark:ring-slate-900 shrink-0 shadow-2xs"
                                        title={assignedMembers.slice(3).map((m) => m.name).join(', ')}
                                      >
                                        +{assignedMembers.length - 3}
                                      </span>
                                    )}
                                  </div>
                                  <span
                                    className="text-xs text-slate-700 dark:text-slate-300 font-medium truncate max-w-[130px]"
                                    title={assignedMembers.map((m) => m.name).join(', ')}
                                  >
                                    {assignedMembers.map((m) => m.name).join(', ')}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-xs text-slate-400 italic">Unassigned</span>
                              )}
                            </td>

                            {/* Action */}
                            <td className="py-3.5 px-4 text-right">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSelectProject(project.id);
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200/50 dark:border-blue-900/40 transition-colors cursor-pointer"
                                title={`Open ${project.name} Kanban Board`}
                              >
                                <span>Board</span>
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            </td>
                          </tr>

                          {/* Expandable Task Detail Drawer */}
                          {isExpanded && (
                            <tr className="bg-slate-50/80 dark:bg-slate-800/80 border-b border-slate-200/80 dark:border-slate-800">
                              <td colSpan={8} className="py-4 px-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {/* Completed Deliverables List */}
                                  <div className="p-3.5 bg-emerald-50/60 dark:bg-emerald-950/20 rounded-xl border border-emerald-100 dark:border-emerald-900/40">
                                    <div className="flex items-center justify-between text-2xs font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider mb-2">
                                      <div className="flex items-center gap-1.5">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                        <span>Completed Tasks ({completedList.length})</span>
                                      </div>
                                    </div>
                                    {completedList.length === 0 ? (
                                      <p className="text-3xs text-slate-400 italic">
                                        No tasks completed yet.
                                      </p>
                                    ) : (
                                      <ul className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                        {completedList.map((t) => (
                                          <li
                                            key={t.id}
                                            className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-white dark:bg-slate-900 border border-emerald-100 dark:border-emerald-900/30 gap-2"
                                          >
                                            <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                                              ✓ {t.title}
                                            </span>
                                            <div className="flex items-center gap-1.5 shrink-0 text-3xs text-slate-500 dark:text-slate-400 font-medium bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                                              {t.assigneeAvatar ? (
                                                <img
                                                  src={t.assigneeAvatar}
                                                  alt={t.assigneeName}
                                                  className="w-3.5 h-3.5 rounded-full object-cover shrink-0"
                                                />
                                              ) : (
                                                <div
                                                  style={{ backgroundColor: t.assigneeColor || '#2563eb' }}
                                                  className="w-3.5 h-3.5 rounded-full text-white text-4xs font-bold flex items-center justify-center shrink-0"
                                                >
                                                  {t.assigneeName.charAt(0)}
                                                </div>
                                              )}
                                              <span>{t.assigneeName}</span>
                                            </div>
                                          </li>
                                        ))}
                                      </ul>
                                    )}
                                  </div>

                                  {/* Ongoing & Blocked Deliverables List */}
                                  <div className="p-3.5 bg-slate-100/60 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700">
                                    <div className="flex items-center justify-between text-2xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                                      <div className="flex items-center gap-1.5">
                                        <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                                        <span>Ongoing & Blocked Tasks ({ongoingList.length})</span>
                                      </div>
                                    </div>
                                    {ongoingList.length === 0 ? (
                                      <p className="text-3xs text-emerald-600 dark:text-emerald-400 font-medium">
                                        All tasks in this project are completed! 🎉
                                      </p>
                                    ) : (
                                      <ul className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                        {ongoingList.map((t) => (
                                          <li
                                            key={t.id}
                                            className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 gap-2"
                                          >
                                            <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                                              {t.title}
                                            </span>
                                            <div className="flex items-center gap-1.5 shrink-0">
                                              <StatusBadge status={t.status} size="xs" />
                                              <div className="flex items-center gap-1 text-3xs text-slate-500 dark:text-slate-400 font-medium bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                                                {t.assigneeAvatar ? (
                                                  <img
                                                    src={t.assigneeAvatar}
                                                    alt={t.assigneeName}
                                                    className="w-3.5 h-3.5 rounded-full object-cover shrink-0"
                                                  />
                                                ) : (
                                                  <div
                                                    style={{ backgroundColor: t.assigneeColor || '#2563eb' }}
                                                    className="w-3.5 h-3.5 rounded-full text-white text-4xs font-bold flex items-center justify-center shrink-0"
                                                  >
                                                    {t.assigneeName.charAt(0)}
                                                  </div>
                                                )}
                                                <span>{t.assigneeName}</span>
                                              </div>
                                            </div>
                                          </li>
                                        ))}
                                      </ul>
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Card View */
          filteredProjectSummaries.map(
            ({
              project,
              totalTasks,
              completedCount,
              percent,
              completedList,
              ongoingList,
              assignedMembers,
            }) => (
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
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-2xs text-slate-500 dark:text-slate-400">
                          Deadline: {project.targetDeadline || 'No deadline'}
                        </span>
                        {assignedMembers.length > 0 ? (
                          <>
                            <span className="text-slate-300 dark:text-slate-700">•</span>
                            <div className="flex items-center gap-1.5">
                              <div className="flex items-center -space-x-1.5 shrink-0">
                                {assignedMembers.slice(0, 4).map((m) =>
                                  m.avatar ? (
                                    <img
                                      key={m.id}
                                      src={m.avatar}
                                      alt={m.name}
                                      title={`${m.name} (${m.role})`}
                                      className="w-5 h-5 rounded-full ring-2 ring-white dark:ring-slate-900 object-cover shrink-0 shadow-2xs"
                                    />
                                  ) : (
                                    <div
                                      key={m.id}
                                      title={`${m.name} (${m.role})`}
                                      style={{ backgroundColor: m.color || '#2563eb' }}
                                      className="w-5 h-5 rounded-full text-white text-3xs font-bold flex items-center justify-center ring-2 ring-white dark:ring-slate-900 shadow-2xs shrink-0"
                                    >
                                      {m.name.charAt(0).toUpperCase()}
                                    </div>
                                  )
                                )}
                                {assignedMembers.length > 4 && (
                                  <span
                                    className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-3xs font-bold flex items-center justify-center ring-2 ring-white dark:ring-slate-900 shrink-0 shadow-2xs"
                                    title={assignedMembers.slice(4).map((m) => m.name).join(', ')}
                                  >
                                    +{assignedMembers.length - 4}
                                  </span>
                                )}
                              </div>
                              <span
                                className="text-2xs text-slate-700 dark:text-slate-300 font-medium truncate max-w-[180px]"
                                title={assignedMembers.map((m) => m.name).join(', ')}
                              >
                                {assignedMembers.map((m) => m.name).join(', ')}
                              </span>
                            </div>
                          </>
                        ) : (
                          <>
                            <span className="text-slate-300 dark:text-slate-700">•</span>
                            <span className="text-2xs text-slate-400 italic">Unassigned</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-start sm:self-center">
                    <StatusBadge status={project.status} size="sm" />
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
                            <div className="flex items-center gap-1 text-2xs text-slate-500 dark:text-slate-400 shrink-0 font-medium">
                              {t.assigneeAvatar ? (
                                <img
                                  src={t.assigneeAvatar}
                                  alt={t.assigneeName}
                                  className="w-3.5 h-3.5 rounded-full object-cover shrink-0"
                                />
                              ) : (
                                <div
                                  style={{ backgroundColor: t.assigneeColor || '#2563eb' }}
                                  className="w-3.5 h-3.5 rounded-full text-white text-4xs font-bold flex items-center justify-center shrink-0"
                                >
                                  {t.assigneeName.charAt(0)}
                                </div>
                              )}
                              <span>{t.assigneeName}</span>
                            </div>
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
                              <StatusBadge status={t.status} size="xs" />
                              <div className="flex items-center gap-1 text-3xs text-slate-500 dark:text-slate-400">
                                {t.assigneeAvatar ? (
                                  <img
                                    src={t.assigneeAvatar}
                                    alt={t.assigneeName}
                                    className="w-3.5 h-3.5 rounded-full object-cover shrink-0"
                                  />
                                ) : (
                                  <div
                                    style={{ backgroundColor: t.assigneeColor || '#2563eb' }}
                                    className="w-3.5 h-3.5 rounded-full text-white text-4xs font-bold flex items-center justify-center shrink-0"
                                  >
                                    {t.assigneeName.charAt(0)}
                                  </div>
                                )}
                                <span>{t.assigneeName}</span>
                              </div>
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
            )
          )
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

