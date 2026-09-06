import React, { useState, useEffect } from 'react';
import {
  X,
  Check,
  Calendar,
  AlertTriangle,
  User,
  UserPlus,
  AlertCircle,
  AlertOctagon,
  ChevronDown,
  Lock,
  Eye,
  Clock,
  Mail,
  Briefcase,
  Layers,
} from 'lucide-react';
import { Task, StatusType, PriorityType, TeamMember, Project, AuthUser } from '../types';
import { getDueDateStatus, isDueToday } from '../utils/dateUtils';
import { FORM_STYLES } from '../utils/formStyles';
import { StatusBadge, PriorityBadge, getStatusBadgeClass, getPriorityBadgeClass } from './Badges';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (taskData: Partial<Task>) => void;
  initialTask?: Task | null;
  projectId?: string;
  projectName?: string;
  projectMembers?: TeamMember[];
  projects?: Project[];
  teamMembers?: TeamMember[];
  onOpenAddMember?: () => void;
  currentUser?: AuthUser | null;
}

const getStatusBadge = (status: StatusType) => getStatusBadgeClass(status, 'sm');
const getPriorityBadge = (priority: PriorityType) => getPriorityBadgeClass(priority, 'sm');

export const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialTask,
  projectId: defaultProjectId,
  projectName,
  projectMembers,
  projects = [],
  teamMembers = [],
  onOpenAddMember,
  currentUser,
}) => {
  const isAdmin = currentUser?.role === 'admin';
  const isStaff = currentUser?.role === 'staff';

  const safeProjects = Array.isArray(projects) ? projects : [];
  const safeMembers =
    Array.isArray(teamMembers) && teamMembers.length > 0
      ? teamMembers
      : Array.isArray(projectMembers)
      ? projectMembers
      : [];

  const [selectedProjectId, setSelectedProjectId] = useState(
    defaultProjectId || safeProjects[0]?.id || ''
  );
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<StatusType>('In Progress');
  const [priority, setPriority] = useState<PriorityType>('Medium');
  const [assigneeId, setAssigneeId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');

  const isOwnTask = Boolean(
    initialTask &&
    ((initialTask.createdBy && initialTask.createdBy === currentUser?.memberId) ||
     initialTask.assigneeId === currentUser?.memberId)
  );
  const canEditTask = isAdmin || (isStaff && (isOwnTask || !initialTask));

  // Selected project for member suggestions
  const currentProject =
    safeProjects.find((p) => p.id === (initialTask?.projectId || selectedProjectId));

  // Suggested project members first, then other team members
  const sortedMembers = [...safeMembers].sort((a, b) => {
    const aInProject = currentProject?.memberIds?.includes(a.id) ? 1 : 0;
    const bInProject = currentProject?.memberIds?.includes(b.id) ? 1 : 0;
    return bInProject - aInProject;
  });

  useEffect(() => {
    if (initialTask) {
      setSelectedProjectId(initialTask.projectId);
      setTitle(initialTask.title);
      setDescription(initialTask.description);
      setStatus(initialTask.status);
      setPriority(initialTask.priority);
      setAssigneeId(initialTask.assigneeId);
      setStartDate(initialTask.startDate || '');
      setDueDate(initialTask.dueDate);
    } else {
      const activeProjId = defaultProjectId || safeProjects[0]?.id || '';
      setSelectedProjectId(activeProjId);
      setTitle('');
      setDescription('');
      setStatus('In Progress');
      setPriority('Medium');
      const activeProj = safeProjects.find((p) => p.id === activeProjId);
      const defaultAssignee =
        isStaff && currentUser?.memberId
          ? currentUser.memberId
          : activeProj?.memberIds?.[0] || safeMembers[0]?.id || '';
      setAssigneeId(defaultAssignee);
      const today = new Date().toISOString().split('T')[0];
      const targetDue = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
      setStartDate(today);
      setDueDate(targetDue);
    }
  }, [initialTask, isOpen, defaultProjectId, projects, teamMembers, currentUser]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditTask) return;
    if (!title.trim() || !dueDate || !selectedProjectId) return;

    onSave({
      projectId: selectedProjectId,
      title: title.trim(),
      description: description.trim(),
      status,
      priority,
      assigneeId: isStaff ? (currentUser?.memberId || assigneeId) : (assigneeId || safeMembers[0]?.id || 'unassigned'),
      startDate: startDate || undefined,
      dueDate,
    });
    onClose();
  };

  const selectedMemberObj = safeMembers.find((m) => m.id === (initialTask?.assigneeId || assigneeId));

  // If Staff role and viewing ANOTHER member's task: render pristine, read-only Task Detail View
  if (isStaff && initialTask && !isOwnTask) {
    const dueInfo = getDueDateStatus(initialTask.dueDate);
    const assignedMember = safeMembers.find((m) => m.id === initialTask.assigneeId);

    return (
      <div
        id="task-modal-backdrop"
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      >
        <div
          id="task-modal-card"
          className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]"
        >
          {/* Read-Only Header */}
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 flex items-center justify-center">
                <Eye className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {currentProject?.name || projectName || 'Project Task'}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-3xs font-semibold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
                    <Eye className="w-2.5 h-2.5" />
                    View Detail Only ({assignedMember?.name ? `Assigned to ${assignedMember.name}` : "Team Member's Task"})
                  </span>
                </div>
                <h2 id="task-modal-title" className="text-sm font-bold text-slate-900 dark:text-white">
                  Deliverable Task Details
                </h2>
              </div>
            </div>

            <button
              id="close-task-modal-btn"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Read-Only Details Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* Title & Status Badges */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <StatusBadge status={initialTask.status} size="sm" prefix="Status:" />
                <PriorityBadge priority={initialTask.priority} size="sm" prefix="Priority:" />
                {currentProject && (
                  <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: currentProject.color }}
                    />
                    {currentProject.name}
                  </span>
                )}
              </div>

              <h1 className="text-lg font-bold text-slate-900 dark:text-white leading-snug">
                {initialTask.title}
              </h1>
            </div>

            {/* Description Card */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
                Description & Scope
              </h4>
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/80 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                {initialTask.description ? (
                  <p className="whitespace-pre-wrap">{initialTask.description}</p>
                ) : (
                  <p className="text-slate-400 dark:text-slate-500 italic">No description provided for this task deliverable.</p>
                )}
              </div>
            </div>

            {/* Assignee Card */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
                Assigned Team Member
              </h4>
              {assignedMember ? (
                <div className="p-3 bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {assignedMember.avatar ? (
                      <img
                        src={assignedMember.avatar}
                        alt={assignedMember.name}
                        className="w-10 h-10 rounded-full object-cover shrink-0 border border-slate-200 dark:border-slate-700"
                      />
                    ) : (
                      <div
                        style={{ backgroundColor: assignedMember.color || '#2563eb' }}
                        className="w-10 h-10 rounded-full text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs"
                      >
                        {assignedMember.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{assignedMember.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate flex items-center gap-1">
                        <Briefcase className="w-3 h-3 text-slate-400 shrink-0" />
                        {assignedMember.role}
                        {assignedMember.department && ` &bull; ${assignedMember.department}`}
                      </p>
                    </div>
                  </div>

                  <span className="text-2xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium shrink-0">
                    {assignedMember.systemRole === 'admin' ? 'Admin' : 'Staff'}
                  </span>
                </div>
              ) : (
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-xs text-slate-400 dark:text-slate-500 italic">
                  Unassigned
                </div>
              )}
            </div>

            {/* Schedule & Deadlines */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
                Timeline & Deadlines
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
                  <span className="text-2xs text-slate-400 dark:text-slate-500 font-medium block">Start Date</span>
                  <div className="flex items-center gap-2 mt-1">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {initialTask.startDate || 'Not specified'}
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
                  <span className="text-2xs text-slate-400 dark:text-slate-500 font-medium block">Target Due Date</span>
                  <div className="flex items-center justify-between gap-2 mt-1">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-slate-400" />
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {initialTask.dueDate}
                      </span>
                    </div>

                    {dueInfo.isToday ? (
                      <span className="text-2xs font-bold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 px-2 py-0.5 rounded-md flex items-center gap-1 animate-pulse">
                        <AlertCircle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                        Due Today!
                      </span>
                    ) : dueInfo.isOverdue ? (
                      <span className="text-2xs font-semibold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 px-2 py-0.5 rounded-md flex items-center gap-1">
                        <AlertOctagon className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                        Overdue ({dueInfo.diffDays}d)
                      </span>
                    ) : (
                      <span className="text-2xs text-slate-500 dark:text-slate-400 font-medium">
                        Due in {dueInfo.diffDays} days
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Created & Updated Metadata */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-3xs text-slate-400 dark:text-slate-500">
              <span>Task ID: {initialTask.id}</span>
              {initialTask.createdAt && (
                <span>Created: {new Date(initialTask.createdAt).toLocaleDateString()}</span>
              )}
            </div>
          </div>

          {/* Read-Only Footer: Close Button */}
          <div className="px-6 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between">
            <span className="text-2xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              Staff can view details of tasks created by other members
            </span>
            <button
              id="close-view-task-btn"
              type="button"
              onClick={onClose}
              className="px-5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg shadow-2xs transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Create / Edit Form (Admins on all tasks, or Staff on their own tasks / new tasks)
  return (
    <div
      id="task-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150"
    >
      <div
        id="task-modal-card"
        className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/60">
          <div>
            <span className="text-2xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {currentProject ? currentProject.name : projectName || 'Project Task'}
            </span>
            <h2 id="task-modal-title" className="text-base font-semibold text-slate-900 dark:text-white">
              {initialTask
                ? isStaff
                  ? 'Edit My Deliverable Task'
                  : 'Edit Task Deliverable'
                : isStaff
                ? 'Create New Deliverable (My Task)'
                : 'Create Task Deliverable'}
            </h2>
          </div>
          <button
            id="close-task-modal-btn"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Project Selector */}
          {safeProjects.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Project <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <select
                  id="task-project-select"
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className={FORM_STYLES.select}
                >
                  {safeProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.client ? `(${p.client})` : ''}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Task Title <span className="text-rose-500">*</span>
            </label>
            <input
              id="task-title-input"
              type="text"
              required
              placeholder="e.g. Implement authentication middleware"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={FORM_STYLES.input}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Description & Acceptance Criteria
            </label>
            <textarea
              id="task-description-input"
              rows={2}
              placeholder="Deliverables, scope, notes..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={FORM_STYLES.textarea}
            />
          </div>

          {/* Status & Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Status <span className="text-2xs text-slate-400 dark:text-slate-500">(In Progress, Pending, Blocked, Completed)</span>
              </label>
              <div className="relative">
                <select
                  id="task-status-select"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as StatusType)}
                  className={FORM_STYLES.select}
                >
                  <option value="In Progress">In Progress</option>
                  <option value="Pending">Pending</option>
                  <option value="Blocked">Blocked</option>
                  <option value="Completed">Completed</option>
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Priority
              </label>
              <div className="relative">
                <select
                  id="task-priority-select"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as PriorityType)}
                  className={FORM_STYLES.select}
                >
                  <option value="Urgent">Urgent</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Assignee Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Assigned Team Member <span className="text-rose-500">*</span>
            </label>
            {isStaff ? (
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  {currentUser?.avatar ? (
                    <img
                      src={currentUser.avatar}
                      alt={currentUser.name}
                      className="w-7 h-7 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-blue-600 text-white text-3xs font-bold flex items-center justify-center">
                      {currentUser?.name?.slice(0, 2).toUpperCase() || 'ME'}
                    </div>
                  )}
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white block">{currentUser?.name}</span>
                    <span className="text-2xs text-slate-500 dark:text-slate-400">Staff Deliverable (Assigned to you)</span>
                  </div>
                </div>
                <span className="text-3xs font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                  Your Task
                </span>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-2xs text-slate-400 dark:text-slate-500">Assign to project member or team</span>
                  {onOpenAddMember && (
                    <button
                      type="button"
                      onClick={onOpenAddMember}
                      className="text-2xs text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 font-semibold cursor-pointer"
                    >
                      <UserPlus className="w-3 h-3" />
                      + New Member
                    </button>
                  )}
                </div>

                <div className="relative">
                  <select
                    id="task-assignee-select"
                    value={assigneeId}
                    onChange={(e) => setAssigneeId(e.target.value)}
                    className={FORM_STYLES.select}
                  >
                    {sortedMembers.map((m) => {
                      const isInProject = currentProject?.memberIds?.includes(m.id);
                      return (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.role}) {isInProject ? '★ Project Roster' : ''}
                        </option>
                      );
                    })}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>

                {selectedMemberObj && (
                  <div className="flex items-center gap-2 mt-1.5 text-2xs text-slate-500 dark:text-slate-400">
                    <span>{selectedMemberObj.role}</span>
                    <span>&bull;</span>
                    <span className="text-slate-400 dark:text-slate-500">{selectedMemberObj.email}</span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Timeline Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Start Date
              </label>
              <input
                id="task-start-date-input"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={FORM_STYLES.input}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Target Due Date <span className="text-rose-500">*</span>
                </label>
                {dueDate && isDueToday(dueDate) && (
                  <span className="text-2xs font-bold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 px-1.5 py-0.5 rounded flex items-center gap-1 animate-pulse shadow-2xs">
                    <AlertCircle className="w-3 h-3 text-rose-600 dark:text-rose-400 shrink-0" />
                    Due Today!
                  </span>
                )}
              </div>
              <input
                id="task-due-date-input"
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg text-xs font-medium shadow-2xs transition-colors focus:outline-hidden ${
                  dueDate && isDueToday(dueDate)
                    ? 'border-rose-400 dark:border-rose-700 bg-rose-50/60 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 font-bold focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500'
                    : FORM_STYLES.input
                }`}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              id="cancel-task-modal-btn"
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="submit-task-btn"
              type="submit"
              className="px-5 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              {initialTask ? 'Save Task' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
