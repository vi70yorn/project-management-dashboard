import React, { useState, useEffect, useMemo } from 'react';
import {
  Globe,
  Lock,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Download,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  Link as LinkIcon,
  Layers,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Sparkles,
  Sun,
  Moon,
  ArrowRight,
  LogOut,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import {
  ClientProjectResponse,
  ClientProjectData,
  ClientTaskData,
  ClientAttachmentData,
  StatusType,
} from '../types';
import { fetchClientSharedProjectApi, verifyClientSharePasscodeApi } from '../services/api';
import { StatusBadge, PriorityBadge } from './Badges';
import { formatDateTime } from '../utils/dateUtils';
import { FORM_STYLES } from '../utils/formStyles';

interface ClientPortalViewProps {
  shareToken: string;
  onExit?: () => void;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
  uiStyle?: 'glass' | 'normal' | 'nothing';
}

export const ClientPortalView: React.FC<ClientPortalViewProps> = ({
  shareToken,
  onExit,
  theme = 'light',
  onToggleTheme,
  uiStyle = 'normal',
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [portalData, setPortalData] = useState<ClientProjectResponse | null>(null);

  // Passcode gate state
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  // Filter & interaction state
  const [taskStatusFilter, setTaskStatusFilter] = useState<'all' | StatusType>('all');
  const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({});

  const loadData = async (codeToTry?: string) => {
    setIsLoading(true);
    setError(null);
    setPasswordError(null);

    try {
      const res = await fetchClientSharedProjectApi(shareToken, codeToTry);
      if (res.requiresPassword && !codeToTry) {
        setRequiresPassword(true);
        setPortalData(res);
      } else {
        setRequiresPassword(false);
        setPortalData(res);
      }
    } catch (err: any) {
      if (requiresPassword) {
        setPasswordError(err.message || 'Incorrect passcode');
      } else {
        setError(err.message || 'Failed to load project portal');
      }
    } finally {
      setIsLoading(false);
      setIsVerifying(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [shareToken]);

  const handlePasscodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode.trim()) return;

    setIsVerifying(true);
    setPasswordError(null);

    try {
      const verifyRes = await verifyClientSharePasscodeApi(shareToken, passcode.trim());
      if (verifyRes.success) {
        await loadData(passcode.trim());
      }
    } catch (err: any) {
      setPasswordError(err.message || 'Incorrect passcode');
      setIsVerifying(false);
    }
  };

  const toggleTaskExpand = (taskId: string) => {
    setExpandedTasks((prev) => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  const project = portalData?.project;
  const metrics = portalData?.metrics;
  const tasks = portalData?.tasks || [];
  const attachments = portalData?.attachments || [];

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    if (taskStatusFilter === 'all') return tasks;
    return tasks.filter((t) => t.status === taskStatusFilter);
  }, [tasks, taskStatusFilter]);

  // Render file icon
  const getFileIcon = (fileType: string) => {
    switch (fileType) {
      case 'pdf':
      case 'word':
        return <FileText className="w-4 h-4 text-rose-500" />;
      case 'excel':
        return <FileSpreadsheet className="w-4 h-4 text-emerald-500" />;
      case 'image':
        return <ImageIcon className="w-4 h-4 text-blue-500" />;
      default:
        return <FileText className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 px-4 sm:px-8 py-3 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-blue-600 text-white shadow-xs">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                Client Portal
              </span>
              <span className="px-2 py-0.5 rounded-full text-3xs font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                Live Status
              </span>
            </div>
            {project?.name && (
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate max-w-xs sm:max-w-md">
                {project.name} &bull; {project.client}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onToggleTheme && (
            <button
              onClick={onToggleTheme}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>
          )}

          {onExit && (
            <button
              onClick={onExit}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Team Login</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        {/* Loading State */}
        {isLoading && !requiresPassword && (
          <div className="py-24 flex flex-col items-center justify-center gap-4 text-slate-500">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
            <p className="text-sm font-medium">Connecting to secure client portal...</p>
          </div>
        )}

        {/* Error State */}
        {!isLoading && error && (
          <div className="max-w-md mx-auto my-12 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl text-center space-y-4 animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 mx-auto flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Portal Unavailable</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{error}</p>
            {onExit && (
              <button
                onClick={onExit}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                Back to Dashboard
              </button>
            )}
          </div>
        )}

        {/* Passcode Protection Gate */}
        {requiresPassword && (
          <div className="max-w-md mx-auto my-12 p-6 sm:p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl text-center space-y-5 animate-in zoom-in-95">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 mx-auto flex items-center justify-center border border-blue-200 dark:border-blue-900/60 shadow-xs">
              <Lock className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Passcode Protected</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {portalData?.projectName ? `Enter the passcode for "${portalData.projectName}"` : 'Please enter the client passcode provided by the project manager.'}
              </p>
            </div>

            <form onSubmit={handlePasscodeSubmit} className="space-y-4">
              <div>
                <input
                  type="password"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="Enter passcode..."
                  autoFocus
                  className={`${FORM_STYLES.input} text-center font-mono text-base tracking-widest`}
                />
                {passwordError && (
                  <p className="text-xs font-medium text-rose-600 dark:text-rose-400 mt-2 flex items-center justify-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {passwordError}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isVerifying || !passcode.trim()}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer"
              >
                {isVerifying ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <span>Unlock Portal</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* Unlocked Client Portal View */}
        {!isLoading && !error && !requiresPassword && project && (
          <div className="space-y-8 animate-in fade-in duration-300">
            {/* 1. Hero Project Overview Card */}
            <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
              <div
                className="absolute top-0 left-0 right-0 h-2"
                style={{ backgroundColor: project.color || '#2563eb' }}
              />

              <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                <div className="space-y-3 flex-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <StatusBadge status={project.status} />
                    <span className="text-xs font-semibold px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      Client: {project.client}
                    </span>
                    {project.tags &&
                      project.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-2xs font-medium px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/50 dark:border-blue-900/50"
                        >
                          #{tag}
                        </span>
                      ))}
                  </div>

                  <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                    {project.name}
                  </h1>

                  {project.description && (
                    <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                      {project.description}
                    </div>
                  )}
                </div>

                {/* Manager & Timeline Side Box */}
                <div className="w-full md:w-64 shrink-0 space-y-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60">
                  <div>
                    <span className="text-3xs uppercase tracking-wider font-bold text-slate-400 block mb-1.5">
                      Project Lead
                    </span>
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shadow-2xs">
                        {project.managerName ? project.managerName.slice(0, 2).toUpperCase() : 'PM'}
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-900 dark:text-white block">
                          {project.managerName || 'UX Lead'}
                        </span>
                        <span className="text-2xs text-slate-500 dark:text-slate-400">
                          {project.managerRole || 'Project Manager'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2.5 border-t border-slate-200/80 dark:border-slate-700/80">
                    <span className="text-3xs uppercase tracking-wider font-bold text-slate-400 block mb-1">
                      Target Deadline
                    </span>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                        {project.targetDeadline || 'Not set'}
                      </span>
                      {metrics?.daysLeft !== null && (
                        <span
                          className={`text-2xs font-bold px-2 py-0.5 rounded-full ${
                            metrics.isOverdue
                              ? 'bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300'
                              : metrics.daysLeft! <= 3
                              ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300'
                              : 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300'
                          }`}
                        >
                          {metrics.isOverdue
                            ? `${Math.abs(metrics.daysLeft!)}d Overdue`
                            : `${metrics.daysLeft}d left`}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Key Metrics Bar */}
            {metrics && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
                  <span className="text-3xs font-bold uppercase tracking-wider text-slate-400 block">
                    Completion
                  </span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-extrabold text-blue-600 dark:text-blue-400">
                      {metrics.progressPercent}%
                    </span>
                    <span className="text-2xs text-slate-500">of tasks done</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full mt-2 overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full transition-all duration-500"
                      style={{ width: `${metrics.progressPercent}%` }}
                    />
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
                  <span className="text-3xs font-bold uppercase tracking-wider text-slate-400 block">
                    Total Deliverables
                  </span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-extrabold text-slate-900 dark:text-white">
                      {metrics.totalTasks}
                    </span>
                    <span className="text-2xs text-slate-500">items</span>
                  </div>
                  <span className="text-2xs text-slate-400 block mt-2">Tracked in scope</span>
                </div>

                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
                  <span className="text-3xs font-bold uppercase tracking-wider text-slate-400 block">
                    Completed
                  </span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
                      {metrics.completedTasks}
                    </span>
                    <span className="text-2xs text-slate-500">finished</span>
                  </div>
                  <span className="text-2xs text-emerald-600/80 dark:text-emerald-400/80 block mt-2">
                    Delivered &amp; verified
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
                  <span className="text-3xs font-bold uppercase tracking-wider text-slate-400 block">
                    Ready For Review
                  </span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-extrabold text-purple-600 dark:text-purple-400">
                      {metrics.reviewTasks}
                    </span>
                    <span className="text-2xs text-slate-500">pending</span>
                  </div>
                  <span className="text-2xs text-purple-600/80 dark:text-purple-400/80 block mt-2">
                    Awaiting feedback
                  </span>
                </div>
              </div>
            )}

            {/* 3. Live External Links & Prototypes (Figma, Notion, GitHub) */}
            {project.links && project.links.length > 0 && (
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <LinkIcon className="w-4 h-4 text-blue-500" />
                  Key Project Links &amp; Prototypes
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {project.links.map((link) => (
                    <a
                      key={link.id}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/70 hover:border-blue-400 dark:hover:border-blue-500 transition-all flex items-center justify-between group shadow-2xs"
                    >
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400">
                          {link.title || link.url}
                        </span>
                      </div>
                      <span className="text-3xs uppercase font-bold text-slate-400 shrink-0 ml-2">
                        {link.platform || 'Link'}
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* 4. Deliverables & Milestones Section */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Layers className="w-5 h-5 text-blue-600" />
                    Deliverables &amp; Milestones
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Live status and progress of all items in this project
                  </p>
                </div>

                {/* Filter Tabs */}
                <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-700/80 overflow-x-auto shrink-0">
                  {[
                    { id: 'all', label: 'All Tasks' },
                    { id: 'In Progress', label: 'In Progress' },
                    { id: 'Ready Review', label: 'Review' },
                    { id: 'Completed', label: 'Completed' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setTaskStatusFilter(tab.id as any)}
                      className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                        taskStatusFilter === tab.id
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                          : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {filteredTasks.length === 0 ? (
                <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center text-slate-500">
                  <p className="text-xs">No deliverable tasks found matching the filter.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredTasks.map((task) => {
                    const hasSubtasks = task.subtasks && task.subtasks.length > 0;
                    const isExpanded = expandedTasks[task.id] ?? false;
                    const completedSubtasks = hasSubtasks
                      ? task.subtasks!.filter((s) => s.completed).length
                      : 0;
                    const totalSubtasks = hasSubtasks ? task.subtasks!.length : 0;

                    return (
                      <div
                        key={task.id}
                        className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3 transition-all hover:border-slate-300 dark:hover:border-slate-700"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <StatusBadge status={task.status} />
                              <PriorityBadge priority={task.priority} />
                              {task.dueDate && (
                                <span className="text-2xs text-slate-500 flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-slate-400" />
                                  Due {task.dueDate}
                                </span>
                              )}
                            </div>
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                              {task.title}
                            </h4>
                            {task.description && (
                              <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                                {task.description}
                              </p>
                            )}
                          </div>

                          {hasSubtasks && (
                            <button
                              onClick={() => toggleTaskExpand(task.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-2xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                            >
                              <span>
                                {completedSubtasks}/{totalSubtasks} DoD
                              </span>
                              {isExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </div>

                        {/* Subtasks / Definition of Done Checklist */}
                        {hasSubtasks && isExpanded && (
                          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-2 animate-in fade-in duration-150">
                            <span className="text-3xs uppercase tracking-wider font-bold text-slate-400 block">
                              Deliverable Checklist
                            </span>
                            <div className="space-y-1.5">
                              {task.subtasks!.map((sub) => (
                                <div
                                  key={sub.id}
                                  className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300"
                                >
                                  {sub.completed ? (
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                  ) : (
                                    <div className="w-3.5 h-3.5 rounded-full border border-slate-300 dark:border-slate-600 shrink-0" />
                                  )}
                                  <span className={sub.completed ? 'line-through text-slate-400' : ''}>
                                    {sub.title}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 5. Attachments & Documentation Section */}
            {attachments.length > 0 && (
              <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-500" />
                  Documentation &amp; Deliverables ({attachments.length})
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {attachments.map((att) => (
                    <div
                      key={att.id}
                      className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center justify-between gap-3 hover:border-slate-300 transition-all"
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 shrink-0">
                          {getFileIcon(att.fileType)}
                        </div>
                        <div className="overflow-hidden">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate block">
                            {att.fileName}
                          </span>
                          <span className="text-3xs text-slate-400 block">
                            {Math.round(att.fileSize / 1024)} KB
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {att.webViewLink && (
                          <a
                            href={att.webViewLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="Preview file"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                        {att.downloadLink && (
                          <a
                            href={att.downloadLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            download
                            className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="Download file"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="pt-8 border-t border-slate-200 dark:border-slate-800 text-center space-y-1">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Live Client Project Portal &bull; Updated real-time
              </p>
              <p className="text-3xs text-slate-400 dark:text-slate-500">
                Powered by UX/UI Management &amp; Project Dashboard
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

