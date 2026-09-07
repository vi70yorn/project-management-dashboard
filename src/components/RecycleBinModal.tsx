import React, { useState, useMemo } from 'react';
import {
  Trash2,
  RotateCcw,
  X,
  Search,
  AlertTriangle,
  Clock,
  Folder,
  CheckSquare,
  AlertCircle,
  Calendar,
  Layers,
  Sparkles,
} from 'lucide-react';
import { Project, Task, RecycleBinData } from '../types';
import { getStatusBadgeClass, getPriorityBadgeClass } from './Badges';
import { ConfirmationModal } from './ConfirmationModal';

interface RecycleBinModalProps {
  isOpen: boolean;
  onClose: () => void;
  recycleBinData: RecycleBinData;
  isLoading?: boolean;
  onRestoreItem: (type: 'project' | 'task', id: string) => Promise<void>;
  onPermanentDeleteItem: (type: 'project' | 'task', id: string) => Promise<void>;
  onEmptyRecycleBin: () => Promise<void>;
}

export const RecycleBinModal: React.FC<RecycleBinModalProps> = ({
  isOpen,
  onClose,
  recycleBinData,
  isLoading = false,
  onRestoreItem,
  onPermanentDeleteItem,
  onEmptyRecycleBin,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'projects' | 'tasks'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Confirmation state for deleting forever
  const [confirmDelete, setConfirmDelete] = useState<{
    isOpen: boolean;
    type: 'project' | 'task';
    id: string;
    name: string;
  } | null>(null);

  // Confirmation state for emptying the bin
  const [isConfirmEmptyOpen, setIsConfirmEmptyOpen] = useState(false);

  if (!isOpen) return null;

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
        title="Items remain in Recycle Bin for 7 days before permanent removal"
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
      return `Deleted ${d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })} at ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
    } catch {
      return '';
    }
  };

  const renderProjectCard = (project: Project) => (
    <div
      key={`proj-${project.id}`}
      className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
    >
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center text-white shrink-0 shadow-2xs mt-0.5"
          style={{ backgroundColor: project.color || '#2563eb' }}
        >
          <Folder className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
              {project.name}
            </h4>
            <span className={getStatusBadgeClass(project.status, 'xs')}>
              {project.status}
            </span>
            {formatCountdownBadge(project.daysLeft)}
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-slate-500 dark:text-slate-400">
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
            {project.deletedAt && (
              <span className="text-slate-400 dark:text-slate-500">
                {formatDeletedDate(project.deletedAt)}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800 w-full sm:w-auto justify-end">
        <button
          onClick={() => handleRestore('project', project.id)}
          disabled={processingId === project.id}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors cursor-pointer disabled:opacity-50"
          title="Restore project and its deliverables back to active board"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Restore</span>
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
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-colors cursor-pointer disabled:opacity-50"
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
      className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
    >
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0 shadow-2xs mt-0.5 border border-slate-200 dark:border-slate-700">
          <CheckSquare className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
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

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            {task.projectName && (
              <span className="flex items-center gap-1 font-medium bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                <Folder className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                {task.projectName}
              </span>
            )}
            {task.dueDate && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                Due: {task.dueDate}
              </span>
            )}
            {task.deletedAt && (
              <span className="text-slate-400 dark:text-slate-500">
                {formatDeletedDate(task.deletedAt)}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800 w-full sm:w-auto justify-end">
        <button
          onClick={() => handleRestore('task', task.id)}
          disabled={processingId === task.id}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors cursor-pointer disabled:opacity-50"
          title="Restore task back to its project board"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Restore</span>
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
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-colors cursor-pointer disabled:opacity-50"
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
  const displayProjectCount = filteredProjects.length;
  const displayTaskCount = filteredTasks.length;
  const totalDisplayed = (showProjects ? displayProjectCount : 0) + (showTasks ? displayTaskCount : 0);

  return (
    <>
      <div
        id="recycle-bin-modal-backdrop"
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150"
      >
        <div
          id="recycle-bin-modal-container"
          className="w-full max-w-4xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="px-5 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-800/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-200 dark:border-rose-800/80 shadow-2xs shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                    Recycle Bin
                  </h3>
                  {totalCount > 0 && (
                    <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                      {totalCount} {totalCount === 1 ? 'item' : 'items'}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Deleted projects & tasks are kept safely for 1 week (7 days) before auto-removal
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {hasItems && (
                <button
                  onClick={() => setIsConfirmEmptyOpen(true)}
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:hover:bg-rose-900/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800 transition-colors cursor-pointer"
                  title="Permanently remove all items in the Recycle Bin"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Empty Bin</span>
                </button>
              )}
              <button
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Retention Notice Bar */}
          <div className="px-5 sm:px-6 py-2.5 bg-blue-50/70 dark:bg-blue-950/30 border-b border-blue-100 dark:border-blue-900/50 flex items-center justify-between gap-3 text-xs text-blue-800 dark:text-blue-300">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400" />
              <span>
                <strong>7-Day Retention:</strong> Items in the bin are permanently deleted after 1 week. You can restore them anytime or permanently delete them immediately.
              </span>
            </div>
            {hasItems && (
              <button
                onClick={() => setIsConfirmEmptyOpen(true)}
                className="sm:hidden text-rose-600 dark:text-rose-400 font-bold underline shrink-0 cursor-pointer"
              >
                Empty Bin
              </button>
            )}
          </div>

          {/* Controls: Segmented Tabs & Search Filter */}
          <div className="px-5 sm:px-6 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900">
            {/* Segmented Pill Tabs */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs w-full sm:w-auto">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer flex-1 sm:flex-none justify-center ${
                  activeTab === 'all'
                    ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-2xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                All Items ({totalCount})
              </button>

              <button
                onClick={() => setActiveTab('projects')}
                className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer flex-1 sm:flex-none justify-center ${
                  activeTab === 'projects'
                    ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-2xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Folder className="w-3.5 h-3.5" />
                Projects ({projects.length})
              </button>

              <button
                onClick={() => setActiveTab('tasks')}
                className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer flex-1 sm:flex-none justify-center ${
                  activeTab === 'tasks'
                    ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-2xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <CheckSquare className="w-3.5 h-3.5" />
                Tasks ({tasks.length})
              </button>
            </div>

            {/* Search Input */}
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search deleted items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Items Content Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 min-h-[250px]">
            {isLoading ? (
              <div className="py-16 text-center text-slate-400 text-sm">
                <div className="inline-block animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mb-2" />
                <p>Loading recycle bin items...</p>
              </div>
            ) : !hasItems ? (
              <div className="py-16 text-center">
                <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center mx-auto mb-3">
                  <Trash2 className="w-8 h-8 opacity-60" />
                </div>
                <h4 className="text-base font-bold text-slate-800 dark:text-white mb-1">
                  Recycle Bin is empty
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                  When you delete a project or task, it stays safely here for 1 week (7 days) before permanent removal.
                </p>
              </div>
            ) : totalDisplayed === 0 ? (
              <div className="py-12 text-center text-slate-500 dark:text-slate-400 text-xs">
                No items match your search &quot;{searchQuery}&quot;.
              </div>
            ) : (
              <div className="space-y-4">
                {/* Projects Section */}
                {showProjects && filteredProjects.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">
                      <span className="flex items-center gap-1.5">
                        <Folder className="w-3.5 h-3.5 text-blue-600" />
                        Deleted Projects ({filteredProjects.length})
                      </span>
                    </div>
                    <div className="space-y-2">
                      {filteredProjects.map(renderProjectCard)}
                    </div>
                  </div>
                )}

                {/* Tasks Section */}
                {showTasks && filteredTasks.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">
                      <span className="flex items-center gap-1.5">
                        <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
                        Deleted Tasks ({filteredTasks.length})
                      </span>
                    </div>
                    <div className="space-y-2">
                      {filteredTasks.map(renderTaskCard)}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 sm:px-6 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 bg-slate-50 dark:bg-slate-800/40 text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Restoring a project also restores its associated tasks.
            </span>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog: Delete Forever (Single Item) */}
      <ConfirmationModal
        isOpen={Boolean(confirmDelete?.isOpen)}
        title={`Permanently Delete ${confirmDelete?.type === 'project' ? 'Project' : 'Task'}?`}
        message={`Are you sure you want to permanently delete "${confirmDelete?.name}"?`}
        details={[
          'This action CANNOT be undone.',
          confirmDelete?.type === 'project'
            ? 'All tasks and member associations in this project will be permanently erased.'
            : 'This task will be permanently removed from the database.',
        ]}
        confirmLabel="Delete Forever"
        cancelLabel="Keep in Bin"
        isDestructive={true}
        iconType="trash"
        onConfirm={handleConfirmPermanentDelete}
        onCancel={() => setConfirmDelete(null)}
      />

      {/* Confirmation Dialog: Empty Bin (All Items) */}
      <ConfirmationModal
        isOpen={isConfirmEmptyOpen}
        title="Empty Entire Recycle Bin?"
        message={`Are you sure you want to permanently delete all ${totalCount} item${totalCount === 1 ? '' : 's'} in the Recycle Bin?`}
        details={[
          'All deleted projects and tasks will be erased immediately.',
          'This action CANNOT be undone.',
        ]}
        confirmLabel="Empty Bin Forever"
        cancelLabel="Cancel"
        isDestructive={true}
        iconType="trash"
        onConfirm={handleConfirmEmptyBin}
        onCancel={() => setIsConfirmEmptyOpen(false)}
      />
    </>
  );
};
