import React, { useState, useEffect } from 'react';
import { X, FolderPlus, Users, Briefcase, Check, UserPlus, ChevronDown, AlertCircle, Edit3, Clock } from 'lucide-react';
import { Project, StatusType, TeamMember } from '../types';
import { isDueToday, formatDateTime } from '../utils/dateUtils';
import { FORM_STYLES } from '../utils/formStyles';
import { StatusDropdown } from './ui/StatusDropdown';
import { CustomSelect } from './ui/CustomSelect';
import { DatePicker } from './ui/DatePicker';
import { RichTextEditor } from './ui/RichTextEditor';

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (project: Omit<Project, 'id' | 'createdAt'>, projectId?: string) => void;
  initialProject?: Project | null;
  teamMembers: TeamMember[];
  onOpenAddMember?: () => void;
  onShowToast?: (type: 'success' | 'error' | 'info', message: string) => void;
}

const COLOR_OPTIONS = [
  '#2563eb', // Blue
  '#7c3aed', // Purple
  '#ea580c', // Orange
  '#059669', // Emerald
  '#db2777', // Pink
  '#0891b2', // Cyan
];

export const NewProjectModal: React.FC<NewProjectModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialProject,
  teamMembers,
  onOpenAddMember,
  onShowToast,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [client, setClient] = useState('');
  const [status, setStatus] = useState<StatusType>('In Progress');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [targetDeadline, setTargetDeadline] = useState(
    new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
  );
  const [managerId, setManagerId] = useState(teamMembers[0]?.id || '');
  const [selectedMembers, setSelectedMembers] = useState<string[]>(
    teamMembers.slice(0, 3).map((m) => m.id)
  );
  const [tagsInput, setTagsInput] = useState('Core, Sprint 1');
  const [color, setColor] = useState(COLOR_OPTIONS[0]);

  useEffect(() => {
    if (initialProject) {
      setName(initialProject.name || '');
      setDescription(initialProject.description || '');
      setClient(initialProject.client || '');
      setStatus(initialProject.status || 'In Progress');
      setStartDate(initialProject.startDate || new Date().toISOString().split('T')[0]);
      setTargetDeadline(initialProject.targetDeadline || new Date().toISOString().split('T')[0]);
      setManagerId(initialProject.managerId || teamMembers[0]?.id || '');
      setSelectedMembers(initialProject.memberIds && initialProject.memberIds.length > 0 ? initialProject.memberIds : [teamMembers[0]?.id || '']);
      setTagsInput(Array.isArray(initialProject.tags) ? initialProject.tags.join(', ') : 'Core');
      setColor(initialProject.color || COLOR_OPTIONS[0]);
    } else {
      setName('');
      setDescription('');
      setClient('');
      setStatus('In Progress');
      setStartDate(new Date().toISOString().split('T')[0]);
      setTargetDeadline(new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]);
      setManagerId(teamMembers[0]?.id || '');
      setSelectedMembers(teamMembers.slice(0, 3).map((m) => m.id));
      setTagsInput('Core, Sprint 1');
      setColor(COLOR_OPTIONS[0]);
    }
  }, [initialProject, isOpen, teamMembers]);

  const toggleMember = (id: string) => {
    if (selectedMembers.includes(id)) {
      if (selectedMembers.length > 1) {
        setSelectedMembers(selectedMembers.filter((m) => m !== id));
      }
    } else {
      setSelectedMembers([...selectedMembers, id]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !targetDeadline) return;

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    onSave(
      {
        name: name.trim(),
        description: description.trim(),
        client: client.trim() || 'Internal Initiative',
        status,
        startDate,
        targetDeadline,
        managerId: managerId || selectedMembers[0] || teamMembers[0]?.id || '',
        memberIds: selectedMembers.length > 0 ? selectedMembers : [teamMembers[0]?.id || ''],
        tags: tags.length > 0 ? tags : ['General'],
        color,
      },
      initialProject ? initialProject.id : undefined
    );

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      id="new-project-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150"
    >
      <div
        id="new-project-modal-card"
        className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              {initialProject ? <Edit3 className="w-5 h-5" /> : <FolderPlus className="w-5 h-5" />}
            </div>
            <div>
              <h2 id="new-project-title" className="text-base font-semibold text-slate-900 dark:text-white">
                {initialProject ? 'Edit Project Details' : 'Create New Project'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {initialProject
                  ? 'Update deliverables timeline, status, and assigned project team'
                  : 'Set timeline, status, and assign team members to this project'}
              </p>
            </div>
          </div>
          <button
            id="close-new-project-btn"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Project Name <span className="text-rose-500">*</span>
            </label>
            <input
              id="new-project-name-input"
              type="text"
              required
              placeholder="e.g. Mobile Banking Application 2.0"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={FORM_STYLES.input}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Description & Objectives
            </label>
            <RichTextEditor
              id="new-project-description-input"
              value={description}
              onChange={setDescription}
              placeholder="Key project goals, deliverables, and scope..."
              contextTitle={name}
              contextProject={name}
              contextType="project"
              onShowToast={onShowToast}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Client or Department
              </label>
              <div className="relative">
                <Briefcase className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="new-project-client-input"
                  type="text"
                  placeholder="e.g. Apex Horizon Bank"
                  value={client}
                  onChange={(e) => setClient(e.target.value)}
                  className={FORM_STYLES.inputWithIcon}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Project Status
              </label>
              <StatusDropdown
                id="new-project-status-select"
                status={status}
                onChange={setStatus}
                size="md"
                fullWidth
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Start Date
              </label>
              <DatePicker
                id="new-project-start-date"
                value={startDate}
                onChange={setStartDate}
                placeholder="Select start date"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Target Deadline <span className="text-rose-500">*</span>
                </label>
                {targetDeadline && isDueToday(targetDeadline) && (
                  <span className="text-2xs font-bold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 px-1.5 py-0.5 rounded flex items-center gap-1 animate-pulse shadow-2xs">
                    <AlertCircle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                    Due Today!
                  </span>
                )}
              </div>
              <DatePicker
                id="new-project-deadline-input"
                required
                value={targetDeadline}
                onChange={setTargetDeadline}
                placeholder="Select deadline"
                isDueToday={Boolean(targetDeadline && isDueToday(targetDeadline))}
              />
            </div>
          </div>

          {/* Project Lead */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Project Lead / Manager
            </label>
            <CustomSelect
              id="new-project-manager-select"
              value={managerId}
              onChange={setManagerId}
              fullWidth
              size="md"
              options={teamMembers.map((m) => ({
                value: m.id,
                label: m.name,
                sublabel: m.role,
                color: m.color || '#2563eb',
              }))}
            />
          </div>

          {/* Assign Team Members */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                Assign Team Members to Project
              </label>
              <div className="flex items-center gap-2">
                <span className="text-2xs text-slate-400 dark:text-slate-500">
                  {selectedMembers.length} of {teamMembers.length} selected
                </span>
                {onOpenAddMember && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenAddMember();
                    }}
                    className="text-2xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline inline-flex items-center gap-0.5 cursor-pointer"
                  >
                    <UserPlus className="w-3 h-3" />
                    + New Member
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto p-1 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50/50 dark:bg-slate-800/50">
              {teamMembers.map((member) => {
                const isSelected = selectedMembers.includes(member.id);
                return (
                  <div
                    key={member.id}
                    onClick={() => toggleMember(member.id)}
                    className={`flex items-center justify-between p-2 rounded-md cursor-pointer text-xs transition-colors ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200 font-medium'
                        : 'bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {member.avatar ? (
                        <img
                          src={member.avatar}
                          alt={member.name}
                          className="w-6 h-6 rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <div
                          style={{ backgroundColor: member.color || '#2563eb' }}
                          className="w-6 h-6 rounded-full text-white text-3xs font-semibold flex items-center justify-center shrink-0"
                        >
                          {member.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="truncate">
                        <p className="truncate font-medium">{member.name}</p>
                        <p className="text-2xs text-slate-500 dark:text-slate-400 truncate">{member.role}</p>
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 ml-1" />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tags & Color */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Category Tags (comma-separated)
              </label>
              <input
                id="new-project-tags-input"
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="Mobile, UI/UX, Sprint"
                className={FORM_STYLES.input}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Project Color Accent
              </label>
              <div className="flex items-center gap-2 pt-1">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    style={{ backgroundColor: c }}
                    className={`w-7 h-7 rounded-full transition-transform flex items-center justify-center text-white cursor-pointer ${
                      color === c ? 'scale-110 ring-2 ring-offset-2 ring-slate-400 dark:ring-offset-slate-900' : 'opacity-80 hover:opacity-100'
                    }`}
                  >
                    {color === c && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Audit Metadata (Created Date/By, Last Updated Date/By) */}
          {initialProject && (
            <div id="project-modal-audit-metadata-card" className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 rounded-xl space-y-2 text-2xs">
              <span className="text-3xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                Activity & Audit History
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Created By & Date */}
                <div className="flex items-center gap-2.5 bg-white dark:bg-slate-900/70 p-2 rounded-lg border border-slate-200/60 dark:border-slate-800 shadow-2xs">
                  {initialProject.createdByAvatar ? (
                    <img
                      src={initialProject.createdByAvatar}
                      alt={initialProject.createdByName || 'Creator'}
                      className="w-7 h-7 rounded-full object-cover shrink-0 border border-slate-200 dark:border-slate-700"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-bold text-3xs flex items-center justify-center shrink-0">
                      {(initialProject.createdByName || 'U').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <span className="text-slate-400 dark:text-slate-500 font-medium text-3xs">Created by:</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-200 truncate text-2xs">
                        {initialProject.createdByName || 'System'}
                      </span>
                    </div>
                    <span className="text-slate-500 dark:text-slate-400 text-3xs flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                      {formatDateTime(initialProject.createdAt)}
                    </span>
                  </div>
                </div>

                {/* Last Updated By & Date */}
                <div className="flex items-center gap-2.5 bg-white dark:bg-slate-900/70 p-2 rounded-lg border border-slate-200/60 dark:border-slate-800 shadow-2xs">
                  {initialProject.updatedByAvatar ? (
                    <img
                      src={initialProject.updatedByAvatar}
                      alt={initialProject.updatedByName || 'Updater'}
                      className="w-7 h-7 rounded-full object-cover shrink-0 border border-slate-200 dark:border-slate-700"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-3xs flex items-center justify-center shrink-0">
                      {(initialProject.updatedByName || initialProject.createdByName || 'U').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <span className="text-slate-400 dark:text-slate-500 font-medium text-3xs">Last updated by:</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-200 truncate text-2xs">
                        {initialProject.updatedByName || initialProject.createdByName || 'System'}
                      </span>
                    </div>
                    <span className="text-slate-500 dark:text-slate-400 text-3xs flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                      {formatDateTime(initialProject.updatedAt || initialProject.createdAt)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              id="cancel-new-project-btn"
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="submit-new-project-btn"
              type="submit"
              className="px-5 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              {initialProject ? (
                <>
                  <Check className="w-4 h-4" />
                  Save Project Changes
                </>
              ) : (
                <>
                  <FolderPlus className="w-4 h-4" />
                  Create Project
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
