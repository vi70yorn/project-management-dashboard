import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Printer,
  FileSpreadsheet,
  Download,
  FileText,
  CheckCircle2,
  Clock,
  AlertOctagon,
  Calendar,
  User,
  Building2,
  CheckSquare,
  Sparkles,
  Check,
  ChevronDown,
} from 'lucide-react';
import { Project, Task, TeamMember, StatusType, PriorityType } from '../types';

interface ProjectReportModalProps {
  project: Project;
  tasks: Task[];
  teamMembers: TeamMember[];
  isOpen: boolean;
  onClose: () => void;
  uiStyle?: 'glass' | 'normal' | 'nothing';
}

type ExportTab = 'pdf' | 'excel' | 'csv';

export const ProjectReportModal: React.FC<ProjectReportModalProps> = ({
  project,
  tasks,
  teamMembers,
  isOpen,
  onClose,
  uiStyle = 'normal',
}) => {
  const [activeTab, setActiveTab] = useState<ExportTab>('pdf');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [includeDoD, setIncludeDoD] = useState<boolean>(true);
  const [includeExecutiveNote, setIncludeExecutiveNote] = useState<boolean>(true);
  const [executiveNote, setExecutiveNote] = useState<string>(
    'All deliverables are tracked in accordance with project milestones and client specifications. Regular reviews ensure delivery on schedule.'
  );
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  // Synchronize document.title and body class for print isolation & default PDF filename
  useEffect(() => {
    if (!isOpen) return;

    const originalTitle = document.title;
    // Set document.title to the current project name so the browser's "Save as PDF" dialog
    // automatically defaults the suggested file name to the project name.
    const cleanProjectName = (project.name || 'Project').trim().replace(/[/\\?%*:|"<>]/g, '-');
    document.title = cleanProjectName;

    document.body.classList.add('report-modal-open');
    if (activeTab === 'pdf') {
      document.body.classList.add('report-modal-pdf-active');
    } else {
      document.body.classList.remove('report-modal-pdf-active');
    }

    return () => {
      document.title = originalTitle;
      document.body.classList.remove('report-modal-open');
      document.body.classList.remove('report-modal-pdf-active');
    };
  }, [isOpen, activeTab, project.name]);

  // Filter tasks belonging to this project
  const projectTasks = useMemo(() => {
    let list = tasks.filter((t) => t.projectId === project.id);
    if (statusFilter === 'completed') {
      list = list.filter((t) => t.status === 'Completed');
    } else if (statusFilter === 'in_progress') {
      list = list.filter((t) => t.status === 'In Progress' || t.status === 'Ready Review' || t.status === 'Pending');
    } else if (statusFilter === 'blocked') {
      list = list.filter((t) => t.status === 'Blocked');
    }
    return list;
  }, [tasks, project.id, statusFilter]);

  // Project manager
  const manager = useMemo(() => {
    return teamMembers.find((m) => m.id === project.managerId);
  }, [teamMembers, project.managerId]);

  // Project KPI statistics
  const stats = useMemo(() => {
    const all = tasks.filter((t) => t.projectId === project.id);
    const total = all.length;
    const completed = all.filter((t) => t.status === 'Completed').length;
    const inProgress = all.filter((t) => t.status === 'In Progress').length;
    const readyReview = all.filter((t) => t.status === 'Ready Review' || t.status === 'Pending').length;
    const blocked = all.filter((t) => t.status === 'Blocked').length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { total, completed, inProgress, readyReview, blocked, percent };
  }, [tasks, project.id]);

  if (!isOpen) return null;

  const cleanDate = new Date().toISOString().split('T')[0];
  const safeFilenameBase = (project.name || 'Project').replace(/[^a-z0-9_-]/gi, '_');

  // Trigger Browser Print / Save as PDF with clean document isolation & project file name
  const handlePrintPdf = () => {
    const cleanProjectName = (project.name || 'Project').trim().replace(/[/\\?%*:|"<>]/g, '-');
    document.title = cleanProjectName;
    setActiveTab('pdf');
    document.body.classList.add('report-modal-open');
    document.body.classList.add('report-modal-pdf-active');
    setTimeout(() => {
      window.print();
    }, 60);
  };

  // Export to Excel (.xlsx) using dynamic import of xlsx
  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();

      // Sheet 1: Project Overview
      const overviewData: (string | number)[][] = [
        ['PROJECT EXECUTIVE OVERVIEW'],
        ['Generated On', new Date().toLocaleString()],
        [],
        ['Property', 'Details'],
        ['Project Name', project.name],
        ['Client / Organization', project.client || 'Internal Initiative'],
        ['Overall Status', project.status],
        ['Project Lead / Manager', manager?.name || 'Unassigned'],
        ['Lead Email', manager?.email || 'N/A'],
        ['Start Date', project.startDate || 'N/A'],
        ['Target Deadline', project.targetDeadline || 'N/A'],
        ['Overall Progress', `${stats.percent}%`],
        ['Total Deliverables', stats.total],
        ['Completed Tasks', stats.completed],
        ['In Progress Tasks', stats.inProgress],
        ['Ready for Review Tasks', stats.readyReview],
        ['Blocked Tasks', stats.blocked],
        ['Tags', (project.tags || []).join(', ')],
        ['Executive Notes', executiveNote],
      ];

      const wsOverview = XLSX.utils.aoa_to_sheet(overviewData);
      wsOverview['!cols'] = [{ wch: 24 }, { wch: 48 }];
      XLSX.utils.book_append_sheet(wb, wsOverview, 'Overview');

      // Sheet 2: Tasks & Deliverables
      const taskHeaders = [
        'ID',
        'Title',
        'Status',
        'Priority',
        'Assignee',
        'Start Date',
        'Due Date',
        'Checklist (DoD)',
        'Description',
      ];

      const taskRows = projectTasks.map((t) => {
        const mem = teamMembers.find((m) => m.id === t.assigneeId);
        const subtasks = t.subtasks || [];
        const checklistSummary =
          subtasks.length > 0
            ? `${subtasks.filter((c) => c.completed).length}/${subtasks.length} done: ` +
              subtasks.map((c) => `${c.title} [${c.completed ? '✓' : '✗'}]`).join(', ')
            : 'None';

        return [
          t.id,
          t.title,
          t.status,
          t.priority,
          mem?.name || 'Unassigned',
          t.startDate || '',
          t.dueDate || '',
          checklistSummary,
          t.description || '',
        ];
      });

      const wsTasks = XLSX.utils.aoa_to_sheet([taskHeaders, ...taskRows]);
      wsTasks['!cols'] = [
        { wch: 18 },
        { wch: 32 },
        { wch: 14 },
        { wch: 12 },
        { wch: 20 },
        { wch: 14 },
        { wch: 14 },
        { wch: 36 },
        { wch: 40 },
      ];
      XLSX.utils.book_append_sheet(wb, wsTasks, 'Tasks & Deliverables');

      // Write and download file
      const filename = `${safeFilenameBase}_Executive_Report_${cleanDate}.xlsx`;
      XLSX.writeFile(wb, filename);

      setDownloadSuccess(`Downloaded ${filename}`);
      setTimeout(() => setDownloadSuccess(null), 4000);
    } catch (err) {
      console.error('Failed to export Excel:', err);
      alert('Failed to generate Excel file. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  // Export to CSV (.csv)
  const handleExportCsv = () => {
    setIsExporting(true);
    try {
      const headers = ['ID', 'Title', 'Status', 'Priority', 'Assignee', 'Start Date', 'Due Date', 'Checklist'];
      const rows = projectTasks.map((t) => {
        const mem = teamMembers.find((m) => m.id === t.assigneeId);
        const subtasks = t.subtasks || [];
        const checklistSummary =
          subtasks.length > 0
            ? `${subtasks.filter((c) => c.completed).length}/${subtasks.length} done`
            : '';

        return [
          t.id,
          t.title,
          t.status,
          t.priority,
          mem?.name || 'Unassigned',
          t.startDate || '',
          t.dueDate || '',
          checklistSummary,
        ];
      });

      const escapeCsv = (val: string) => `"${String(val || '').replace(/"/g, '""')}"`;
      const csvContent =
        '\uFEFF' +
        [headers, ...rows]
          .map((row) => row.map((cell) => escapeCsv(String(cell))).join(','))
          .join('\r\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const filename = `${safeFilenameBase}_Tasks_${cleanDate}.csv`;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setDownloadSuccess(`Downloaded ${filename}`);
      setTimeout(() => setDownloadSuccess(null), 4000);
    } catch (err) {
      console.error('Failed to export CSV:', err);
      alert('Failed to generate CSV file.');
    } finally {
      setIsExporting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto bg-slate-900/60 backdrop-blur-sm printable-modal-backdrop animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Modal Top Header (Hidden when printing) */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 no-print">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Export & Executive Report
                <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                  • {project.name}
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Generate formatted executive status summaries, Excel spreadsheets, or raw CSV files.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector & Filter Toolbar (Hidden when printing) */}
        <div className="px-5 py-3 bg-slate-50 dark:bg-slate-950/50 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 no-print">
          {/* Format Tabs */}
          <div className="flex items-center bg-slate-200/70 dark:bg-slate-800 p-1 rounded-xl gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('pdf')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'pdf'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Executive PDF</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('excel')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'excel'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Excel (.xlsx)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('csv')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'csv'
                  ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV Data</span>
            </button>
          </div>

          {/* Quick Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
              <span>Filter:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="all">All Tasks ({tasks.filter((t) => t.projectId === project.id).length})</option>
                <option value="completed">Completed Only ({stats.completed})</option>
                <option value="in_progress">In Progress & Review ({stats.inProgress + stats.readyReview})</option>
                <option value="blocked">Blocked ({stats.blocked})</option>
              </select>
            </div>

            {activeTab === 'pdf' && (
              <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeDoD}
                  onChange={(e) => setIncludeDoD(e.target.checked)}
                  className="rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500"
                />
                <span>Include DoD Checklists</span>
              </label>
            )}
          </div>
        </div>

        {/* Modal Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          {downloadSuccess && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs flex items-center gap-2 no-print">
              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>{downloadSuccess}</span>
            </div>
          )}

          {activeTab === 'pdf' && (
            <div className="space-y-4">
              {/* Optional Note Editor (Hidden in Print) */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800 no-print">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    Executive Briefing Note (appears at top of PDF report)
                  </span>
                  <button
                    type="button"
                    onClick={() => setIncludeExecutiveNote(!includeExecutiveNote)}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    {includeExecutiveNote ? 'Disable note' : 'Enable note'}
                  </button>
                </div>
                {includeExecutiveNote && (
                  <textarea
                    rows={2}
                    value={executiveNote}
                    onChange={(e) => setExecutiveNote(e.target.value)}
                    placeholder="Enter key highlight, milestone accomplishment, or executive takeaway..."
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                  />
                )}
              </div>

              {/* ================================================================= */}
              {/* PRINTABLE EXECUTIVE REPORT SHEET                                  */}
              {/* ================================================================= */}
              <div
                id="printable-report-area"
                className="printable-report-sheet bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm text-slate-900 dark:text-slate-100"
              >
                {/* Formal Letterhead */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b-2 border-slate-900 dark:border-slate-100 print-break-inside-avoid">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                        EM
                      </div>
                      <span className="text-xs font-extrabold tracking-wider uppercase text-slate-500 dark:text-slate-400">
                        EASY MANAGE &bull; EXECUTIVE REPORT
                      </span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                      {project.name}
                    </h1>
                    <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-600 dark:text-slate-400">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        Client: {project.client || 'Internal Initiative'}
                      </span>
                      <span>&bull;</span>
                      <span>Status: {project.status}</span>
                    </div>
                  </div>

                  <div className="text-left sm:text-right text-xs text-slate-500 dark:text-slate-400">
                    <p className="font-semibold text-slate-700 dark:text-slate-300">
                      Report Date: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>
                    <p className="mt-0.5">Overall Completion: <strong className="text-slate-900 dark:text-white font-bold">{stats.percent}%</strong></p>
                    {project.targetDeadline && (
                      <p className="mt-0.5">
                        Target Deadline: <strong className="text-slate-900 dark:text-white">{project.targetDeadline}</strong>
                      </p>
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="my-5 print-break-inside-avoid">
                  <div className="flex justify-between items-center text-xs font-semibold mb-1.5 text-slate-700 dark:text-slate-300">
                    <span>Deliverable Execution Progress</span>
                    <span>{stats.completed} of {stats.total} Deliverables Completed ({stats.percent}%)</span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden border border-slate-200 dark:border-slate-700">
                    <div
                      className="h-full bg-blue-600 rounded-full transition-all duration-300"
                      style={{ width: `${stats.percent}%` }}
                    />
                  </div>
                </div>

                {/* Executive Callout Note */}
                {includeExecutiveNote && executiveNote.trim() && (
                  <div className="my-5 p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs print-break-inside-avoid">
                    <div className="font-bold text-slate-900 dark:text-white mb-1 uppercase tracking-wider text-2xs flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      Executive Takeaway
                    </div>
                    <p className="text-slate-700 dark:text-slate-300 leading-relaxed italic">
                      "{executiveNote.trim()}"
                    </p>
                  </div>
                )}

                {/* KPI Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-5 print-break-inside-avoid">
                  <div className="kpi-card p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-center">
                    <span className="text-2xs font-bold uppercase text-slate-500 dark:text-slate-400">Total Items</span>
                    <p className="text-xl font-black text-slate-900 dark:text-white mt-0.5">{stats.total}</p>
                  </div>
                  <div className="kpi-card p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 text-center">
                    <span className="text-2xs font-bold uppercase text-emerald-700 dark:text-emerald-400">Completed</span>
                    <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{stats.completed}</p>
                  </div>
                  <div className="kpi-card p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 text-center">
                    <span className="text-2xs font-bold uppercase text-blue-700 dark:text-blue-400">In Progress / Review</span>
                    <p className="text-xl font-black text-blue-600 dark:text-blue-400 mt-0.5">{stats.inProgress + stats.readyReview}</p>
                  </div>
                  <div className="kpi-card p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-center">
                    <span className="text-2xs font-bold uppercase text-rose-700 dark:text-rose-400">Blocked / Pending</span>
                    <p className="text-xl font-black text-rose-600 dark:text-rose-400 mt-0.5">{stats.blocked}</p>
                  </div>
                </div>

                {/* Deliverables Table */}
                <div className="my-6">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2.5">
                    Milestones & Deliverables ({projectTasks.length})
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b-2 border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/80 font-bold text-slate-700 dark:text-slate-300">
                          <th className="py-2.5 px-3 w-10">#</th>
                          <th className="py-2.5 px-3">Deliverable</th>
                          <th className="py-2.5 px-3 w-28">Status</th>
                          <th className="py-2.5 px-3 w-24">Priority</th>
                          <th className="py-2.5 px-3 w-32">Assignee</th>
                          <th className="py-2.5 px-3 w-28">Due Date</th>
                          {includeDoD && <th className="py-2.5 px-3">DoD Checklist</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {projectTasks.length === 0 ? (
                          <tr>
                            <td colSpan={includeDoD ? 7 : 6} className="py-6 text-center text-slate-400 italic">
                              No deliverables match the selected filter.
                            </td>
                          </tr>
                        ) : (
                          projectTasks.map((task, idx) => {
                            const assignee = teamMembers.find((m) => m.id === task.assigneeId);
                            const subtasks = task.subtasks || [];
                            const doneSubtasks = subtasks.filter((s) => s.completed).length;
                            const totalSubtasks = subtasks.length;

                            return (
                              <tr key={task.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                                <td className="py-2 px-3 text-slate-400 font-mono text-3xs">{idx + 1}</td>
                                <td className="py-2 px-3">
                                  <span className="font-semibold text-slate-900 dark:text-white block">
                                    {task.title}
                                  </span>
                                  {task.description && (
                                    <span className="text-3xs text-slate-500 line-clamp-1">
                                      {task.description}
                                    </span>
                                  )}
                                </td>
                                <td className="py-2 px-3">
                                  <span
                                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-3xs font-semibold ${
                                      task.status === 'Completed'
                                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                                        : task.status === 'Blocked'
                                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300'
                                        : task.status === 'Ready Review'
                                        ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300'
                                        : 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300'
                                    }`}
                                  >
                                    {task.status}
                                  </span>
                                </td>
                                <td className="py-2 px-3">
                                  <span className="text-3xs font-medium text-slate-600 dark:text-slate-300">
                                    {task.priority}
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-slate-700 dark:text-slate-300">
                                  {assignee?.name || 'Unassigned'}
                                </td>
                                <td className="py-2 px-3 text-slate-600 dark:text-slate-400 font-mono text-3xs">
                                  {task.dueDate || '—'}
                                </td>
                                {includeDoD && (
                                  <td className="py-2 px-3">
                                    {totalSubtasks > 0 ? (
                                      <div className="flex items-center gap-1.5 min-w-[70px]">
                                        <div className="w-12 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden border border-slate-200 dark:border-slate-700">
                                          <div
                                            className={`h-full rounded-full transition-all ${
                                              doneSubtasks === totalSubtasks ? 'bg-emerald-500' : 'bg-blue-600'
                                            }`}
                                            style={{
                                              width: `${Math.round((doneSubtasks / totalSubtasks) * 100)}%`,
                                            }}
                                          />
                                        </div>
                                        <span
                                          className={`text-3xs font-mono font-semibold ${
                                            doneSubtasks === totalSubtasks
                                              ? 'text-emerald-600 dark:text-emerald-400'
                                              : 'text-slate-600 dark:text-slate-400'
                                          }`}
                                        >
                                          {doneSubtasks}/{totalSubtasks}
                                        </span>
                                      </div>
                                    ) : (
                                      <span className="text-slate-400 text-3xs">—</span>
                                    )}
                                  </td>
                                )}
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Sign-off Block */}
                <div className="pt-8 mt-6 border-t border-slate-200 dark:border-slate-800 print-break-inside-avoid">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs text-slate-600 dark:text-slate-400">
                    <div>
                      <span className="block text-2xs font-bold uppercase text-slate-400 mb-4">
                        Report Generated By
                      </span>
                      <p className="font-bold text-slate-900 dark:text-white">{manager?.name || 'Project Manager'}</p>
                      <p className="text-3xs text-slate-500">{manager?.role || 'Lead'}</p>
                    </div>

                    <div>
                      <span className="block text-2xs font-bold uppercase text-slate-400 mb-4">
                        Executive Review
                      </span>
                      <div className="border-b border-dashed border-slate-400 h-6 w-full" />
                      <p className="text-3xs text-slate-400 mt-1">Signature & Date</p>
                    </div>

                    <div>
                      <span className="block text-2xs font-bold uppercase text-slate-400 mb-4">
                        Client Acknowledgment
                      </span>
                      <div className="border-b border-dashed border-slate-400 h-6 w-full" />
                      <p className="text-3xs text-slate-400 mt-1">Authorized Representative</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'excel' && (
            <div className="space-y-4">
              <div className="p-6 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-center max-w-xl mx-auto my-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3">
                  <FileSpreadsheet className="w-7 h-7" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Export to Microsoft Excel (.xlsx)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                  Generates a multi-sheet spreadsheet workbook containing complete project metrics and formatted deliverables table with Definition of Done status.
                </p>

                <div className="mt-5 text-left bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-xs space-y-2">
                  <div className="font-semibold text-slate-700 dark:text-slate-300">Workbook Contents:</div>
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <strong>Sheet 1 (Overview):</strong> Project timeline, lead, client, metrics, and summary notes.
                  </div>
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <strong>Sheet 2 (Deliverables):</strong> {projectTasks.length} task records with IDs, priorities, statuses, and checklist breakdowns.
                  </div>
                </div>

                <div className="mt-6">
                  <button
                    type="button"
                    onClick={handleExportExcel}
                    disabled={isExporting}
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Download className="w-4 h-4" />
                    <span>{isExporting ? 'Generating Excel Workbook...' : 'Download Excel Workbook (.xlsx)'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'csv' && (
            <div className="space-y-4">
              <div className="p-6 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-center max-w-xl mx-auto my-4">
                <div className="w-14 h-14 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center mx-auto mb-3">
                  <Download className="w-7 h-7" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Export to Comma-Separated Values (.csv)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                  Export raw tabular task data ready to import directly into Notion, Google Sheets, Airtable, or Jira.
                </p>

                <div className="mt-5 text-left bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-xs space-y-2">
                  <div className="font-semibold text-slate-700 dark:text-slate-300">File Specification:</div>
                  <div className="text-slate-600 dark:text-slate-400">
                    UTF-8 with BOM for seamless Excel compatibility &bull; RFC 4180 compliant escaping
                  </div>
                  <div className="text-slate-600 dark:text-slate-400">
                    Includes: <strong>{projectTasks.length} task rows</strong> with 8 standard metadata columns.
                  </div>
                </div>

                <div className="mt-6">
                  <button
                    type="button"
                    onClick={handleExportCsv}
                    disabled={isExporting}
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Download className="w-4 h-4" />
                    <span>{isExporting ? 'Generating CSV...' : 'Download CSV (.csv)'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Action Bar / Footer (Hidden when printing) */}
        <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between no-print">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
          >
            Close
          </button>

          <div className="flex items-center gap-2">
            {activeTab === 'pdf' ? (
              <button
                type="button"
                onClick={handlePrintPdf}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print / Save as PDF</span>
              </button>
            ) : activeTab === 'excel' ? (
              <button
                type="button"
                onClick={handleExportExcel}
                disabled={isExporting}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Download Excel</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleExportCsv}
                disabled={isExporting}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download CSV</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

