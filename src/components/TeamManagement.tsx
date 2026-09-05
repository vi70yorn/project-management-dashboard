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
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <h1 id="team-roster-title" className="text-xl font-bold text-slate-900">
              Team Members & Roster
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Add team members, configure their roles, and manage their assignments across projects and tasks.
          </p>
        </div>

        {isAdmin && (
          <button
            id="add-team-member-btn"
            onClick={onAddMember}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors self-start sm:self-auto cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            Add Team Member
          </button>
        )}
      </div>

      {/* Stats Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-500 font-medium block">Total Roster</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-bold text-slate-900">{teamMembers.length}</span>
            <span className="text-2xs text-slate-400">members</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-500 font-medium block">Active & Available</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-bold text-emerald-600">{activeCount}</span>
            <span className="text-2xs text-slate-400">members</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-500 font-medium block">Busy / In Meetings</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-bold text-amber-600">{busyCount}</span>
            <span className="text-2xs text-slate-400">members</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-500 font-medium block">Away / On Leave</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-bold text-slate-500">{awayCount}</span>
            <span className="text-2xs text-slate-400">members</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
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
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
          {(['All', 'active', 'busy', 'away'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                statusFilter === status
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
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
              className="bg-white rounded-xl border border-slate-200 shadow-2xs hover:shadow-sm transition-shadow p-5 flex flex-col justify-between"
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
                          className="w-12 h-12 rounded-full object-cover border border-slate-200"
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
                        className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white ${
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
                        <h3 className="text-sm font-semibold text-slate-900 truncate">
                          {member.name}
                        </h3>
                        {/* System Role Badge */}
                        <span
                          className={`inline-flex items-center gap-0.5 px-1.5 py-0.2 text-3xs font-semibold rounded-md border ${
                            member.systemRole === 'admin'
                              ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                              : 'bg-slate-100 border-slate-200 text-slate-700'
                          }`}
                        >
                          {member.systemRole === 'admin' ? (
                            <ShieldCheck className="w-2.5 h-2.5" />
                          ) : (
                            <UserCheck className="w-2.5 h-2.5" />
                          )}
                          {member.systemRole === 'admin' ? 'Admin' : 'Staff'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 truncate flex items-center gap-1 mt-0.5">
                        <Briefcase className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">{member.role}</span>
                      </p>
                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        {member.username && (
                          <span className="inline-block px-1.5 py-0.2 rounded-sm text-3xs font-mono font-medium bg-blue-50 text-blue-700 border border-blue-200">
                            @{member.username}
                          </span>
                        )}
                        {member.department && (
                          <span className="inline-block px-1.5 py-0.2 rounded-sm text-2xs font-medium bg-slate-100 text-slate-600">
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
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        id={`delete-member-btn-${member.id}`}
                        onClick={() => onDeleteMember(member.id)}
                        title="Delete member"
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Email line */}
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-2xs text-slate-500">
                  <span className="flex items-center gap-1.5 truncate">
                    <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <a href={`mailto:${member.email}`} className="hover:text-blue-600 truncate">
                      {member.email}
                    </a>
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full capitalize font-medium ${
                      member.status === 'active'
                        ? 'bg-emerald-50 text-emerald-700'
                        : member.status === 'busy'
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {member.status}
                  </span>
                </div>

                {/* Assigned Projects Section */}
                <div className="mt-3 space-y-1.5">
                  <div className="flex items-center justify-between text-2xs font-semibold text-slate-600">
                    <span className="flex items-center gap-1">
                      <FolderKanban className="w-3 h-3 text-slate-400" />
                      Projects ({assignedProjects.length})
                    </span>
                    {isAdmin && (
                      <button
                        onClick={() => openProjectManager(member)}
                        className="text-blue-600 hover:underline text-2xs cursor-pointer"
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
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-2xs font-medium bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 transition-colors border border-slate-200"
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: p.color }}
                          />
                          <span className="truncate max-w-[120px]">{p.name}</span>
                        </button>
                      ))
                    ) : (
                      <span className="text-2xs text-slate-400 italic">
                        Not assigned to any project
                      </span>
                    )}
                  </div>
                </div>

                {/* Workload / Task distribution */}
                <div className="mt-3 pt-2.5 border-t border-slate-100">
                  <div className="flex items-center justify-between text-2xs font-semibold text-slate-600 mb-1.5">
                    <span>Task Workload</span>
                    <button
                      onClick={() => setInspectingMemberTasks(member)}
                      className="text-blue-600 hover:underline text-2xs"
                    >
                      {memberTasks.length} {memberTasks.length === 1 ? 'task' : 'tasks'}
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 text-center text-2xs">
                    <div className="p-1.5 bg-blue-50/60 rounded-md border border-blue-100">
                      <span className="block font-bold text-blue-700">{activeTasks.length}</span>
                      <span className="text-slate-500 text-3xs">In Progress</span>
                    </div>
                    <div className="p-1.5 bg-amber-50/60 rounded-md border border-amber-100">
                      <span className="block font-bold text-amber-700">{blockedTasks.length}</span>
                      <span className="text-slate-500 text-3xs">Blocked</span>
                    </div>
                    <div className="p-1.5 bg-emerald-50/60 rounded-md border border-emerald-100">
                      <span className="block font-bold text-emerald-700">{completedTasks.length}</span>
                      <span className="text-slate-500 text-3xs">Completed</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card Footer Quick Action */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                <button
                  onClick={() => openProjectManager(member)}
                  className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline"
                >
                  Assign to Projects &rarr;
                </button>
                <div className="flex items-center gap-3">
                  {(isAdmin || currentUser?.memberId === member.id) && (
                    <button
                      onClick={() => onEditMember(member)}
                      className="text-xs font-medium text-slate-600 hover:text-blue-600 hover:underline"
                    >
                      {isAdmin ? 'View Details / Password' : 'My Details'}
                    </button>
                  )}
                  <button
                    onClick={() => setInspectingMemberTasks(member)}
                    className="text-xs font-medium text-slate-600 hover:text-slate-900"
                  >
                    View Tasks
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {filteredMembers.length === 0 && (
          <div className="col-span-full py-12 text-center bg-white rounded-xl border border-dashed border-slate-300">
            <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-700">No team members found</p>
            <p className="text-xs text-slate-400 mt-1">
              Try adjusting your search query or add a new team member.
            </p>
            {isAdmin && (
              <button
                onClick={onAddMember}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700"
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
        >
          <div className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                  <FolderKanban className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Assign to Projects
                  </h3>
                  <p className="text-xs text-slate-500">
                    {managingProjectsForMember.name} ({managingProjectsForMember.role})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setManagingProjectsForMember(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 max-h-80 overflow-y-auto space-y-2">
              <p className="text-xs text-slate-600 mb-3">
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
                        ? 'bg-blue-50 border-blue-200 text-blue-900 font-medium'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: project.color }}
                      />
                      <div className="truncate">
                        <p className="font-semibold text-slate-900 truncate">{project.name}</p>
                        <p className="text-2xs text-slate-500 truncate">
                          Client: {project.client} &bull; Status: {project.status}
                        </p>
                      </div>
                    </div>
                    {isSelected ? (
                      <div className="w-5 h-5 rounded-md bg-blue-600 text-white flex items-center justify-center shrink-0">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-md border border-slate-300 shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setManagingProjectsForMember(null)}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveProjects}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs"
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
        >
          <div className="w-full max-w-lg bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Tasks for {inspectingMemberTasks.name}
                </h3>
                <p className="text-xs text-slate-500">
                  {inspectingMemberTasks.role} &bull; {tasks.filter((t) => t.assigneeId === inspectingMemberTasks.id).length} total deliverables
                </p>
              </div>
              <button
                onClick={() => setInspectingMemberTasks(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
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
                        className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-slate-900 truncate">
                            {task.title}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-2xs font-semibold shrink-0 ${
                              task.status === 'Completed'
                                ? 'bg-emerald-100 text-emerald-800'
                                : task.status === 'In Progress'
                                ? 'bg-blue-100 text-blue-800'
                                : task.status === 'Blocked'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {task.status}
                          </span>
                        </div>
                        {task.description && (
                          <p className="text-2xs text-slate-600 line-clamp-2">
                            {task.description}
                          </p>
                        )}
                        <div className="flex items-center justify-between text-2xs text-slate-500 pt-1 border-t border-slate-200/60">
                          <span>Project: {taskProject ? taskProject.name : 'Unknown'}</span>
                          <span>Due: {task.dueDate}</span>
                        </div>
                      </div>
                    );
                  })
              ) : (
                <div className="py-8 text-center text-xs text-slate-400">
                  No tasks currently assigned to this member.
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setInspectingMemberTasks(null)}
                className="px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-lg"
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
