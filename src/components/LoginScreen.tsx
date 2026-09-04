import React, { useState } from 'react';
import {
  ShieldCheck,
  UserCheck,
  Lock,
  Mail,
  ArrowRight,
  FolderKanban,
  CheckCircle2,
  Users,
  KeyRound,
  Sparkles,
} from 'lucide-react';
import { AuthUser, TeamMember, UserRole } from '../types';
import { FORM_STYLES } from '../utils/formStyles';

interface LoginScreenProps {
  onLogin: (user: AuthUser) => void;
  teamMembers: TeamMember[];
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, teamMembers }) => {
  const [activeTab, setActiveTab] = useState<'quick' | 'custom'>('quick');
  const [customEmail, setCustomEmail] = useState('');
  const [customPassword, setCustomPassword] = useState('••••••••');
  const [customRole, setCustomRole] = useState<UserRole>('admin');
  const [customName, setCustomName] = useState('');
  const [customMemberId, setCustomMemberId] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState('');

  // Find admin & staff members for quick login
  const adminMembers = teamMembers.filter((m) => m.systemRole === 'admin');
  const staffMembers = teamMembers.filter((m) => m.systemRole === 'staff');

  const defaultAdmin = adminMembers[0] || {
    id: 'mem-1',
    name: 'Alex Morgan',
    email: 'alex.morgan@team.org',
    role: 'Project Manager & Lead',
    systemRole: 'admin',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    department: 'Engineering',
  };

  const defaultStaff = staffMembers[0] || {
    id: 'mem-2',
    name: 'Samantha Wu',
    email: 'samantha.wu@team.org',
    role: 'Senior Full-Stack Engineer',
    systemRole: 'staff',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
    department: 'Engineering',
  };

  const handleQuickLogin = (member: TeamMember) => {
    const user: AuthUser = {
      id: `usr-${member.id}`,
      name: member.name,
      email: member.email,
      role: member.systemRole || 'staff',
      memberId: member.id,
      avatar: member.avatar,
      department: member.department,
      jobRole: member.role,
    };
    onLogin(user);
  };

  const handleCustomLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customEmail.trim()) {
      setErrorMsg('Please enter a valid email address');
      return;
    }

    // Check if matches an existing member
    const existingMember = teamMembers.find(
      (m) => m.email.toLowerCase() === customEmail.trim().toLowerCase()
    );

    if (existingMember) {
      handleQuickLogin(existingMember);
      return;
    }

    // Otherwise create custom user session
    const derivedName =
      customName.trim() ||
      customEmail
        .split('@')[0]
        .split('.')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');

    const user: AuthUser = {
      id: `usr-${Date.now()}`,
      name: derivedName,
      email: customEmail.trim(),
      role: customRole,
      memberId: customMemberId || (customRole === 'admin' ? defaultAdmin.id : defaultStaff.id),
      department: 'Operations',
      jobRole: customRole === 'admin' ? 'System Administrator' : 'Staff Specialist',
    };
    onLogin(user);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Subtle background ambient glow */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200/80 overflow-hidden relative z-10 animate-in fade-in zoom-in-95 duration-200">
        {/* Header Branding */}
        <div className="bg-slate-900 text-white p-6 sm:p-8 relative">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md ring-4 ring-blue-500/20">
              <FolderKanban className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white">ProjectFlow</h1>
                <span className="px-2 py-0.5 rounded-full text-3xs font-semibold uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  v2.5 RBAC
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Enterprise Project & Deliverables Management Portal
              </p>
            </div>
          </div>

          <div className="mt-6 flex gap-2 p-1 bg-slate-800/80 rounded-xl border border-slate-700/60 text-xs">
            <button
              id="login-tab-quick"
              type="button"
              onClick={() => {
                setActiveTab('quick');
                setErrorMsg('');
              }}
              className={`flex-1 py-2 px-3 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'quick'
                  ? 'bg-blue-600 text-white shadow-sm font-semibold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              1-Click Role Login
            </button>
            <button
              id="login-tab-custom"
              type="button"
              onClick={() => {
                setActiveTab('custom');
                setErrorMsg('');
              }}
              className={`flex-1 py-2 px-3 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'custom'
                  ? 'bg-blue-600 text-white shadow-sm font-semibold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              Credentials Login
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-6 sm:p-8 space-y-6">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs font-medium flex items-center gap-2 animate-in fade-in">
              <span className="w-2 h-2 rounded-full bg-rose-600" />
              {errorMsg}
            </div>
          )}

          {activeTab === 'quick' ? (
            <div className="space-y-5">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Select a Role to Enter Workspace
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Test the exact experience and permissions granted to each role:
                </p>
              </div>

              {/* Two Primary Action Cards: Admin & Staff */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Admin Card */}
                <div className="border-2 border-indigo-200 hover:border-indigo-500 bg-indigo-50/40 rounded-xl p-4.5 flex flex-col justify-between transition-all hover:shadow-md group">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                        <ShieldCheck className="w-5 h-5" />
                      </div>
                      <span className="px-2 py-0.5 rounded-md text-2xs font-bold uppercase tracking-wider bg-indigo-100 text-indigo-800 border border-indigo-200">
                        Admin Role
                      </span>
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-slate-900 group-hover:text-indigo-700 transition-colors">
                        {defaultAdmin.name}
                      </h3>
                      <p className="text-2xs text-slate-500 truncate">{defaultAdmin.role}</p>
                    </div>

                    <ul className="text-2xs text-slate-600 space-y-1.5 pt-2 border-t border-indigo-100">
                      <li className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        <span>Create, edit & delete projects</span>
                      </li>
                      <li className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        <span>Manage team members (Admin / Staff)</span>
                      </li>
                      <li className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        <span>Full task control & project assignments</span>
                      </li>
                    </ul>
                  </div>

                  <button
                    id="quick-login-admin-btn"
                    onClick={() => handleQuickLogin(defaultAdmin)}
                    className="mt-4 w-full py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>Log In as Admin</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Staff Card */}
                <div className="border-2 border-emerald-200 hover:border-emerald-500 bg-emerald-50/40 rounded-xl p-4.5 flex flex-col justify-between transition-all hover:shadow-md group">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                        <UserCheck className="w-5 h-5" />
                      </div>
                      <span className="px-2 py-0.5 rounded-md text-2xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                        Staff Role
                      </span>
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                        {defaultStaff.name}
                      </h3>
                      <p className="text-2xs text-slate-500 truncate">{defaultStaff.role}</p>
                    </div>

                    <ul className="text-2xs text-slate-600 space-y-1.5 pt-2 border-t border-emerald-100">
                      <li className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Create tasks in assigned projects only</span>
                      </li>
                      <li className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Edit and delete only their own tasks</span>
                      </li>
                      <li className="flex items-center gap-1.5">
                        <span className="w-3.5 h-3.5 text-slate-400 text-center font-bold text-xs shrink-0">
                          ✕
                        </span>
                        <span className="text-slate-500">Cannot create/delete projects</span>
                      </li>
                    </ul>
                  </div>

                  <button
                    id="quick-login-staff-btn"
                    onClick={() => handleQuickLogin(defaultStaff)}
                    className="mt-4 w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>Log In as Staff</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* All team members quick selector */}
              <div className="pt-3 border-t border-slate-100">
                <label className="block text-2xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Or switch to any team member profile:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {teamMembers.map((member) => (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => handleQuickLogin(member)}
                      className="p-2 border border-slate-200 rounded-lg hover:border-blue-400 hover:bg-blue-50/50 flex items-center gap-2 text-left transition-colors cursor-pointer"
                    >
                      {member.avatar ? (
                        <img
                          src={member.avatar}
                          alt={member.name}
                          className="w-7 h-7 rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <div
                          style={{ backgroundColor: member.color || '#2563eb' }}
                          className="w-7 h-7 rounded-full text-white text-3xs font-bold flex items-center justify-center shrink-0"
                        >
                          {member.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-2xs font-semibold text-slate-800 truncate">
                          {member.name}
                        </p>
                        <span
                          className={`text-3xs font-bold uppercase px-1 rounded ${
                            member.systemRole === 'admin'
                              ? 'bg-indigo-50 text-indigo-700'
                              : 'bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          {member.systemRole}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Custom Credentials Tab */
            <form onSubmit={handleCustomLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Address <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="custom-login-email"
                    type="email"
                    required
                    placeholder="e.g. alex.morgan@team.org or your email"
                    value={customEmail}
                    onChange={(e) => setCustomEmail(e.target.value)}
                    className={FORM_STYLES.inputWithIcon}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="custom-login-password"
                    type="password"
                    value={customPassword}
                    onChange={(e) => setCustomPassword(e.target.value)}
                    className={FORM_STYLES.inputWithIcon}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Display Name (Optional)
                  </label>
                  <input
                    id="custom-login-name"
                    type="text"
                    placeholder="e.g. Jordan Lee"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    className={FORM_STYLES.input}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Role Access Level <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setCustomRole('admin')}
                      className={`py-2 px-3 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1.5 transition-colors ${
                        customRole === 'admin'
                          ? 'bg-indigo-50 border-indigo-300 text-indigo-700 ring-2 ring-indigo-500/20'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                      Admin
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomRole('staff')}
                      className={`py-2 px-3 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1.5 transition-colors ${
                        customRole === 'staff'
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-700 ring-2 ring-emerald-500/20'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                      Staff
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-3">
                <button
                  id="custom-login-submit-btn"
                  type="submit"
                  className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5" />
                  Sign In to Project Management
                </button>
              </div>
            </form>
          )}

          {/* Footer note */}
          <div className="pt-2 text-center">
            <p className="text-3xs text-slate-400">
              Role permissions strictly enforce project editing, deletion, and deliverable creation boundaries.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
