import React, { useState, useMemo, useEffect } from 'react';
import {
  LayoutDashboard,
  Plus,
  Users,
  UserPlus,
  ShieldCheck,
  UserCheck,
  Database,
  User,
  Sun,
  Moon,
  FileSpreadsheet,
  Calendar as CalendarIcon,
  Search,
  Bell,
} from 'lucide-react';
import { Project, AuthUser, ViewType, InAppNotification } from '../types';
import { NotificationDropdown } from './NotificationDropdown';
import { isNotificationForUser, isNotificationUnread } from '../utils/notificationUtils';

interface NavbarProps {
  currentView: ViewType;
  onGoToDashboard: () => void;
  onGoToTeam: () => void;
  onGoToSummary: () => void;
  onGoToCalendar?: () => void;
  onGoToRecycleBin?: () => void;
  projects: Project[];
  activeProject?: Project;
  onSelectProject: (projectId: string) => void;
  onOpenNewProject: () => void;
  onOpenAddMember: () => void;
  teamCount: number;
  currentUser?: AuthUser | null;
  onLogout?: () => void;
  onOpenResetPassword?: () => void;
  onOpenEditProfile?: () => void;
  dbHealth?: { connected: boolean; database?: string } | null;
  onOpenDbModal?: () => void;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
  recycleBinCount?: number;
  onOpenRecycleBin?: () => void;
  onOpenTeamActivities?: () => void;
  isTeamActivitiesOpen?: boolean;
  onOpenCommandPalette?: () => void;
  notifications?: InAppNotification[];
  onMarkNotificationAsRead?: (id: string) => void;
  onMarkAllNotificationsAsRead?: () => void;
  onDismissNotification?: (id: string) => void;
  onOpenTaskFromNotification?: (taskId: string, projectId?: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onGoToDashboard,
  onGoToTeam,
  onGoToSummary,
  onGoToCalendar,
  onGoToRecycleBin,
  projects,
  activeProject,
  onSelectProject,
  onOpenNewProject,
  onOpenAddMember,
  teamCount,
  currentUser,
  onLogout,
  onOpenResetPassword,
  onOpenEditProfile,
  dbHealth,
  onOpenDbModal,
  theme = 'light',
  onToggleTheme,
  recycleBinCount = 0,
  onOpenRecycleBin,
  onOpenTeamActivities,
  isTeamActivitiesOpen = false,
  onOpenCommandPalette,
  notifications = [],
  onMarkNotificationAsRead,
  onMarkAllNotificationsAsRead,
  onDismissNotification,
  onOpenTaskFromNotification,
}) => {
  const isAdmin = currentUser?.role === 'admin';
  const handleRecycleBinAction = onGoToRecycleBin || onOpenRecycleBin;
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  // Scroll detection: Hide navbar when scrolling down, show when scrolling up
  useEffect(() => {
    let lastScrollY = typeof window !== 'undefined' ? window.scrollY : 0;
    let ticking = false;

    const handleScroll = () => {
      if (ticking) return;

      window.requestAnimationFrame(() => {
        const currentScrollY = window.scrollY;
        const scrollHeight = document.documentElement.scrollHeight;
        const clientHeight = window.innerHeight;

        // Always show navbar at or near the top of the page (within 60px)
        if (currentScrollY <= 60) {
          setIsVisible(true);
          lastScrollY = currentScrollY;
          ticking = false;
          return;
        }

        // Avoid false triggers on elastic overscroll bounce past bottom of document
        if (currentScrollY + clientHeight >= scrollHeight - 20) {
          ticking = false;
          return;
        }

        const diff = currentScrollY - lastScrollY;

        // Threshold of 8px to prevent jitter from trackpad micro-movements
        if (Math.abs(diff) >= 8) {
          if (diff > 0 && currentScrollY > 80) {
            // Scrolling down -> hide navbar & close open dropdown
            setIsVisible(false);
            setIsNotificationOpen(false);
          } else if (diff < 0) {
            // Scrolling up -> show navbar
            setIsVisible(true);
          }
          lastScrollY = currentScrollY;
        }

        ticking = false;
      });

      ticking = true;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Ensure navbar is visible when switching view or active project
  useEffect(() => {
    setIsVisible(true);
  }, [currentView, activeProject?.id]);

  // Unread badge count for current user
  const unreadNotificationCount = useMemo(() => {
    if (!notifications || !Array.isArray(notifications)) return 0;
    return notifications.filter(
      (notif) => isNotificationForUser(notif, currentUser) && isNotificationUnread(notif, currentUser)
    ).length;
  }, [notifications, currentUser]);

  return (
    <header
      id="main-navbar"
      className={`sticky top-0 z-40 w-full bg-white/75 dark:bg-slate-900/65 backdrop-blur-xl backdrop-saturate-150 border-b border-slate-200/80 dark:border-white/10 text-slate-800 dark:text-white shadow-[0_4px_30px_rgba(0,0,0,0.04),inset_0_1px_0_0_rgba(255,255,255,0.9)] dark:shadow-[0_4px_30px_rgba(0,0,0,0.4),inset_0_1px_0_0_rgba(255,255,255,0.08)] transition-transform duration-300 ease-in-out will-change-transform ${
        isVisible ? 'translate-y-0' : '-translate-y-full pointer-events-none'
      }`}
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2 sm:gap-4">
        {/* Left: Brand & Main Navigation */}
        <div className="flex items-center gap-2.5 sm:gap-6 shrink-0">
          <div
            id="brand-logo-btn"
            onClick={onGoToDashboard}
            className="flex items-center gap-2 cursor-pointer group select-none shrink-0"
          >
            <img
              src="/favicon.svg"
              alt="UX/UI Task Tracking"
              className="w-8 h-8 sm:w-9 sm:h-9 shadow-xs group-hover:scale-105 transition-transform shrink-0"
            />
            <div className="h-9 flex flex-col justify-center -translate-y-0.5">
              <span className="text-sm font-bold text-slate-900 dark:text-white tracking-tight leading-none">
                UX/UI
              </span>
              <span className="text-2xs text-slate-500 dark:text-slate-400 font-medium leading-none mt-1 hidden min-[400px]:inline">
                Task Tracking
              </span>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-1.5 sm:gap-2 pl-4 border-l border-slate-200/80 dark:border-white/10">
            {/* Dashboard summary tab */}
            <button
              id="nav-dashboard-summary-btn"
              onClick={onGoToDashboard}
              title="Dashboard"
              className={`group inline-flex items-center px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer ${
                currentView === 'dashboard'
                  ? 'bg-blue-600 text-white shadow-xs dark:bg-blue-600 dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 dark:text-slate-300 dark:hover:text-white dark:hover:bg-white/10'
              }`}
            >
              <LayoutDashboard className="w-4 h-4 shrink-0" />
              <span
                className={`transition-all duration-200 whitespace-nowrap overflow-hidden ${
                  currentView === 'dashboard'
                    ? 'max-w-44 opacity-100 ml-1.5'
                    : 'max-w-0 opacity-0 ml-0 group-hover:max-w-44 group-hover:opacity-100 group-hover:ml-1.5'
                }`}
              >
                Dashboard
              </span>
            </button>

            {/* Calendar & Timeline View tab */}
            {onGoToCalendar && (
              <button
                id="nav-calendar-btn"
                onClick={onGoToCalendar}
                title="Calendar & Project/Task Timeline"
                className={`group inline-flex items-center px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer ${
                  currentView === 'calendar'
                    ? 'bg-blue-600 text-white shadow-xs dark:bg-blue-600 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 dark:text-slate-300 dark:hover:text-white dark:hover:bg-white/10'
                }`}
              >
                <CalendarIcon className="w-4 h-4 shrink-0" />
                <span
                  className={`transition-all duration-200 whitespace-nowrap overflow-hidden ${
                    currentView === 'calendar'
                      ? 'max-w-44 opacity-100 ml-1.5'
                      : 'max-w-0 opacity-0 ml-0 group-hover:max-w-44 group-hover:opacity-100 group-hover:ml-1.5'
                  }`}
                >
                  Calendar
                </span>
              </button>
            )}

            {/* Team management tab */}
            <button
              id="nav-team-management-btn"
              onClick={onGoToTeam}
              title="Team Management"
              className={`group inline-flex items-center px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer ${
                currentView === 'team'
                  ? 'bg-blue-600 text-white shadow-xs dark:bg-blue-600 dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 dark:text-slate-300 dark:hover:text-white dark:hover:bg-white/10'
              }`}
            >
              <Users className="w-4 h-4 shrink-0" />
              <span
                className={`inline-flex items-center gap-1.5 transition-all duration-200 whitespace-nowrap overflow-hidden ${
                  currentView === 'team'
                    ? 'max-w-44 opacity-100 ml-1.5'
                    : 'max-w-0 opacity-0 ml-0 group-hover:max-w-44 group-hover:opacity-100 group-hover:ml-1.5'
                }`}
              >
                <span>Team</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-3xs font-bold ${
                    currentView === 'team'
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-100 text-slate-600 border border-slate-200/80 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                  }`}
                >
                  {teamCount}
                </span>
              </span>
            </button>

            {/* Project Weekly Summary tab (Admin only) */}
            {isAdmin && (
              <button
                id="nav-project-summary-btn"
                onClick={onGoToSummary}
                title="Project Weekly Summary & Reports"
                className={`group inline-flex items-center px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer ${
                  currentView === 'summary'
                    ? 'bg-blue-600 text-white shadow-xs dark:bg-blue-600 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 dark:text-slate-300 dark:hover:text-white dark:hover:bg-white/10'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4 shrink-0" />
                <span
                  className={`transition-all duration-200 whitespace-nowrap overflow-hidden ${
                    currentView === 'summary'
                      ? 'max-w-44 opacity-100 ml-1.5'
                      : 'max-w-0 opacity-0 ml-0 group-hover:max-w-44 group-hover:opacity-100 group-hover:ml-1.5'
                  }`}
                >
                  Weekly Summary
                </span>
              </button>
            )}

            {/* Recycle Bin tab */}
           {/*  {handleRecycleBinAction && (
              <button
                id="nav-recycle-bin-tab-btn"
                onClick={handleRecycleBinAction}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  currentView === 'recycle-bin'
                    ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50/70 dark:hover:bg-rose-950/40'
                }`}
                title="Recycle Bin (Kept for 1 week / 7 days)"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
                <span>Recycle Bin</span>
                {recycleBinCount > 0 && (
                  <span
                    id="nav-recycle-bin-tab-badge"
                    className="px-1.5 py-0.2 rounded-full text-3xs font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
                  >
                    {recycleBinCount}
                  </span>
                )}
              </button>
            )} */}
          </div>
        </div>

        {/* Right: Actions & User Role Profile */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Mobile view quick switcher */}
          <div className="flex md:hidden items-center gap-1">
            {onOpenCommandPalette && (
              <button
                onClick={onOpenCommandPalette}
                className="p-1.5 rounded-lg text-xs transition-colors text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/10 cursor-pointer"
                title="Search / Command Palette (Ctrl+K)"
              >
                <Search className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onGoToDashboard}
              className={`p-1.5 rounded-lg text-xs transition-colors ${
                currentView === 'dashboard'
                  ? 'bg-blue-600 text-white shadow-xs dark:bg-blue-600 dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/10'
              }`}
              title="Dashboard"
            >
              <LayoutDashboard className="w-4 h-4" />
            </button>
            <button
              onClick={onGoToTeam}
              className={`p-1.5 rounded-lg text-xs transition-colors ${
                currentView === 'team'
                  ? 'bg-blue-600 text-white shadow-xs dark:bg-blue-600 dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/10'
              }`}
              title="Team"
            >
              <Users className="w-4 h-4" />
            </button>
            {isAdmin && (
              <button
                onClick={onGoToSummary}
                className={`p-1.5 rounded-lg text-xs transition-colors ${
                  currentView === 'summary'
                    ? 'bg-blue-600 text-white shadow-xs dark:bg-blue-600 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/10'
                }`}
                title="Project Weekly Summary"
              >
                <FileSpreadsheet className="w-4 h-4" />
              </button>
            )}
            {onGoToCalendar && (
              <button
                onClick={onGoToCalendar}
                className={`p-1.5 rounded-lg text-xs transition-colors ${
                  currentView === 'calendar'
                    ? 'bg-blue-600 text-white shadow-xs dark:bg-blue-600 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/10'
                }`}
                title="Calendar"
              >
                <CalendarIcon className="w-4 h-4" />
              </button>
            )}
            {/* Mobile Notification Bell */}
            <button
              id="nav-mobile-notifications-btn"
              onClick={() => setIsNotificationOpen((prev) => !prev)}
              className={`relative p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                isNotificationOpen
                  ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-300'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/10'
              }`}
              title={`Notifications${unreadNotificationCount > 0 ? ` (${unreadNotificationCount} unread)` : ''}`}
              aria-label="Open notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadNotificationCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-0.5 bg-rose-600 text-white text-3xs font-bold rounded-full flex items-center justify-center ring-1 ring-white dark:ring-slate-900 animate-pulse">
                  {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
                </span>
              )}
            </button>
          </div>

          {/* Quick Command Palette (Cmd + K / Ctrl + K) Button */}
          {onOpenCommandPalette && (
            <button
              id="navbar-command-palette-btn"
              onClick={onOpenCommandPalette}
              title="Quick Command Palette (Ctrl+K or Cmd+K)"
              className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-100/80 hover:bg-slate-200/70 dark:bg-white/5 dark:hover:bg-white/10 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white text-xs font-medium border border-slate-200/80 dark:border-white/10 transition-all cursor-pointer shadow-2xs group backdrop-blur-xs"
              aria-label="Open Command Palette"
            >
              <Search className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 dark:text-slate-400 dark:group-hover:text-white transition-colors" />
              <span className="hidden lg:inline text-2xs text-slate-500 group-hover:text-slate-700 dark:text-slate-400 dark:group-hover:text-white font-normal">
                Quick search...
              </span>
              <kbd className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-3xs font-mono font-bold bg-white dark:bg-black/30 text-slate-500 dark:text-slate-400 rounded border border-slate-200 dark:border-slate-700 shadow-2xs">
                <span>⌘</span>K
              </kbd>
            </button>
          )}

          {/* Notification Center (Bell Icon in Header) */}
          <div className="relative">
            <button
              id="navbar-notifications-btn"
              onClick={() => setIsNotificationOpen((prev) => !prev)}
              title={`Notification Center${unreadNotificationCount > 0 ? ` (${unreadNotificationCount} unread)` : ''}`}
              className={`relative p-2 rounded-xl transition-all cursor-pointer border ${
                isNotificationOpen
                  ? 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/70 dark:text-blue-300 dark:border-blue-700 shadow-2xs'
                  : 'text-slate-600 hover:text-blue-600 hover:bg-slate-100/80 dark:text-slate-400 dark:hover:text-blue-400 dark:hover:bg-white/10 border-transparent hover:border-slate-200/80 dark:hover:border-white/10'
              }`}
              aria-label="Open Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadNotificationCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 bg-rose-600 text-white text-3xs font-bold rounded-full flex items-center justify-center ring-2 ring-white dark:ring-slate-900 shadow-xs animate-pulse">
                  {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
                </span>
              )}
            </button>

            {/* Notification Dropdown Panel */}
            <NotificationDropdown
              isOpen={isNotificationOpen}
              onClose={() => setIsNotificationOpen(false)}
              notifications={notifications}
              currentUser={currentUser || null}
              onMarkAsRead={onMarkNotificationAsRead || (() => {})}
              onMarkAllAsRead={onMarkAllNotificationsAsRead || (() => {})}
              onDismissNotification={onDismissNotification || (() => {})}
              onOpenTask={onOpenTaskFromNotification}
            />
          </div>

          {/* Current Logged In User Pill */}
          {currentUser && (
            <div 
              id="navbar-user-profile"
              className="flex items-center gap-2 pl-2 sm:pl-3 border-l border-slate-200/80 dark:border-white/10"
            >
              <button
                type="button"
                id="navbar-user-profile-btn"
                onClick={onOpenEditProfile}
                title="Update your user profile & info"
                className="flex items-center gap-2 p-1 -m-1 sm:px-2 sm:py-1 rounded-xl hover:bg-slate-100/80 dark:hover:bg-white/10 transition-colors cursor-pointer group text-left"
              >
                <div className="relative shrink-0">
                  {currentUser.avatar ? (
                    <img
                      src={currentUser.avatar}
                      alt={currentUser.name}
                      className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-white/15 shadow-2xs shrink-0 group-hover:ring-2 group-hover:ring-blue-400/40 dark:group-hover:ring-white/40 transition-all"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-slate-800 text-blue-700 dark:text-white font-bold text-xs flex items-center justify-center shadow-2xs shrink-0 border border-slate-200 dark:border-white/15 group-hover:ring-2 group-hover:ring-blue-400/40 dark:group-hover:ring-white/40 transition-all">
                      {currentUser.name.slice(0, 2).toUpperCase()}                    
                    </div>
                  )}
                  {/* Role indicator badge for compact screens */}
                  <span
                    className={`lg:hidden absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center text-3xs border border-white dark:border-slate-900 shadow-xs ${
                      currentUser.role === 'admin'
                        ? 'bg-amber-500 text-white'
                        : 'bg-emerald-500 text-white'
                    }`}
                    title={`Role: ${currentUser.role === 'admin' ? 'Admin' : 'Staff'}`}
                  >
                    {currentUser.role === 'admin' ? (
                      <ShieldCheck className="w-2.5 h-2.5" />
                    ) : (
                      <UserCheck className="w-2.5 h-2.5" />
                    )}
                  </span>
                </div>
                <div className="hidden lg:block text-left min-w-0">
                  <div className="flex items-center gap-1.5">                    
                    <span className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-300 truncate max-w-[105px] transition-colors">
                      {currentUser.name}                     
                    </span>
                    <span
                      id="navbar-user-role-badge"
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-3xs font-bold rounded-md border shadow-2xs shrink-0 tracking-wide uppercase ${
                        currentUser.role === 'admin'
                          ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-700/60'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-700/60'
                      }`}
                    >
                      {currentUser.role === 'admin' ? (
                        <ShieldCheck className="w-2.5 h-2.5 text-amber-600 dark:text-amber-300 shrink-0" />
                      ) : (
                        <UserCheck className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-300 shrink-0" />
                      )}
                      {currentUser.role === 'admin' ? 'Admin' : 'Staff'}
                    </span>
                  </div>
                  <p className="text-3xs text-slate-500 dark:text-slate-400 truncate max-w-[140px]">
                    {currentUser.username ? `@${currentUser.username}` : currentUser.email}
                  </p>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
