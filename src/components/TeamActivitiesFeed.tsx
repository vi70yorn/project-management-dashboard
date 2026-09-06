import React, { useState, useEffect, useMemo } from 'react';
import {
  Activity,
  CheckCircle2,
  Clock,
  AlertOctagon,
  FolderKanban,
  PlusCircle,
  Trash2,
  RefreshCw,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { fetchActivitiesApi, ActivityLog } from '../services/api';

interface TeamActivitiesFeedProps {
  onSelectProject?: (projectId: string) => void;
  refreshTrigger?: number; // increments when project/task updates occur
}

export const TeamActivitiesFeed: React.FC<TeamActivitiesFeedProps> = ({
  onSelectProject,
  refreshTrigger,
}) => {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [filter, setFilter] = useState<'all' | 'task' | 'project'>('all');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const loadActivities = async (manual = false) => {
    if (manual) setIsRefreshing(true);
    try {
      const data = await fetchActivitiesApi(40);
      setActivities(data);
    } catch (err) {
      console.warn('Failed to load team activities:', err);
    } finally {
      setIsLoading(false);
      if (manual) setTimeout(() => setIsRefreshing(false), 400);
    }
  };

  useEffect(() => {
    loadActivities();
    // Auto-poll every 15 seconds to catch live updates from team members
    const interval = setInterval(() => {
      loadActivities();
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  // Reload when external mutations occur
  useEffect(() => {
    if (refreshTrigger !== undefined) {
      loadActivities();
    }
  }, [refreshTrigger]);

  const filteredActivities = useMemo(() => {
    if (filter === 'all') return activities;
    return activities.filter((a) => a.entityType === filter);
  }, [activities, filter]);

  // Relative time helper
  const formatTimeAgo = (dateStr: string) => {
    try {
      const now = new Date();
      const past = new Date(dateStr);
      const diffSec = Math.floor((now.getTime() - past.getTime()) / 1000);

      if (diffSec < 10) return 'Just now';
      if (diffSec < 60) return `${diffSec}s ago`;
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHour = Math.floor(diffMin / 60);
      if (diffHour < 24) return `${diffHour}h ago`;
      const diffDays = Math.floor(diffHour / 24);
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays}d ago`;
      return past.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const getInitials = (name: string) => {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const getActionBadge = (act: ActivityLog) => {
    const toStatus = act.details?.toStatus || act.details?.newStatus;

    if (act.actionType === 'auto_complete_project') {
      return {
        icon: <Sparkles className="w-3.5 h-3.5 text-amber-500" />,
        bg: 'bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300',
        label: 'Auto Completed',
      };
    }

    if (toStatus === 'Completed' || act.actionType === 'complete_task') {
      return {
        icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />,
        bg: 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300',
        label: 'Completed',
      };
    }

    if (toStatus === 'Blocked') {
      return {
        icon: <AlertOctagon className="w-3.5 h-3.5 text-rose-500" />,
        bg: 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300',
        label: 'Blocked',
      };
    }

    if (toStatus === 'In Progress') {
      return {
        icon: <Clock className="w-3.5 h-3.5 text-blue-500" />,
        bg: 'bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300',
        label: 'In Progress',
      };
    }

    if (act.actionType.startsWith('create_')) {
      return {
        icon: <PlusCircle className="w-3.5 h-3.5 text-indigo-500" />,
        bg: 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300',
        label: 'Created',
      };
    }

    if (act.actionType.startsWith('delete_')) {
      return {
        icon: <Trash2 className="w-3.5 h-3.5 text-rose-500" />,
        bg: 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300',
        label: 'Deleted',
      };
    }

    return {
      icon: <Activity className="w-3.5 h-3.5 text-slate-500" />,
      bg: 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300',
      label: 'Updated',
    };
  };

  const renderActionText = (act: ActivityLog) => {
    const toStatus = act.details?.toStatus || act.details?.newStatus;

    if (act.actionType === 'auto_complete_project') {
      return (
        <span>
          Auto-completed project{' '}
          <strong className="text-slate-900 dark:text-white font-semibold">{act.entityName}</strong>{' '}
          (all deliverables finished) 🚀
        </span>
      );
    }

    if (act.actionType === 'create_task') {
      return (
        <span>
          Created task{' '}
          <strong className="text-slate-900 dark:text-white font-semibold">{act.entityName}</strong>
          {act.projectName && (
            <span className="text-slate-500 dark:text-slate-400"> in {act.projectName}</span>
          )}
        </span>
      );
    }

    if (act.actionType === 'update_task_status') {
      return (
        <span>
          Changed{' '}
          <strong className="text-slate-900 dark:text-white font-semibold">{act.entityName}</strong>
          {toStatus ? ` to ${toStatus}` : ' status'}
          {act.projectName && (
            <span className="text-slate-500 dark:text-slate-400"> ({act.projectName})</span>
          )}
        </span>
      );
    }

    if (act.actionType === 'update_task') {
      return (
        <span>
          Updated task{' '}
          <strong className="text-slate-900 dark:text-white font-semibold">{act.entityName}</strong>
          {act.projectName && (
            <span className="text-slate-500 dark:text-slate-400"> in {act.projectName}</span>
          )}
        </span>
      );
    }

    if (act.actionType === 'delete_task') {
      return (
        <span>
          Deleted task{' '}
          <strong className="text-slate-900 dark:text-white font-semibold">{act.entityName}</strong>
        </span>
      );
    }

    if (act.actionType === 'create_project') {
      return (
        <span>
          Created new project{' '}
          <strong className="text-slate-900 dark:text-white font-semibold">{act.entityName}</strong>
        </span>
      );
    }

    if (act.actionType === 'update_project_status') {
      return (
        <span>
          Updated project{' '}
          <strong className="text-slate-900 dark:text-white font-semibold">{act.entityName}</strong>
          {toStatus ? ` status to ${toStatus}` : ''}
        </span>
      );
    }

    if (act.actionType === 'update_project') {
      return (
        <span>
          Updated project{' '}
          <strong className="text-slate-900 dark:text-white font-semibold">{act.entityName}</strong>
        </span>
      );
    }

    if (act.actionType === 'delete_project') {
      return (
        <span>
          Deleted project{' '}
          <strong className="text-slate-900 dark:text-white font-semibold">{act.entityName}</strong>
        </span>
      );
    }

    return (
      <span>
        Updated {act.entityType}{' '}
        <strong className="text-slate-900 dark:text-white font-semibold">{act.entityName}</strong>
      </span>
    );
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xs flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                Team Activities
              </h3>
              <span className="flex h-2 w-2 relative" title="Live updates active">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            </div>
            <p className="text-3xs text-slate-500 dark:text-slate-400">
              Live updates on tasks & projects
            </p>
          </div>
        </div>

        <button
          onClick={() => loadActivities(true)}
          disabled={isRefreshing}
          className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          title="Refresh activities"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 pt-3.5 pb-2 flex-wrap">
        <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
          {(['all', 'task', 'project'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                filter === f
                  ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-2xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {f === 'all' ? 'All Activity' : f === 'task' ? 'Tasks' : 'Projects'}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs font-medium text-slate-400">
          {filteredActivities.length} logs
        </span>
      </div>

      {/* Activity Timeline */}
      <div className="flex-1 overflow-y-auto mt-2 space-y-3.5 max-h-[580px] pr-1 scrollbar-thin">
        {isLoading ? (
          <div className="py-12 text-center text-xs text-slate-400">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
            Loading team activities...
          </div>
        ) : filteredActivities.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">
            No activity logs found.
          </div>
        ) : (
          filteredActivities.map((act) => {
            const badge = getActionBadge(act);
            const isClickable = !!(act.projectId && onSelectProject);

            return (
              <div
                key={act.id}
                onClick={() => {
                  if (isClickable && act.projectId) {
                    onSelectProject(act.projectId);
                  }
                }}
                className={`group relative flex items-start gap-3 p-2.5 rounded-xl border border-transparent transition-all ${
                  isClickable
                    ? 'hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:border-slate-200 dark:hover:border-slate-700 cursor-pointer'
                    : ''
                }`}
              >
                {/* User Avatar */}
                <div className="shrink-0 relative">
                  {act.userAvatar ? (
                    <img
                      src={act.userAvatar}
                      alt={act.userName}
                      className="w-7 h-7 rounded-full object-cover ring-2 ring-slate-100 dark:ring-slate-800"
                    />
                  ) : (
                    <div
                      style={{ backgroundColor: act.userColor || '#2563eb' }}
                      className="w-7 h-7 rounded-full text-white text-3xs font-bold flex items-center justify-center shadow-2xs ring-2 ring-slate-100 dark:ring-slate-800"
                    >
                      {getInitials(act.userName)}
                    </div>
                  )}
                  {/* Miniature action icon overlay */}
                  <span className="absolute -bottom-1 -right-1 p-0.5 rounded-full bg-white dark:bg-slate-900 shadow-2xs">
                    {badge.icon}
                  </span>
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                      {act.userName}
                    </span>
                    <span className="text-3xs text-slate-400 shrink-0 font-medium">
                      {formatTimeAgo(act.createdAt)}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-snug">
                    {renderActionText(act)}
                  </p>

                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <span
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-3xs font-semibold border ${badge.bg}`}
                    >
                      {badge.label}
                    </span>

                    {act.projectName && (
                      <span className="text-3xs text-slate-400 dark:text-slate-500 font-medium truncate max-w-[140px]">
                        📁 {act.projectName}
                      </span>
                    )}

                    {isClickable && (
                      <span className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-3xs text-blue-600 dark:text-blue-400 flex items-center gap-0.5 font-semibold">
                        View <ArrowRight className="w-2.5 h-2.5" />
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

