import React, { useState, useMemo } from 'react';
import {
  Trash2,
  RotateCcw,
  Search,
  Clock,
  Folder,
  CheckSquare,
  AlertCircle,
  Calendar,
  Layers,
  ArrowLeft,
  RefreshCw,
  Info,
  CheckCircle2,
  X,
  AlertTriangle,
  UserX,
} from 'lucide-react';
import { Project, Task, RecycleBinData } from '../types';
import { getStatusBadgeClass, getPriorityBadgeClass } from './Badges';
import { ConfirmationModal } from './ConfirmationModal';

interface RecycleBinViewProps {
  recycleBinData: RecycleBinData;
  isLoading?: boolean;
  onRestoreItem: (type: 'project' | 'task', id: string) => Promise<void>;
  onPermanentDeleteItem: (type: 'project' | 'task', id: string) => Promise<void>;
  onEmptyRecycleBin: () => Promise<void>;
  onBackToDashboard: () => void;
  onRefresh?: () => Promise<void>;
}

export const RecycleBinView: React.FC<RecycleBinViewProps> = ({
  recycleBinData,
  isLoading = false,
  onRestoreItem,
  onPermanentDeleteItem,
  onEmptyRecycleBin,
  onBackToDashboard,
  onRefresh,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'projects' | 'tasks'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Confirmation state for deleting forever
  const [confirmDelete, setConfirmDelete] = useState<{
    isOpen: boolean;
    type: 'project' | 'task';
    id: string;
    name: string;
  } | null>(null);

  // Confirmation state for emptying the bin
  const [isConfirmEmptyOpen, setIsConfirmEmptyOpen] = useState(false);

  const { projects = [], tasks = [], totalCount = 0 } = recycleBinData;

  const filteredProjects = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return projects;
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.client && p.client.toLowerCase().includes(q)) ||
        (p.description && p.description.toLowerCase().includes(q))
    );
  }, [projects, searchQuery]);

  const filteredTasks = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return tasks;
    return tasks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.projectName && t.projectName.toLowerCase().includes(q)) ||
        (t.description && t.description.toLowerCase().includes(q))
    );
  }, [tasks, searchQuery]);

  const handleManualRefresh = async () => {
    if (!onRefresh) return;
    try {
      setIsRefreshing(true);
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleRestore = async (type: 'project' | 'task', id: string) => {
    try {
      setProcessingId(id);
      await onRestoreItem(type, id);
    } finally {
      setProcessingId(null);
    }
  };

  const handleConfirmPermanentDelete = async () => {
    if (!confirmDelete) return;
    try {
      setProcessingId(confirmDelete.id);
      await onPermanentDeleteItem(confirmDelete.type, confirmDelete.id);
      setConfirmDelete(null);
    } finally {
      setProcessingId(null);
    }
  };

  const handleConfirmEmptyBin = async () => {
    try {
      setIsConfirmEmptyOpen(false);
      await onEmptyRecycleBin();
    } catch (err) {
      console.error(err);
    }
  };

  const formatCountdownBadge = (daysLeft?: number) => {
    const count = typeof daysLeft === 'number' ? daysLeft : 7;
    let label = '';
    let colorCls = '';

    if (count <= 0) {
      label = 'Auto-deletes today';
      colorCls = 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800';
    } else if (count === 1) {
      label = 'Auto-deletes in 1 day';
      colorCls = 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800';
    } else if (count <= 3) {
      label = `Auto-deletes in ${count} days`;
      colorCls = 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800';
    } else {
      label = `Auto-deletes in ${count} days`;
      colorCls = 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    }

    return (
      <span
        className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md border shadow-2xs ${colorCls}`}
        title="Items remain in Recycle Bin for 7 days before permanent automatic removal"
      >
        <Clock className="w-3 h-3" />
        {label}
      </span>
    );
  };

  const formatDeletedDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return `${d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })} at ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
    } catch {
      return '';
    }
  };

  const renderDeletedByBadge = (item: { deletedAt?: string; deletedByName?: string; deletedByAvatar?: string }) => {
    const formattedDate = formatDeletedDate(item.deletedAt);
    if (!item.deletedByName && !formattedDate) return null;

    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-rose-700 dark:text-rose-300 bg-rose-50/80 dark:bg-rose-950/40 px-2 py-0.5 rounded-md border border-rose-200/70 dark:border-rose-900/50">
        <UserX className="w-3.5 h-3.5 text-rose-500 shrink-0" />
        <span className="text-slate-500 dark:text-slate-400">Deleted by:</span>
        {item.deletedByName && (
          <span className="inline-flex items-center gap-1 font-semibold text-rose-900 dark:text-rose-100">
            {item.deletedByAvatar ? (
              <img
                src={item.deletedByAvatar}
                alt={item.deletedByName}
                className="w-4 h-4 rounded-full object-cover shrink-0 ring-1 ring-rose-300 dark:ring-rose-700"
              />
            ) : (
              <span className="w-4 h-4 rounded-full bg-rose-200 dark:bg-rose-800 text-rose-800 dark:text-rose-100 text-3xs font-bold flex items-center justify-center shrink-0">
                {item.deletedByName.charAt(0).toUpperCase()}
              </span>
            )}
            <span>{item.deletedByName}</span>
          </span>
        )}
        {formattedDate && (
          <span className="text-slate-400 dark:text-slate-500 font-normal">
            ({formattedDate})
          </span>
        )}
      </span>
    );
  };

  const renderProjectCard = (project: Project) => (
    <div
      key={`proj-${project.id}`}
      className="p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
    >
      <div className="flex items-start gap-3.5 min-w-0 flex-1">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-2xs mt-0.5"
          style={{ backgroundColor: project.color || '#2563eb' }}
        >
          <Folder className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
              {project.name}
            </h4>
            <span className={getStatusBadgeClass(project.status, 'xs')}>
              {project.status}
            </span>
            {formatCountdownBadge(project.daysLeft)}
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            {project.client && (
              <span className="flex items-center gap-1 font-medium">
                Client: <strong className="text-slate-700 dark:text-slate-300">{project.client}</strong>
              </span>
            )}
            {project.targetDeadline && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                Deadline: {project.targetDeadline}
              </span>
            )}
            {renderDeletedByBadge(project)}
          </div>
          {project.description && (
            <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
              {project.description}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800 w-full sm:w-auto justify-end">
        <button
          onClick={() => handleRestore('project', project.id)}
          disabled={processingId === project.id}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors cursor-pointer disabled:opacity-50 shadow-2xs"
          title="Restore project and its deliverables back to active board"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${processingId === project.id ? 'animate-spin' : ''}`} />
          <span>Restore Project</span>
        </button>
        <button
          onClick={() =>
            setConfirmDelete({
              isOpen: true,
              type: 'project',
              id: project.id,
              name: project.name,
            })
          }
          disabled={processingId === project.id}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-colors cursor-pointer disabled:opacity-50 shadow-2xs"
          title="Permanently delete project immediately"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Delete Forever</span>
        </button>
      </div>
    </div>
  );

  const renderTaskCard = (task: Task) => (
    <div
      key={`task-${task.id}`}
      className="p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
    >
      <div className="flex items-start gap-3.5 min-w-0 flex-1">
        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0 shadow-2xs mt-0.5 border border-slate-200 dark:border-slate-700">
          <CheckSquare className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
              {task.title}
            </h4>
            <span className={getStatusBadgeClass(task.status, 'xs')}>
              {task.status}
            </span>
            <span className={getPriorityBadgeClass(task.priority, 'xs')}>
              {task.priority}
            </span>
            {formatCountdownBadge(task.daysLeft)}
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            {task.projectName && (
              <span className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                <Folder className="w-3 h-3 text-blue-500" />
                Project: {task.projectName}
              </span>
            )}
            {task.dueDate && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                Due: {task.dueDate}
              </span>
            )}
            {renderDeletedByBadge(task)}
          </div>
          {task.description && (
            <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
              {task.description}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800 w-full sm:w-auto justify-end">
        <button
          onClick={() => handleRestore('task', task.id)}
          disabled={processingId === task.id}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors cursor-pointer disabled:opacity-50 shadow-2xs"
          title="Restore task back to its project"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${processingId === task.id ? 'animate-spin' : ''}`} />
          <span>Restore Task</span>
        </button>
        <button
          onClick={() =>
            setConfirmDelete({
              isOpen: true,
              type: 'task',
              id: task.id,
              name: task.title,
            })
          }
          disabled={processingId === task.id}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-colors cursor-pointer disabled:opacity-50 shadow-2xs"
          title="Permanently delete task immediately"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Delete Forever</span>
        </button>
      </div>
    </div>
  );

  const hasItems = totalCount > 0;
  const showProjects = activeTab === 'all' || activeTab === 'projects';
  const showTasks = activeTab === 'all' || activeTab === 'tasks';

  const totalFilteredCount =
    (showProjects ? filteredProjects.length : 0) +
    (showTasks ? filteredTasks.length : 0);

  return (
    <div id="recycle-bin-view" className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header & Navigation Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button
            onClick={onBackToDashboard}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition-colors mb-2 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Dashboard
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-200 dark:border-rose-800/80 shadow-2xs shrink-0">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                  Recycle Bin
                </h1>
                <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                  {totalCount} {totalCount === 1 ? 'item' : 'items'}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Deleted projects and tasks are preserved for 1 week (7 days) before automatic permanent purge.
              </p>
            </div>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          {onRefresh && (
            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-200 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
              title="Refresh Recycle Bin items"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          )}

          {hasItems && (
            <button
              id="empty-recycle-bin-btn"
              onClick={() => setIsConfirmEmptyOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white transition-colors cursor-pointer shadow-xs"
              title="Permanently remove all items in the Recycle Bin"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Empty Bin</span>
            </button>
          )}
        </div>
      </div>

      {/* 7-Day Retention Notice Banner */}
      <div className="p-4 rounded-xl bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-blue-900 dark:text-blue-200">
        <div className="flex items-start sm:items-center gap-2.5">
          <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5 sm:mt-0" />
          <span>
            <strong>7-Day Retention Window:</strong> You can safely restore any item back to your active projects with all its data intact. To free up storage immediately, use <em>Delete Forever</em>.
          </span>
        </div>
        <div className="flex items-center gap-2 text-2xs font-bold text-blue-700 dark:text-blue-300 shrink-0 bg-blue-100/70 dark:bg-blue-900/40 px-2.5 py-1 rounded-md">
          <Clock className="w-3.5 h-3.5" />
          Auto-purged after 7 days
        </div>
      </div>

      {/* Filters & Segmented Tabs Bar */}
      <div className="p-3 sm:p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Segmented Tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-lg w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('all')}
            className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'all'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>All Items</span>
            <span className="px-1.5 py-0.2 rounded-full text-3xs font-bold bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200">
              {totalCount}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('projects')}
            className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'projects'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Folder className="w-3.5 h-3.5 text-blue-500" />
            <span>Projects</span>
            <span className="px-1.5 py-0.2 rounded-full text-3xs font-bold bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200">
              {projects.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('tasks')}
            className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'tasks'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5 text-emerald-500" />
            <span>Tasks</span>
            <span className="px-1.5 py-0.2 rounded-full text-3xs font-bold bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200">
              {tasks.length}
            </span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search deleted items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Content List */}
      {isLoading ? (
        <div className="p-12 text-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <RefreshCw className="w-8 h-8 text-rose-500 animate-spin mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Loading Recycle Bin...
          </p>
        </div>
      ) : !hasItems ? (
        <div className="p-12 sm:p-16 text-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 bg-white/60 dark:bg-slate-900/40">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-4 border border-slate-200 dark:border-slate-700">
            <Trash2 className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Recycle Bin is empty
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            Any projects or tasks you delete will be safely kept here for 7 days before being permanently removed.
          </p>
          <button
            onClick={onBackToDashboard}
            className="inline-flex items-center gap-1.5 mt-5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Return to Dashboard
          </button>
        </div>
      ) : totalFilteredCount === 0 ? (
        <div className="p-10 text-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <AlertCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            No deleted items match &quot;{searchQuery}&quot;
          </p>
          <button
            onClick={() => setSearchQuery('')}
            className="mt-3 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
          >
            Clear search query
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Projects Section */}
          {showProjects && filteredProjects.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Folder className="w-4 h-4 text-blue-500" />
                  Deleted Projects ({filteredProjects.length})
                </h3>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {filteredProjects.map(renderProjectCard)}
              </div>
            </div>
          )}

          {/* Tasks Section */}
          {showTasks && filteredTasks.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <CheckSquare className="w-4 h-4 text-emerald-500" />
                  Deleted Tasks ({filteredTasks.length})
                </h3>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {filteredTasks.map(renderTaskCard)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal: Delete Forever */}
      <ConfirmationModal
        isOpen={Boolean(confirmDelete?.isOpen)}
        title={`Permanently Delete ${confirmDelete?.type === 'project' ? 'Project' : 'Task'}?`}
        message={`Are you sure you want to delete "${confirmDelete?.name}" forever? This item will be permanently removed from the database and cannot be recovered.`}
        confirmLabel="Yes, Delete Forever"
        cancelLabel="Keep in Bin"
        isDestructive={true}
        iconType="danger"
        onConfirm={handleConfirmPermanentDelete}
        onCancel={() => setConfirmDelete(null)}
      />

      {/* Confirmation Modal: Empty Bin */}
      <ConfirmationModal
        isOpen={isConfirmEmptyOpen}
        title="Empty Recycle Bin?"
        message={`Are you sure you want to permanently delete all ${totalCount} items currently in the Recycle Bin? This action is immediate and cannot be undone.`}
        confirmLabel="Empty Everything"
        cancelLabel="Cancel"
        isDestructive={true}
        iconType="danger"
        onConfirm={handleConfirmEmptyBin}
        onCancel={() => setIsConfirmEmptyOpen(false)}
      />
    </div>
  );
};
