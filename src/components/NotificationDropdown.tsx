import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Bell,
  BellOff,
  CheckCheck,
  Check,
  Trash2,
  UserCheck,
  Eye,
  AlertOctagon,
  ArrowRight,
  X,
} from 'lucide-react';
import { InAppNotification, AuthUser, NotificationType } from '../types';
import { isNotificationForUser, isNotificationUnread } from '../utils/notificationUtils';

interface NotificationDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: InAppNotification[];
  currentUser: AuthUser | null;
  onMarkAsRead: (notificationId: string) => void;
  onMarkAllAsRead: () => void;
  onDismissNotification: (notificationId: string) => void;
  onOpenTask?: (taskId: string, projectId?: string) => void;
}

export const NotificationDropdown: React.FC<NotificationDropdownProps> = ({
  isOpen,
  onClose,
  notifications = [],
  currentUser,
  onMarkAsRead,
  onMarkAllAsRead,
  onDismissNotification,
  onOpenTask,
}) => {
  const [filterTab, setFilterTab] = useState<'all' | 'unread'>('all');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen, onClose]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Filter notifications relevant to current user
  const userNotifications = useMemo(() => {
    return notifications
      .filter((n) => isNotificationForUser(n, currentUser))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [notifications, currentUser]);

  const unreadCount = useMemo(() => {
    return userNotifications.filter((n) => isNotificationUnread(n, currentUser)).length;
  }, [userNotifications, currentUser]);

  const filteredNotifications = useMemo(() => {
    if (filterTab === 'unread') {
      return userNotifications.filter((n) => isNotificationUnread(n, currentUser));
    }
    return userNotifications;
  }, [userNotifications, filterTab, currentUser]);

  // Relative time formatter
  const formatTimeAgo = (dateStr: string) => {
    try {
      const now = new Date();
      const past = new Date(dateStr);
      const diffSecs = Math.max(0, Math.floor((now.getTime() - past.getTime()) / 1000));

      if (diffSecs < 60) return 'Just now';
      const diffMins = Math.floor(diffSecs / 60);
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays}d ago`;
      return past.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return 'Recently';
    }
  };

  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case 'task_assigned':
        return <UserCheck className="w-4 h-4 text-blue-500" />;
      case 'task_ready_review':
        return <Eye className="w-4 h-4 text-amber-500" />;
      case 'task_blocked':
        return <AlertOctagon className="w-4 h-4 text-rose-500" />;
      default:
        return <Bell className="w-4 h-4 text-slate-500" />;
    }
  };

  const getNotificationBadgeClass = (type: NotificationType) => {
    switch (type) {
      case 'task_assigned':
        return 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800';
      case 'task_ready_review':
        return 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800';
      case 'task_blocked':
        return 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800';
      default:
        return 'bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    }
  };

  const getNotificationTypeLabel = (type: NotificationType) => {
    switch (type) {
      case 'task_assigned':
        return 'Assigned';
      case 'task_ready_review':
        return 'Ready Review';
      case 'task_blocked':
        return 'Blocked';
      default:
        return 'Alert';
    }
  };

  const handleItemClick = (notif: InAppNotification) => {
    if (isNotificationUnread(notif, currentUser)) {
      onMarkAsRead(notif.id);
    }
    if (notif.taskId && onOpenTask) {
      onOpenTask(notif.taskId, notif.projectId);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={dropdownRef}
      id="inapp-notification-dropdown"
      className="absolute right-0 top-full mt-2 w-80 sm:w-96 max-w-[calc(100vw-1.5rem)] rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200/90 dark:border-slate-800 z-50 overflow-hidden flex flex-col text-slate-800 dark:text-slate-100 animate-in fade-in zoom-in-95 duration-150"
      role="menu"
      aria-label="Notification Center"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-800/40">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-100/80 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400">
            <Bell className="w-4 h-4" />
          </div>
          <h3 className="font-bold text-sm text-slate-900 dark:text-white">Notifications</h3>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 text-3xs font-bold rounded-full bg-rose-500 text-white tracking-wide">
              {unreadCount} new
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <button
              onClick={onMarkAllAsRead}
              title="Mark all as read"
              className="inline-flex items-center gap-1 px-2 py-1 text-2xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors cursor-pointer"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Mark read</span>
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close notifications"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs Filter */}
      <div className="flex items-center px-4 pt-2 pb-1 gap-2 border-b border-slate-100 dark:border-slate-800/60 bg-white dark:bg-slate-900">
        <button
          onClick={() => setFilterTab('all')}
          className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
            filterTab === 'all'
              ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'
              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          All ({userNotifications.length})
        </button>
        <button
          onClick={() => setFilterTab('unread')}
          className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
            filterTab === 'unread'
              ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'
              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <span>Unread</span>
          {unreadCount > 0 && (
            <span className="w-4 h-4 text-3xs font-bold rounded-full bg-rose-500 text-white flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Notification List Container */}
      <div className="overflow-y-auto max-h-[380px] divide-y divide-slate-100 dark:divide-slate-800/60">
        {filteredNotifications.length === 0 ? (
          <div className="py-10 px-4 text-center flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
              <BellOff className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              {filterTab === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-[220px]">
              {filterTab === 'unread'
                ? "You're all caught up! Check the All tab to review past alerts."
                : 'Alerts appear here when tasks are assigned, moved to Ready Review, or marked Blocked.'}
            </p>
          </div>
        ) : (
          filteredNotifications.map((notif) => {
            const unread = isNotificationUnread(notif, currentUser);
            return (
              <div
                key={notif.id}
                onClick={() => handleItemClick(notif)}
                className={`group relative p-3.5 sm:p-4 flex items-start gap-3 transition-colors cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60 ${
                  unread
                    ? 'bg-blue-50/40 dark:bg-blue-950/20'
                    : 'bg-white dark:bg-slate-900 opacity-90'
                }`}
              >
                {/* Left Type Icon / Indicator */}
                <div className="relative shrink-0 mt-0.5">
                  <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shadow-2xs border border-slate-200/60 dark:border-slate-700/60">
                    {getNotificationIcon(notif.type)}
                  </div>
                  {unread && (
                    <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pr-4">
                  <div className="flex items-center gap-1.5 flex-wrap mb-1">
                    <span
                      className={`inline-flex items-center px-1.5 py-0.5 text-3xs font-bold rounded-md border tracking-wide uppercase ${getNotificationBadgeClass(
                        notif.type
                      )}`}
                    >
                      {getNotificationTypeLabel(notif.type)}
                    </span>
                    {notif.projectName && (
                      <span className="text-3xs font-medium text-slate-400 dark:text-slate-500 truncate max-w-[120px]">
                        • {notif.projectName}
                      </span>
                    )}
                    <span className="text-3xs text-slate-400 dark:text-slate-500 ml-auto shrink-0">
                      {formatTimeAgo(notif.createdAt)}
                    </span>
                  </div>

                  <p
                    className={`text-xs leading-snug line-clamp-2 ${
                      unread
                        ? 'font-semibold text-slate-900 dark:text-white'
                        : 'font-normal text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {notif.message}
                  </p>

                  {notif.taskId && (
                    <div className="mt-1.5 flex items-center gap-1 text-2xs font-semibold text-blue-600 dark:text-blue-400 group-hover:underline">
                      <span>View task</span>
                      <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  )}
                </div>

                {/* Quick actions on hover */}
                <div
                  className="absolute right-2 top-2 hidden group-hover:flex items-center gap-1 bg-white/95 dark:bg-slate-800/95 p-1 rounded-lg shadow-sm border border-slate-200/80 dark:border-slate-700/80"
                  onClick={(e) => e.stopPropagation()}
                >
                  {unread ? (
                    <button
                      onClick={() => onMarkAsRead(notif.id)}
                      title="Mark as read"
                      className="p-1 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded transition-colors cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  ) : null}
                  <button
                    onClick={() => onDismissNotification(notif.id)}
                    title="Dismiss alert"
                    className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      {userNotifications.length > 0 && (
        <div className="p-2.5 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/40 text-center">
          <span className="text-2xs text-slate-400 dark:text-slate-500">
            Real-time handoff alerts for your team
          </span>
        </div>
      )}
    </div>
  );
};

