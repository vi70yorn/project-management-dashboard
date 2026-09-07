import React from 'react';
import {
  LayoutDashboard,
  Plus,
  Users,
  UserPlus,
  LogOut,
  ShieldCheck,
  UserCheck,
  Database,
  KeyRound,
  User,
  Sun,
  Moon,
  FileSpreadsheet,
  Trash2,
  Calendar as CalendarIcon,
  Activity,
} from 'lucide-react';
import { Project, AuthUser, ViewType } from '../types';

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
}) => {
  const isAdmin = currentUser?.role === 'admin';
  const handleRecycleBinAction = onGoToRecycleBin || onOpenRecycleBin;

  return (
    <header
      id="main-navbar"
      className="sticky top-0 z-30 bg-blue-700 dark:bg-slate-900 backdrop-blur-md border-b border-blue-800 dark:border-slate-800 text-white shadow-md transition-colors"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Left: Brand & Main Navigation */}
        <div className="flex items-center gap-6">
          <div
            id="brand-logo-btn"
            onClick={onGoToDashboard}
            className="flex items-center gap-2.5 cursor-pointer group select-none"
          >
            <img
              src="/favicon.svg"
              alt="UX/UI Task Tracking"
              className="w-9 h-9 rounded-xl shadow-xs group-hover:scale-105 transition-transform shrink-0"
            />
            <div className="h-9 flex flex-col justify-center -translate-y-0.5">
              <span className="text-sm font-bold text-white tracking-tight leading-none">
                UX/UI
              </span>
              <span className="text-2xs text-blue-100 dark:text-slate-400 font-medium leading-none mt-1">
                Task Tracking
              </span>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2 pl-4 border-l border-blue-600/60 dark:border-slate-800">
            {/* Dashboard summary tab */}
            <button
              id="nav-dashboard-summary-btn"
              onClick={onGoToDashboard}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                currentView === 'dashboard'
                  ? 'bg-white text-blue-800 dark:bg-blue-600 dark:text-white dark:border dark:border-blue-500 shadow-xs'
                  : 'text-blue-100 hover:text-white hover:bg-blue-600/60 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              Dashboard
            </button>

            {/* Calendar & Timeline View tab */}
            {onGoToCalendar && (
              <button
                id="nav-calendar-btn"
                onClick={onGoToCalendar}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  currentView === 'calendar'
                    ? 'bg-white text-blue-800 dark:bg-blue-600 dark:text-white dark:border dark:border-blue-500 shadow-xs'
                    : 'text-blue-100 hover:text-white hover:bg-blue-600/60 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800'
                }`}
                title="Calendar & Project/Task Timeline"
              >
                <CalendarIcon className="w-3.5 h-3.5" />
                Calendar
              </button>
            )}

            {/* Team management tab */}
            <button
              id="nav-team-management-btn"
              onClick={onGoToTeam}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                currentView === 'team'
                  ? 'bg-white text-blue-800 dark:bg-blue-600 dark:text-white dark:border dark:border-blue-500 shadow-xs'
                  : 'text-blue-100 hover:text-white hover:bg-blue-600/60 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Team
              <span
                className={`px-1.5 py-0.2 rounded-full text-3xs font-bold ${
                  currentView === 'team'
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-700 dark:text-white'
                    : 'bg-blue-800/80 text-blue-100 border border-blue-600/50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                }`}
              >
                {teamCount}
              </span>
            </button>

            {/* Project Weekly Summary tab */}
            <button
              id="nav-project-summary-btn"
              onClick={onGoToSummary}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                currentView === 'summary'
                  ? 'bg-white text-blue-800 dark:bg-blue-600 dark:text-white dark:border dark:border-blue-500 shadow-xs'
                  : 'text-blue-100 hover:text-white hover:bg-blue-600/60 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800'
              }`}
              title="Project Weekly Summary (Mon - Fri) for Project Manager"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Summary
            </button>

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
            <button
              onClick={onGoToDashboard}
              className={`p-1.5 rounded-lg text-xs transition-colors ${
                currentView === 'dashboard'
                  ? 'bg-white text-blue-800 dark:bg-blue-600 dark:text-white shadow-xs'
                  : 'text-blue-100 hover:text-white hover:bg-blue-600/60 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800'
              }`}
              title="Dashboard"
            >
              <LayoutDashboard className="w-4 h-4" />
            </button>
            <button
              onClick={onGoToTeam}
              className={`p-1.5 rounded-lg text-xs transition-colors ${
                currentView === 'team'
                  ? 'bg-white text-blue-800 dark:bg-blue-600 dark:text-white shadow-xs'
                  : 'text-blue-100 hover:text-white hover:bg-blue-600/60 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800'
              }`}
              title="Team"
            >
              <Users className="w-4 h-4" />
            </button>
            <button
              onClick={onGoToSummary}
              className={`p-1.5 rounded-lg text-xs transition-colors ${
                currentView === 'summary'
                  ? 'bg-white text-blue-800 dark:bg-blue-600 dark:text-white shadow-xs'
                  : 'text-blue-100 hover:text-white hover:bg-blue-600/60 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800'
              }`}
              title="Project Weekly Summary"
            >
              <FileSpreadsheet className="w-4 h-4" />
            </button>
            {onGoToCalendar && (
              <button
                onClick={onGoToCalendar}
                className={`p-1.5 rounded-lg text-xs transition-colors ${
                  currentView === 'calendar'
                    ? 'bg-white text-blue-800 dark:bg-blue-600 dark:text-white shadow-xs'
                    : 'text-blue-100 hover:text-white hover:bg-blue-600/60 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800'
                }`}
                title="Calendar"
              >
                <CalendarIcon className="w-4 h-4" />
              </button>
            )}
            {handleRecycleBinAction && (
              <button
                id="nav-mobile-recycle-bin-btn"
                onClick={handleRecycleBinAction}
                className={`relative p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                  currentView === 'recycle-bin'
                    ? 'bg-rose-800 text-white dark:bg-rose-950/60 dark:text-rose-300'
                    : 'text-blue-100 hover:text-white hover:bg-blue-600/60 dark:text-slate-400 dark:hover:text-rose-400 dark:hover:bg-rose-950/40'
                }`}
                title={`Recycle Bin${recycleBinCount > 0 ? ` (${recycleBinCount})` : ''}`}
              >
                <Trash2 className="w-4 h-4" />
                {recycleBinCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-0.5 bg-rose-600 text-white text-3xs font-bold rounded-full flex items-center justify-center ring-1 ring-blue-700 dark:ring-slate-900">
                    {recycleBinCount > 9 ? '9+' : recycleBinCount}
                  </span>
                )}
              </button>
            )}
            {onOpenTeamActivities && (
              <button
                id="nav-mobile-team-activities-btn"
                onClick={onOpenTeamActivities}
                className={`relative p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                  isTeamActivitiesOpen
                    ? 'bg-blue-800 text-white dark:bg-blue-950/60 dark:text-blue-300'
                    : 'text-blue-100 hover:text-white hover:bg-blue-600/60 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800'
                }`}
                title="Team Activities"
              >
                <Activity className="w-4 h-4" />
                <span className="absolute top-0.5 right-0.5 flex h-1.5 w-1.5">
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400"></span>
                </span>
              </button>
            )}
          </div>

          {/* Light / Dark Mode Toggle Button */}
          {onToggleTheme && (
            <button
              id="navbar-theme-toggle-btn"
              onClick={onToggleTheme}
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              className="p-2 rounded-xl text-blue-100 hover:text-amber-200 hover:bg-blue-600/60 dark:text-slate-400 dark:hover:text-amber-300 dark:hover:bg-slate-800 transition-all cursor-pointer border border-transparent hover:border-blue-500/40 dark:hover:border-slate-700"
              aria-label="Toggle theme mode"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-300 dark:text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-blue-100 dark:text-slate-300" />
              )}
            </button>
          )}

          {/* Recycle Bin Button */}
          {handleRecycleBinAction && (
            <button
              id="navbar-recycle-bin-btn"
              onClick={handleRecycleBinAction}
              title={`Recycle Bin (Retention: 7 days)${recycleBinCount ? ` • ${recycleBinCount} items` : ''}`}
              className={`relative p-2 rounded-xl transition-all cursor-pointer border ${
                currentView === 'recycle-bin'
                  ? 'bg-rose-800 text-white border-rose-600 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800 shadow-2xs'
                  : 'text-blue-100 hover:text-white hover:bg-blue-600/60 dark:text-slate-400 dark:hover:text-rose-400 dark:hover:bg-rose-950/40 border-transparent hover:border-blue-500/40 dark:hover:border-rose-800/60'
              }`}
              aria-label="Open Recycle Bin"
            >
              <Trash2 className="w-4 h-4" />
              {recycleBinCount > 0 && (
                <span
                  id="navbar-recycle-bin-badge"
                  className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 bg-rose-600 text-white text-3xs font-bold rounded-full flex items-center justify-center ring-2 ring-blue-700 dark:ring-slate-900 shadow-2xs leading-none"
                >
                  {recycleBinCount > 99 ? '99+' : recycleBinCount}
                </span>
              )}
            </button>
          )}

          {/* Team Activities Slide-over Trigger Button */}
          {onOpenTeamActivities && (
            <button
              id="navbar-team-activities-btn"
              onClick={onOpenTeamActivities}
              title="Team Activities (Live update feed)"
              className={`relative p-2 rounded-xl transition-all cursor-pointer border ${
                isTeamActivitiesOpen
                  ? 'bg-blue-800 text-white border-blue-500 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800 shadow-2xs'
                  : 'text-blue-100 hover:text-white hover:bg-blue-600/60 dark:text-slate-400 dark:hover:text-blue-400 dark:hover:bg-slate-800 border-transparent hover:border-blue-500/40 dark:hover:border-slate-700'
              }`}
              aria-label="Open Team Activities"
            >
              <Activity className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
              </span>
            </button>
          )}

          {/* Current Logged In User Pill */}
          {currentUser && (
            <div
              id="navbar-user-profile"
              className="flex items-center gap-2 pl-2 sm:pl-3 border-l border-blue-600/60 dark:border-slate-800"
            >
              <div className="flex items-center gap-2">
                {currentUser.avatar ? (
                  <img
                    src={currentUser.avatar}
                    alt={currentUser.name}
                    className="w-8 h-8 rounded-full object-cover border border-blue-500/60 dark:border-slate-700 shadow-2xs shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-blue-800 dark:bg-slate-800 text-white font-bold text-xs flex items-center justify-center shadow-2xs shrink-0 border border-blue-500/60 dark:border-slate-700">
                    {currentUser.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="hidden lg:block text-left min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-white truncate max-w-[120px]">
                      {currentUser.name}
                    </span>
                  </div>
                  <p className="text-3xs text-blue-100 dark:text-slate-400 truncate max-w-[130px]">
                    {currentUser.username ? `@${currentUser.username}` : currentUser.email}
                  </p>
                </div>
              </div>

              {onOpenEditProfile && (
                <button
                  id="navbar-edit-profile-btn"
                  onClick={onOpenEditProfile}
                  title="Update your user profile & info"
                  className="p-1.5 text-blue-100 hover:text-white hover:bg-blue-600/60 dark:text-slate-400 dark:hover:text-blue-400 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                >
                  <User className="w-4 h-4" />
                </button>
              )}

              {onOpenResetPassword && (
                <button
                  id="navbar-change-password-btn"
                  onClick={onOpenResetPassword}
                  title="Reset your password"
                  className="p-1.5 text-blue-100 hover:text-white hover:bg-blue-600/60 dark:text-slate-400 dark:hover:text-blue-400 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                >
                  <KeyRound className="w-4 h-4" />
                </button>
              )}

              {onLogout && (
                <button
                  id="navbar-logout-btn"
                  onClick={onLogout}
                  title={`Sign out (${currentUser.name})`}
                  className="p-1.5 text-blue-100 hover:text-white hover:bg-rose-600/80 dark:text-slate-400 dark:hover:text-rose-400 dark:hover:bg-rose-950/50 rounded-lg transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
