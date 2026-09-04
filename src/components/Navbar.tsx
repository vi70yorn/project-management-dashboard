import React from 'react';
import {
  LayoutDashboard,
  Plus,
  Layers,
  ChevronDown,
  Users,
  UserPlus,
  LogOut,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { Project, AuthUser } from '../types';

interface NavbarProps {
  currentView: 'dashboard' | 'project' | 'team';
  onGoToDashboard: () => void;
  onGoToTeam: () => void;
  projects: Project[];
  activeProject?: Project;
  onSelectProject: (projectId: string) => void;
  onOpenNewProject: () => void;
  onOpenAddMember: () => void;
  teamCount: number;
  currentUser?: AuthUser | null;
  onLogout?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onGoToDashboard,
  onGoToTeam,
  projects,
  activeProject,
  onSelectProject,
  onOpenNewProject,
  onOpenAddMember,
  teamCount,
  currentUser,
  onLogout,
}) => {
  const isAdmin = currentUser?.role === 'admin';

  return (
    <header
      id="main-navbar"
      className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Left: Brand & Main Navigation */}
        <div className="flex items-center gap-6">
          <div
            id="brand-logo-btn"
            onClick={onGoToDashboard}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs group-hover:bg-blue-700 transition-colors">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900 tracking-tight leading-none">
                Workspace PM
              </h1>
              <span className="text-2xs text-slate-500 font-medium leading-none">
                Projects & Team Tracker
              </span>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2 pl-4 border-l border-slate-200">
            {/* Dashboard summary tab */}
            <button
              id="nav-dashboard-summary-btn"
              onClick={onGoToDashboard}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                currentView === 'dashboard'
                  ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              Dashboard Summary
            </button>

            {/* Team management tab */}
            <button
              id="nav-team-management-btn"
              onClick={onGoToTeam}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                currentView === 'team'
                  ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Team Directory
              <span className="px-1.5 py-0.2 rounded-full text-3xs font-bold bg-slate-200/80 text-slate-700">
                {teamCount}
              </span>
            </button>

            {/* Quick Project Switcher */}
            <div className="relative group ml-1">
              <select
                id="nav-project-selector"
                value={activeProject?.id || ''}
                onChange={(e) => {
                  if (e.target.value) onSelectProject(e.target.value);
                }}
                className="appearance-none pl-3 pr-8 py-1.5 rounded-lg text-xs font-medium border border-slate-200 bg-white text-slate-700 hover:border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
              >
                <option value="" disabled>
                  Switch Project...
                </option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.status})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Right: Actions & User Role Profile */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Mobile view quick switcher */}
          <div className="flex md:hidden items-center gap-1">
            <button
              onClick={onGoToDashboard}
              className={`p-1.5 rounded-lg text-xs ${
                currentView === 'dashboard' ? 'bg-blue-100 text-blue-700' : 'text-slate-600'
              }`}
              title="Dashboard"
            >
              <LayoutDashboard className="w-4 h-4" />
            </button>
            <button
              onClick={onGoToTeam}
              className={`p-1.5 rounded-lg text-xs ${
                currentView === 'team' ? 'bg-blue-100 text-blue-700' : 'text-slate-600'
              }`}
              title="Team"
            >
              <Users className="w-4 h-4" />
            </button>
          </div>

          {/* Admin-only: Add Member */}
          {isAdmin && (
            <button
              id="nav-add-member-btn"
              onClick={onOpenAddMember}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold shadow-2xs transition-colors"
            >
              <UserPlus className="w-3.5 h-3.5 text-blue-600" />
              <span>Add Member</span>
            </button>
          )}

          {/* Admin-only: New Project */}
          {isAdmin && (
            <button
              id="open-new-project-modal-btn"
              onClick={onOpenNewProject}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>New Project</span>
            </button>
          )}

          {/* Current Logged In User Pill */}
          {currentUser && (
            <div
              id="navbar-user-profile"
              className="flex items-center gap-2 pl-2 sm:pl-3 border-l border-slate-200"
            >
              <div className="flex items-center gap-2">
                {currentUser.avatar ? (
                  <img
                    src={currentUser.avatar}
                    alt={currentUser.name}
                    className="w-8 h-8 rounded-full object-cover border border-slate-200 shadow-2xs shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center shadow-2xs shrink-0">
                    {currentUser.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="hidden lg:block text-left min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-900 truncate max-w-[120px]">
                      {currentUser.name}
                    </span>
                    <span
                      id="navbar-user-role-badge"
                      className={`inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-3xs font-bold uppercase tracking-wider ${
                        isAdmin
                          ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      }`}
                    >
                      {isAdmin ? (
                        <ShieldCheck className="w-2.5 h-2.5" />
                      ) : (
                        <UserCheck className="w-2.5 h-2.5" />
                      )}
                      {currentUser.role}
                    </span>
                  </div>
                  <p className="text-3xs text-slate-500 truncate max-w-[130px]">
                    {currentUser.email}
                  </p>
                </div>
              </div>

              {onLogout && (
                <button
                  id="navbar-logout-btn"
                  onClick={onLogout}
                  title={`Sign out (${currentUser.name})`}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
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
