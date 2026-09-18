import React, { useState, useEffect } from 'react';
import { X, FolderPlus, Users, Briefcase, Check, UserPlus, ChevronDown, AlertCircle, Edit3, Clock, Paperclip, Pipette } from 'lucide-react';
import { Project, StatusType, TeamMember, AuthUser, AttachedLink } from '../types';
import { isDueToday, formatDateTime } from '../utils/dateUtils';
import { FORM_STYLES } from '../utils/formStyles';
import { StatusDropdown } from './ui/StatusDropdown';
import { CustomSelect } from './ui/CustomSelect';
import { DatePicker } from './ui/DatePicker';
import { RichTextEditor } from './ui/RichTextEditor';
import { DocumentAttachmentManager } from './DocumentAttachmentManager';
import { LinkAttachmentManager } from './LinkAttachmentManager';

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    project: Omit<Project, 'id' | 'createdAt'>,
    projectId?: string,
    stagedFiles?: File[]
  ) => Promise<void> | void;
  initialProject?: Project | null;
  teamMembers: TeamMember[];
  onOpenAddMember?: () => void;
  currentUser?: AuthUser | null;
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
  currentUser,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [client, setClient] = useState('');
  const [status, setStatus] = useState<StatusType>('In Progress');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [targetDeadline, setTargetDeadline] = useState(
    new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
  );
  // Helper to find the Admin member ID for automatic Project Lead / Manager assignment
  const findAdminMemberId = () => {
    // 1. If currentUser is logged in as Admin, use their memberId
    if (currentUser?.role === 'admin' && currentUser.memberId) {
      const match = teamMembers.find((m) => m.id === currentUser.memberId);
      if (match) return match.id;
    }
    // 2. Find any team member with admin systemRole
    const adminBySystem = teamMembers.find(
      (m) => m.systemRole === 'admin' || (m as any).system_role === 'admin'
    );
    if (adminBySystem) return adminBySystem.id;

    // 3. Find any member whose role or name indicates Admin / Lead
    const adminByRole = teamMembers.find(
      (m) =>
        m.role?.toLowerCase() === 'admin' ||
        m.role?.toLowerCase().includes('lead') ||
        m.name?.toLowerCase().includes('vichet')
    );
    if (adminByRole) return adminByRole.id;

    return teamMembers[0]?.id || '';
  };

  const [managerId, setManagerId] = useState(() => findAdminMemberId());
  const [selectedMembers, setSelectedMembers] = useState<string[]>(() => {
    const adminId = findAdminMemberId();
    const initialList = [adminId, ...teamMembers.filter((m) => m.id !== adminId).slice(0, 2).map((m) => m.id)].filter(Boolean);
    return initialList.length > 0 ? initialList : teamMembers.slice(0, 3).map((m) => m.id);
  });
  const [tagsInput, setTagsInput] = useState('Core, Sprint 1');
  const [color, setColor] = useState(COLOR_OPTIONS[0]);
  const [links, setLinks] = useState<AttachedLink[]>([]);
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);

  useEffect(() => {
    setStagedFiles([]);
    const defaultAdminId = findAdminMemberId();
    if (initialProject) {
      setName(initialProject.name || '');
      setDescription(initialProject.description || '');
      setClient(initialProject.client || '');
      setStatus(initialProject.status || 'In Progress');
      setStartDate(initialProject.startDate || new Date().toISOString().split('T')[0]);
      setTargetDeadline(initialProject.targetDeadline || new Date().toISOString().split('T')[0]);
      setManagerId(initialProject.managerId || defaultAdminId);
      setSelectedMembers(
        initialProject.memberIds && initialProject.memberIds.length > 0
          ? initialProject.memberIds
          : [defaultAdminId || teamMembers[0]?.id || '']
      );
      setTagsInput(Array.isArray(initialProject.tags) ? initialProject.tags.join(', ') : 'Core');
      setColor(initialProject.color || COLOR_OPTIONS[0]);
      setLinks(Array.isArray(initialProject.links) ? initialProject.links : []);
    } else {
      setName('');
      setDescription('');
      setClient('');
      setStatus('In Progress');
      setStartDate(new Date().toISOString().split('T')[0]);
      setTargetDeadline(new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]);
      setManagerId(defaultAdminId);
      const initialList = [
        defaultAdminId,
        ...teamMembers.filter((m) => m.id !== defaultAdminId).slice(0, 2).map((m) => m.id),
      ].filter(Boolean);
      setSelectedMembers(initialList.length > 0 ? initialList : teamMembers.slice(0, 3).map((m) => m.id));
      setTagsInput('Core, Sprint 1');
      setColor(COLOR_OPTIONS[0]);
      setLinks([]);
    }
  }, [initialProject, isOpen, teamMembers, currentUser]);

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
        color: color.trim().startsWith('#') ? color.trim() : color.trim() ? `#${color.trim()}` : COLOR_OPTIONS[0],
        links,
      },
      initialProject ? initialProject.id : undefined,
      stagedFiles
    );

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      id="new-project-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center glass-modal-backdrop p-2 sm:p-4 animate-in fade-in duration-150"
    >
      <div
        id="new-project-modal-card"
        className="w-full max-w-3xl glass-modal rounded-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="px-4 py-3 sm:px-6 sm:py-4 glass-modal-header flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              {initialProject ? <Edit3 className="w-5 h-5" /> : <FolderPlus className="w-5 h-5" />}
            </div>
            <div>
              <h2 id="new-project-title" className="text-base font-semibold text-slate-900 dark:text-white leading-tight">
                {initialProject ? 'Edit Project Details' : 'Create New Project'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 sm:line-clamp-none">
                {initialProject
                  ? 'Update deliverables timeline, status, and assigned project team'
                  : 'Set timeline, status, and assign team members to this project'}
              </p>
            </div>
          </div>
          <button
            id="close-new-project-btn"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
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
            />
          </div>

          <div>
            <LinkAttachmentManager
              links={links}
              onChange={setLinks}
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
              options={[...teamMembers]
                .sort((a, b) => {
                  const aIsAdmin =
                    a.systemRole === 'admin' ||
                    (a as any).system_role === 'admin' ||
                    a.id === currentUser?.memberId;
                  const bIsAdmin =
                    b.systemRole === 'admin' ||
                    (b as any).system_role === 'admin' ||
                    b.id === currentUser?.memberId;
                  if (aIsAdmin && !bIsAdmin) return -1;
                  if (!aIsAdmin && bIsAdmin) return 1;
                  return a.name.localeCompare(b.name);
                })
                .map((m) => {
                  const isAdmin =
                    m.systemRole === 'admin' ||
                    (m as any).system_role === 'admin' ||
                    m.role?.toLowerCase() === 'admin';
                  return {
                    value: m.id,
                    label: m.name,
                    sublabel: isAdmin ? `${m.role} • Admin` : m.role,
                    color: m.color || '#2563eb',
                  };
                })}
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
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Project Color Accent
                </label>
                <span className="text-3xs font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700 uppercase">
                  {color.startsWith('#') ? color : `#${color}`}
                </span>
              </div>
              <div className="flex items-center gap-2 pt-1 flex-wrap">
                {COLOR_OPTIONS.map((c) => {
                  const isSelected = color.toLowerCase() === c.toLowerCase();
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      style={{ backgroundColor: c }}
                      className={`w-7 h-7 rounded-full transition-all flex items-center justify-center text-white cursor-pointer ${
                        isSelected
                          ? 'scale-110 ring-2 ring-offset-2 ring-slate-400 dark:ring-offset-slate-900 shadow-xs'
                          : 'opacity-80 hover:opacity-100 hover:scale-105'
                      }`}
                      title={c}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </button>
                  );
                })}

                {/* Custom Color Swatch with Native Spectrum Color Picker */}
                {(() => {
                  const isCustomColor = !COLOR_OPTIONS.some((c) => c.toLowerCase() === color.trim().toLowerCase());
                  const validPickerColor = /^#[0-9A-Fa-f]{6}$/.test(color.trim())
                    ? color.trim()
                    : /^#[0-9A-Fa-f]{3}$/.test(color.trim())
                    ? `#${color.trim()[1]}${color.trim()[1]}${color.trim()[2]}${color.trim()[2]}${color.trim()[3]}${color.trim()[3]}`
                    : COLOR_OPTIONS[0];

                  return (
                    <>
                      <div className="relative flex items-center">
                        <label
                          htmlFor="custom-project-color-picker"
                          className={`w-7 h-7 rounded-full transition-all flex items-center justify-center cursor-pointer shadow-xs relative ${
                            isCustomColor
                              ? 'scale-110 ring-2 ring-offset-2 ring-slate-400 dark:ring-offset-slate-900 text-white'
                              : 'border-2 border-dashed border-slate-300 dark:border-slate-600 bg-slate-100/80 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 hover:border-slate-400 dark:hover:border-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:scale-105'
                          }`}
                          style={isCustomColor ? { backgroundColor: color } : undefined}
                          title="Pick custom color from spectrum palette"
                        >
                          {isCustomColor ? (
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          ) : (
                            <Pipette className="w-3.5 h-3.5" />
                          )}
                          <input
                            id="custom-project-color-picker"
                            type="color"
                            value={validPickerColor}
                            onChange={(e) => setColor(e.target.value)}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                          />
                        </label>
                      </div>

                      {/* Direct HEX code text input */}
                      <div className="relative flex items-center">
                        <input
                          type="text"
                          value={color}
                          onChange={(e) => {
                            let val = e.target.value.trim();
                            if (val && !val.startsWith('#')) val = '#' + val;
                            setColor(val);
                          }}
                          placeholder="#2563EB"
                          maxLength={7}
                          className="w-[78px] px-2 py-1 text-xs font-mono font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500/50 uppercase shadow-2xs"
                          title="Type or paste custom HEX color"
                        />
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* Project Documents & Attachments */}
          <div className="border-t border-slate-200/80 dark:border-slate-800 pt-4 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Paperclip className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                Project Documents & Attachments
              </label>
              {stagedFiles.length > 0 && !initialProject && (
                <span className="text-2xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                  {stagedFiles.length} file{stagedFiles.length > 1 ? 's' : ''} staged for upload
                </span>
              )}
            </div>
            <div className="bg-slate-50/50 dark:bg-slate-800/40 rounded-xl p-3 border border-slate-200 dark:border-slate-800">
              <DocumentAttachmentManager
                projectId={initialProject?.id}
                projectName={initialProject?.name || name || 'Project'}
                currentUser={currentUser}
                isCreateMode={!initialProject}
                stagedFiles={stagedFiles}
                onStagedFilesChange={setStagedFiles}
              />
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
          <div className="pt-4 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-end gap-3">
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
