import React, { useState, useEffect } from 'react';
import { X, UserPlus, Mail, Briefcase, Tag, Check, Sparkles, ChevronDown, ShieldCheck, UserCheck } from 'lucide-react';
import { TeamMember, Project, UserRole } from '../types';
import { FORM_STYLES } from '../utils/formStyles';

interface TeamMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    memberData: Omit<TeamMember, 'id' | 'createdAt'> & { projectIds?: string[] },
    memberId?: string
  ) => void;
  initialMember?: TeamMember | null;
  projects?: Project[];
}

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
];

const COLOR_THEMES = [
  { name: 'Blue', hex: '#2563eb' },
  { name: 'Purple', hex: '#7c3aed' },
  { name: 'Emerald', hex: '#059669' },
  { name: 'Orange', hex: '#ea580c' },
  { name: 'Cyan', hex: '#0891b2' },
  { name: 'Pink', hex: '#db2777' },
  { name: 'Slate', hex: '#475569' },
];

export const TeamMemberModal: React.FC<TeamMemberModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialMember,
  projects = [],
}) => {
  const safeProjects = Array.isArray(projects) ? projects : [];

  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('Engineering');
  const [systemRole, setSystemRole] = useState<UserRole>('staff');
  const [status, setStatus] = useState<'active' | 'busy' | 'away'>('active');
  const [avatarType, setAvatarType] = useState<'photo' | 'initials'>('initials');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [color, setColor] = useState('#2563eb');
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);

  useEffect(() => {
    if (initialMember) {
      setName(initialMember.name);
      setRole(initialMember.role);
      setSystemRole(initialMember.systemRole || 'staff');
      setEmail(initialMember.email);
      setDepartment(initialMember.department || 'Engineering');
      setStatus(initialMember.status);
      setColor(initialMember.color || '#2563eb');
      if (initialMember.avatar) {
        setAvatarType('photo');
        setAvatarUrl(initialMember.avatar);
      } else {
        setAvatarType('initials');
        setAvatarUrl('');
      }
      // Load current project memberships
      const memberProjects = safeProjects
        .filter((p) => (p.memberIds || []).includes(initialMember.id))
        .map((p) => p.id);
      setSelectedProjectIds(memberProjects);
    } else {
      setName('');
      setRole('');
      setSystemRole('staff');
      setEmail('');
      setDepartment('Engineering');
      setStatus('active');
      setAvatarType('initials');
      setAvatarUrl('');
      setColor(COLOR_THEMES[Math.floor(Math.random() * COLOR_THEMES.length)].hex);
      setSelectedProjectIds([]);
    }
  }, [initialMember, isOpen, projects]);

  if (!isOpen) return null;

  const getInitials = (fullName: string) => {
    if (!fullName) return '?';
    const parts = fullName.trim().split(' ');
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const toggleProjectSelection = (projectId: string) => {
    if (selectedProjectIds.includes(projectId)) {
      setSelectedProjectIds(selectedProjectIds.filter((id) => id !== projectId));
    } else {
      setSelectedProjectIds([...selectedProjectIds, projectId]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !role.trim()) return;

    onSave(
      {
        name: name.trim(),
        role: role.trim(),
        systemRole,
        email: email.trim() || `${name.trim().toLowerCase().replace(/\s+/g, '.')}@team.org`,
        department: department.trim() || 'General',
        status,
        color,
        avatar: avatarType === 'photo' && avatarUrl.trim() ? avatarUrl.trim() : undefined,
        projectIds: selectedProjectIds,
      },
      initialMember ? initialMember.id : undefined
    );
    onClose();
  };

  return (
    <div
      id="team-member-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
    >
      <div
        id="team-member-modal-card"
        className="w-full max-w-lg bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 id="team-member-modal-title" className="text-base font-semibold text-slate-900">
                {initialMember ? 'Edit Team Member' : 'Add Team Member'}
              </h2>
              <p className="text-xs text-slate-500">
                Configure profile details, role, and department
              </p>
            </div>
          </div>
          <button
            id="close-team-member-modal-btn"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Live Preview Card */}
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center gap-3.5">
            <div className="relative">
              {avatarType === 'photo' && avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={name || 'Avatar'}
                  className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-xs"
                />
              ) : (
                <div
                  style={{ backgroundColor: color }}
                  className="w-12 h-12 rounded-full text-white font-semibold flex items-center justify-center text-sm shadow-xs border-2 border-white"
                >
                  {getInitials(name)}
                </div>
              )}
              <span
                className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white ${
                  status === 'active'
                    ? 'bg-emerald-500'
                    : status === 'busy'
                    ? 'bg-amber-500'
                    : 'bg-slate-400'
                }`}
              />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-semibold text-slate-900 truncate">
                {name || 'Member Name'}
              </h4>
              <p className="text-xs text-slate-500 truncate">
                {role || 'Job Role'} &bull; {department}
              </p>
              <p className="text-2xs text-slate-400 truncate mt-0.5">
                {email || 'email@team.org'}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <span
                className={`px-2 py-0.5 rounded-full text-2xs font-semibold uppercase tracking-wider ${
                  systemRole === 'admin'
                    ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                    : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                }`}
              >
                {systemRole} Role
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-2xs font-medium capitalize ${
                  status === 'active'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : status === 'busy'
                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                }`}
              >
                {status}
              </span>
            </div>
          </div>

          {/* Full Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Full Name <span className="text-rose-500">*</span>
            </label>
            <input
              id="member-name-input"
              type="text"
              required
              placeholder="e.g. Rachel Foster"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={FORM_STYLES.input}
            />
          </div>

          {/* System Access Role (Admin vs Staff) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Access Permission Level (System Role) <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                id="member-role-admin-toggle"
                onClick={() => setSystemRole('admin')}
                className={`p-3 rounded-xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                  systemRole === 'admin'
                    ? 'bg-indigo-50/70 border-indigo-400 ring-2 ring-indigo-500/20 shadow-2xs'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                    systemRole === 'admin'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">Admin</span>
                    {systemRole === 'admin' && (
                      <span className="w-2 h-2 rounded-full bg-indigo-600" />
                    )}
                  </div>
                  <p className="text-2xs text-slate-500 leading-tight mt-0.5">
                    Can create, edit & delete projects, tasks, and team roster
                  </p>
                </div>
              </button>

              <button
                type="button"
                id="member-role-staff-toggle"
                onClick={() => setSystemRole('staff')}
                className={`p-3 rounded-xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                  systemRole === 'staff'
                    ? 'bg-emerald-50/70 border-emerald-400 ring-2 ring-emerald-500/20 shadow-2xs'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                    systemRole === 'staff'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  <UserCheck className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">Staff</span>
                    {systemRole === 'staff' && (
                      <span className="w-2 h-2 rounded-full bg-emerald-600" />
                    )}
                  </div>
                  <p className="text-2xs text-slate-500 leading-tight mt-0.5">
                    Can only create, edit & delete their own tasks in assigned projects
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Role & Department */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Role / Title <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Briefcase className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="member-role-input"
                  type="text"
                  required
                  placeholder="e.g. Frontend Engineer"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className={FORM_STYLES.inputWithIcon}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Department
              </label>
              <div className="relative">
                <Tag className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="member-department-input"
                  type="text"
                  placeholder="e.g. Engineering, Design, QA"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className={FORM_STYLES.inputWithIcon}
                />
              </div>
            </div>
          </div>

          {/* Email & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="member-email-input"
                  type="email"
                  placeholder="e.g. rachel@team.org"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={FORM_STYLES.inputWithIcon}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Work Status
              </label>
              <div className="relative">
                <select
                  id="member-status-select"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as 'active' | 'busy' | 'away')}
                  className={FORM_STYLES.select}
                >
                  <option value="active">🟢 Active & Available</option>
                  <option value="busy">🟡 Busy / In Meetings</option>
                  <option value="away">⚪ Away / On Leave</option>
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Avatar Options */}
          <div className="pt-2 border-t border-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700">
                Avatar Display Style
              </label>
              <div className="flex rounded-md bg-slate-100 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setAvatarType('initials')}
                  className={`px-2.5 py-1 rounded-sm font-medium transition-colors ${
                    avatarType === 'initials'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Initials Badge
                </button>
                <button
                  type="button"
                  onClick={() => setAvatarType('photo')}
                  className={`px-2.5 py-1 rounded-sm font-medium transition-colors ${
                    avatarType === 'photo'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Photo Avatar
                </button>
              </div>
            </div>

            {avatarType === 'initials' ? (
              <div>
                <span className="block text-2xs text-slate-500 mb-1.5">
                  Select background color theme for initials:
                </span>
                <div className="flex items-center gap-2">
                  {COLOR_THEMES.map((theme) => (
                    <button
                      key={theme.hex}
                      type="button"
                      onClick={() => setColor(theme.hex)}
                      style={{ backgroundColor: theme.hex }}
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-white transition-transform ${
                        color === theme.hex ? 'scale-110 ring-2 ring-offset-2 ring-slate-400' : 'opacity-80 hover:opacity-100'
                      }`}
                      title={theme.name}
                    >
                      {color === theme.hex && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  id="member-avatar-url-input"
                  type="url"
                  placeholder="Paste direct image URL (https://...)"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  className={FORM_STYLES.input}
                />
                <div>
                  <span className="block text-2xs text-slate-500 mb-1">
                    Or select a preset avatar:
                  </span>
                  <div className="flex items-center gap-2 overflow-x-auto py-1">
                    {PRESET_AVATARS.map((url, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setAvatarUrl(url)}
                        className={`shrink-0 rounded-full transition-all ${
                          avatarUrl === url
                            ? 'ring-2 ring-blue-600 ring-offset-1 scale-105'
                            : 'opacity-70 hover:opacity-100'
                        }`}
                      >
                        <img
                          src={url}
                          alt="Preset"
                          className="w-7 h-7 rounded-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Project Assignments */}
          {safeProjects.length > 0 && (
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700">
                  Assign to Projects
                </label>
                <span className="text-2xs text-slate-400">
                  {selectedProjectIds.length} selected
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
                {safeProjects.map((p) => {
                  const isChecked = selectedProjectIds.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggleProjectSelection(p.id)}
                      className={`flex items-center gap-2 p-2 rounded-lg border text-left text-xs transition-colors ${
                        isChecked
                          ? 'border-blue-300 bg-blue-50/70 text-blue-900 font-medium'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-sm flex items-center justify-center shrink-0 border ${
                          isChecked
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <span className="truncate">{p.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              id="cancel-team-member-btn"
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              id="save-team-member-btn"
              type="submit"
              className="px-5 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-xs flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              {initialMember ? 'Save Changes' : 'Add Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
