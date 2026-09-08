import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Mail,
  Briefcase,
  CheckCircle2,
  Clock,
  AlertCircle,
  Edit2,
  Trash2,
  FolderKanban,
  Check,
  X,
  ExternalLink,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { TeamMember, Project, Task, AuthUser } from '../types';
import { FORM_STYLES } from '../utils/formStyles';

interface TeamManagementProps {
  teamMembers: TeamMember[];
  projects: Project[];
  tasks: Task[];
  onAddMember: () => void;
  onEditMember: (member: TeamMember) => void;
  onDeleteMember: (memberOrId: TeamMember | string) => void;
  onUpdateMemberProjects: (memberId: string, projectIds: string[]) => void;
  onSelectProject: (projectId: string) => void;
  currentUser?: AuthUser | null;
}

export const TeamManagement: React.FC<TeamManagementProps> = ({
  teamMembers = [],
  projects = [],
  tasks = [],
  onAddMember,
  onEditMember,
  onDeleteMember,
  onUpdateMemberProjects,
  onSelectProject,
  currentUser,
}) => {
  const isAdmin = currentUser?.role === 'admin';
  const safeMembers = Array.isArray(teamMembers) ? teamMembers : [];
  const safeProjects = Array.isArray(projects) ? projects : [];
  const safeTasks = Array.isArray(tasks) ? tasks : [];

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'active' | 'busy' | 'away'>('All');
  const [managingProjectsForMember, setManagingProjectsForMember] = useState<TeamMember | null>(null);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [inspectingMemberTasks, setInspectingMemberTasks] = useState<TeamMember | null>(null);

  // Filter members
  const filteredMembers = safeMembers.filter((m) => {
    const matchesSearch =
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.department && m.department.toLowerCase().includes(searchQuery.toLowerCase())) ||
      m.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'All' || m.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Calculate high-level stats
  const activeCount = safeMembers.filter((m) => m.status === 'active').length;
  const busyCount = safeMembers.filter((m) => m.status === 'busy').length;
  const awayCount = safeMembers.filter((m) => m.status === 'away').length;

  const openProjectManager = (member: TeamMember) => {
    const memberProjectIds = safeProjects.filter((p) => p.memberIds.includes(member.id)).map((p) => p.id);
    setSelectedProjectIds(memberProjectIds);
    setManagingProjectsForMember(member);
  };

  const toggleProjectSelection = (projectId: string) => {
    if (selectedProjectIds.includes(projectId)) {
      setSelectedProjectIds(selectedProjectIds.filter((id) => id !== projectId));
    } else {
      setSelectedProjectIds([...selectedProjectIds, projectId]);
    }
  };

  const handleSaveProjects = () => {
    if (managingProjectsForMember) {
      onUpdateMemberProjects(managingProjectsForMember.id, selectedProjectIds);
      setManagingProjectsForMember(null);
    }
  };

  const getInitials = (fullName: string) => {
    if (!fullName) return '?';
    const parts = fullName.trim().split(' ');
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <div id="team-management-view" className="space-y-6">
      {/* Top Header & Actions Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 id="team-roster-title" className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                Team Members & Roster
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Add team members, configure their roles, and manage their assignments across projects and tasks.
              </p>
            </div>
          </div>
        </div>

        {isAdmin && (
          <button
            id="add-team-member-btn"
            onClick={onAddMember}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors self-start sm:self-auto cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            Add Team Member
          </button>
        )}
      </div>

      {/* Stats Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block">Total Roster</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-bold text-slate-900 dark:text-white">{teamMembers.length}</span>
            <span className="text-2xs text-slate-400 dark:text-slate-500">members</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block">Active & Available</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{activeCount}</span>
            <span className="text-2xs text-slate-400 dark:text-slate-500">members</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block">Busy / In Meetings</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-bold text-amber-600 dark:text-amber-400">{busyCount}</span>
            <span className="text-2xs text-slate-400 dark:text-slate-500">members</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block">Away / On Leave</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-bold text-slate-500 dark:text-slate-400">{awayCount}</span>
            <span className="text-2xs text-slate-400 dark:text-slate-500">members</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            id="search-team-members-input"
            type="text"
            placeholder="Search by name, role, department..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={FORM_STYLES.searchInput}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs w-full sm:w-auto overflow-x-auto">
          {(['All', 'active', 'busy', 'away'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium capitalize transition-all cursor-pointer ${
                statusFilter === status
                  ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-2xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {status === 'All' ? 'All Members' : status}
            </button>
          ))}
        </div>
      </div>

      {/* Members Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredMembers.map((member) => {
          const assignedProjects = safeProjects.filter((p) => (p.memberIds || []).includes(member.id));
          const memberTasks = safeTasks.filter((t) => t.assigneeId === member.id);
          const activeTasks = memberTasks.filter((t) => t.status === 'In Progress');
          const blockedTasks = memberTasks.filter((t) => t.status === 'Blocked');
          const completedTasks = memberTasks.filter((t) => t.status === 'Completed');

          return (
            <div
              key={member.id}
              id={`member-card-${member.id}`}
              className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs hover:shadow-sm transition-shadow p-5 flex flex-col justify-between"
            >
              <div>
                {/* Member Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative shrink-0">
                      {member.avatar ? (
                        <img
                          src={member.avatar}
                          alt={member.name}
                          className="w-12 h-12 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                        />
                      ) : (
                        <div
                          style={{ backgroundColor: member.color || '#2563eb' }}
                          className="w-12 h-12 rounded-full text-white font-semibold flex items-center justify-center text-sm shadow-2xs"
                        >
                          {getInitials(member.name)}
                        </div>
                      )}
                      <span
                        className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-slate-900 ${
                          member.status === 'active'
                            ? 'bg-emerald-500'
                            : member.status === 'busy'
                            ? 'bg-amber-500'
                            : 'bg-slate-400'
                        }`}
                        title={`Status: ${member.status}`}
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
                          {member.name}
                        </h3>
                        {/* System Role Badge */}
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 text-2xs font-semibold rounded-md border ${
                            member.systemRole === 'admin'
                              ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400'
                              : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {member.systemRole === 'admin' ? (
                            <ShieldCheck className="w-3 h-3" />
                          ) : (
                            <UserCheck className="w-3 h-3" />
                          )}
                          {member.systemRole === 'admin' ? 'Admin' : 'Staff'}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300 truncate flex items-center gap-1.5 mt-0.5">
                        <Briefcase className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{member.role}</span>
                      </p>
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        {member.username && (
                          <span className="inline-block px-2 py-0.5 rounded-md text-2xs font-mono font-medium bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                            @{member.username}
                          </span>
                        )}
                        {member.department && (
                          <span className="inline-block px-2 py-0.5 rounded-md text-2xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {member.department}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Edit / Delete Buttons */}
                  <div className="flex items-center gap-1">
                    {(isAdmin || currentUser?.memberId === member.id) && (
                      <button
                        id={`edit-member-btn-${member.id}`}
                        onClick={() => onEditMember(member)}
                        title={isAdmin ? "Edit member" : "Edit your profile"}
                        className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        id={`delete-member-btn-${member.id}`}
                        onClick={() => onDeleteMember(member.id)}
                        title="Delete member"
                        className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Email line */}
                <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                  <span className="flex items-center gap-1.5 truncate">
                    <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                    <a href={`mailto:${member.email}`} className="hover:text-blue-600 dark:hover:text-blue-400 font-medium truncate">
                      {member.email}
                    </a>
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full capitalize text-xs font-semibold ${
                      member.status === 'active'
                        ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400'
                        : member.status === 'busy'
                        ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {member.status}
                  </span>
                </div>

                {/* Assigned Projects Section */}
                <div className="mt-3.5 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <FolderKanban className="w-3.5 h-3.5 text-slate-400" />
                      Projects ({assignedProjects.length})
                    </span>
                    {isAdmin && (
                      <button
                        onClick={() => openProjectManager(member)}
                        className="text-blue-600 dark:text-blue-400 hover:underline text-xs font-semibold cursor-pointer"
                      >
                        Manage Projects
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1.5 min-h-6">
                    {assignedProjects.length > 0 ? (
                      assignedProjects.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => onSelectProject(p.id)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/40 text-slate-700 dark:text-slate-300 hover:text-blue-700 dark:hover:text-blue-300 transition-colors border border-slate-200 dark:border-slate-700 cursor-pointer"
                        >
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: p.color }}
                          />
                          <span className="truncate max-w-[140px]">{p.name}</span>
                        </button>
                      ))
                    ) : (
                      <span className="text-xs text-slate-400 dark:text-slate-500 italic">
                        Not assigned to any project
                      </span>
                    )}
                  </div>
                </div>

                {/* Workload / Task distribution */}
                <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    <span>Task Workload</span>
                    <button
                      onClick={() => setInspectingMemberTasks(member)}
                      className="text-blue-600 dark:text-blue-400 hover:underline text-xs font-semibold cursor-pointer"
                    >
                      {memberTasks.length} {memberTasks.length === 1 ? 'task' : 'tasks'}
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="py-2 px-1.5 bg-blue-50/70 dark:bg-blue-950/40 rounded-lg border border-blue-100 dark:border-blue-900/50">
                      <span className="block text-lg font-bold text-blue-700 dark:text-blue-400">{activeTasks.length}</span>
                      <span className="text-slate-600 dark:text-slate-400 text-2xs font-medium">In Progress</span>
                    </div>
                    <div className="py-2 px-1.5 bg-amber-50/70 dark:bg-amber-950/40 rounded-lg border border-amber-100 dark:border-amber-900/50">
                      <span className="block text-lg font-bold text-amber-700 dark:text-amber-400">{blockedTasks.length}</span>
                      <span className="text-slate-600 dark:text-slate-400 text-2xs font-medium">Blocked</span>
                    </div>
                    <div className="py-2 px-1.5 bg-emerald-50/70 dark:bg-emerald-950/40 rounded-lg border border-emerald-100 dark:border-emerald-900/50">
                      <span className="block text-lg font-bold text-emerald-700 dark:text-emerald-400">{completedTasks.length}</span>
                      <span className="text-slate-600 dark:text-slate-400 text-2xs font-medium">Completed</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card Footer Quick Action */}
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                <button
                  onClick={() => openProjectManager(member)}
                  className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline cursor-pointer truncate"
                >
                  Assign to Projects &rarr;
                </button>
                <div className="flex items-center gap-3 shrink-0">
                  {(isAdmin || currentUser?.memberId === member.id) && (
                    <button
                      onClick={() => onEditMember(member)}
                      className="text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:underline cursor-pointer"
                    >
                      {isAdmin ? 'View Details / Password' : 'My Details'}
                    </button>
                  )}
                  <button
                    onClick={() => setInspectingMemberTasks(member)}
                    className="text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                  >
                    View Tasks
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {filteredMembers.length === 0 && (
          <div className="col-span-full py-12 text-center bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
            <Users className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">No team members found</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              Try adjusting your search query or add a new team member.
            </p>
            {isAdmin && (
              <button
                onClick={onAddMember}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                Add First Member
              </button>
            )}
          </div>
        )}
      </div>

      {/* Modal: Manage Projects for Member */}
      {managingProjectsForMember && (
        <div
          id="manage-member-projects-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150"
        >
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <FolderKanban className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Assign to Projects
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {managingProjectsForMember.name} ({managingProjectsForMember.role})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setManagingProjectsForMember(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 max-h-80 overflow-y-auto space-y-2">
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
                Select which projects this team member should have access to:
              </p>
              {safeProjects.map((project) => {
                const isSelected = selectedProjectIds.includes(project.id);
                return (
                  <div
                    key={project.id}
                    onClick={() => toggleProjectSelection(project.id)}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer text-xs transition-colors ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200 font-medium'
                        : 'bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: project.color }}
                      />
                      <div className="truncate">
                        <p className="font-semibold text-slate-900 dark:text-white truncate">{project.name}</p>
                        <p className="text-2xs text-slate-500 dark:text-slate-400 truncate">
                          Client: {project.client} &bull; Status: {project.status}
                        </p>
                      </div>
                    </div>
                    {isSelected ? (
                      <div className="w-5 h-5 rounded-md bg-blue-600 text-white flex items-center justify-center shrink-0">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-md border border-slate-300 dark:border-slate-600 shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setManagingProjectsForMember(null)}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveProjects}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs cursor-pointer"
              >
                Save Project Assignments
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Inspect Member Assigned Tasks */}
      {inspectingMemberTasks && (
        <div
          id="member-tasks-inspect-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150"
        >
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Tasks for {inspectingMemberTasks.name}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {inspectingMemberTasks.role} &bull; {tasks.filter((t) => t.assigneeId === inspectingMemberTasks.id).length} total deliverables
                </p>
              </div>
              <button
                onClick={() => setInspectingMemberTasks(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-2.5 flex-1">
              {safeTasks.filter((t) => t.assigneeId === inspectingMemberTasks.id).length > 0 ? (
                safeTasks
                  .filter((t) => t.assigneeId === inspectingMemberTasks.id)
                  .map((task) => {
                    const taskProject = safeProjects.find((p) => p.id === task.projectId);
                    return (
                      <div
                        key={task.id}
                        className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 text-xs space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-slate-900 dark:text-white truncate">
                            {task.title}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-2xs font-semibold shrink-0 border ${
                              task.status === 'Completed'
                                ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                : task.status === 'In Progress'
                                ? 'bg-blue-100 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                                : task.status === 'Blocked'
                                ? 'bg-rose-100 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                                : 'bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                            }`}
                          >
                            {task.status}
                          </span>
                        </div>
                        {task.description && (
                          <p className="text-2xs text-slate-600 dark:text-slate-300 line-clamp-2">
                            {task.description}
                          </p>
                        )}
                        <div className="flex items-center justify-between text-2xs text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200/60 dark:border-slate-700">
                          <span>Project: {taskProject ? taskProject.name : 'Unknown'}</span>
                          <span>Due: {task.dueDate}</span>
                        </div>
                      </div>
                    );
                  })
              ) : (
                <div className="py-8 text-center text-xs text-slate-400 dark:text-slate-500">
                  No tasks currently assigned to this member.
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 flex justify-end">
              <button
                type="button"
                onClick={() => setInspectingMemberTasks(null)}
                className="px-4 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
