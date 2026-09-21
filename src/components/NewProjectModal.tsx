import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  FolderPlus,
  Briefcase,
  Check,
  AlertCircle,
  Edit3,
  Clock,
  Paperclip,
  Pipette,
  Smartphone,
  Monitor,
} from 'lucide-react';
import { Project, StatusType, TeamMember, AuthUser, AttachedLink } from '../types';
import { isDueToday, formatDateTime } from '../utils/dateUtils';
import { FORM_STYLES } from '../utils/formStyles';
import { StatusDropdown } from './ui/StatusDropdown';
import { CustomSelect, CustomSelectOption } from './ui/CustomSelect';
import { DatePicker } from './ui/DatePicker';
import { RichTextEditor } from './ui/RichTextEditor';
import { DocumentAttachmentManager } from './DocumentAttachmentManager';
import { LinkAttachmentManager } from './LinkAttachmentManager';
import { TeamMemberMultiSelect } from './ui/TeamMemberMultiSelect';
import { ColorPickerPopover } from './ui/ColorPickerPopover';

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
  const [projectFor, setProjectFor] = useState<string[]>(['Mobile App UI', 'Web UI']);

  // Helper to find the Admin member ID for automatic Project Lead / Manager assignment
  const findAdminMemberId = () => {
    if (currentUser?.role === 'admin' && currentUser.memberId) {
      const match = teamMembers.find((m) => m.id === currentUser.memberId);
      if (match) return match.id;
    }
    const adminBySystem = teamMembers.find(
      (m) => m.systemRole === 'admin' || (m as any).system_role === 'admin'
    );
    if (adminBySystem) return adminBySystem.id;

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
  const [activeMobileTab, setActiveMobileTab] = useState<'details' | 'documents' | 'activity'>('details');
  const [activeRightTab, setActiveRightTab] = useState<'documents' | 'activity'>('documents');
  const [attachmentCount, setAttachmentCount] = useState<number>(0);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const customColorButtonRef = useRef<HTMLButtonElement>(null);

  // Options for Project Lead / Manager dropdown (matching TaskModal assignee style)
  const leadOptions: CustomSelectOption[] = useMemo(() => {
    const sorted = [...teamMembers].sort((a, b) => {
      const aIsSelf = Boolean(currentUser && a.id === currentUser.memberId);
      const bIsSelf = Boolean(currentUser && b.id === currentUser.memberId);
      if (aIsSelf && !bIsSelf) return -1;
      if (!aIsSelf && bIsSelf) return 1;

      const aInProject = selectedMembers.includes(a.id) ? 1 : 0;
      const bInProject = selectedMembers.includes(b.id) ? 1 : 0;
      if (bInProject !== aInProject) return bInProject - aInProject;

      const aIsAdmin = a.systemRole === 'admin' || (a as any).system_role === 'admin';
      const bIsAdmin = b.systemRole === 'admin' || (b as any).system_role === 'admin';
      if (aIsAdmin && !bIsAdmin) return -1;
      if (!aIsAdmin && bIsAdmin) return 1;

      return a.name.localeCompare(b.name);
    });

    return sorted.map((member) => {
      const isSelf = Boolean(currentUser && member.id === currentUser.memberId);
      const isInProject = selectedMembers.includes(member.id);

      return {
        value: member.id,
        label: isSelf ? `${member.name} (You)` : member.name,
        sublabel: member.role || member.email,
        badge: isInProject ? 'Project' : undefined,
        icon: member.avatar ? (
          <img
            src={member.avatar}
            alt={member.name}
            className="w-5 h-5 rounded-full object-cover shrink-0 border border-slate-200 dark:border-slate-700"
          />
        ) : (
          <div
            style={{ backgroundColor: member.color || '#2563eb' }}
            className="w-5 h-5 rounded-full text-white text-3xs font-semibold flex items-center justify-center shrink-0 shadow-2xs"
          >
            {member.name.slice(0, 2).toUpperCase()}
          </div>
        ),
      };
    });
  }, [teamMembers, selectedMembers, currentUser]);

  useEffect(() => {
    setStagedFiles([]);
    setActiveMobileTab('details');
    setActiveRightTab('documents');
    setAttachmentCount(0);
    setIsColorPickerOpen(false);
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
      setProjectFor(
        Array.isArray(initialProject.projectFor) && initialProject.projectFor.length > 0
          ? initialProject.projectFor
          : ['Mobile App UI', 'Web UI']
      );
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
      setProjectFor(['Mobile App UI', 'Web UI']);
    }
  }, [initialProject, isOpen, teamMembers, currentUser]);

  const toggleScope = (scope: string) => {
    if (projectFor.includes(scope)) {
      if (projectFor.length > 1) {
        setProjectFor(projectFor.filter((s) => s !== scope));
      }
    } else {
      setProjectFor([...projectFor, scope]);
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
        projectFor: projectFor.length > 0 ? projectFor : ['Mobile App UI', 'Web UI'],
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
        className="w-full max-w-5xl glass-modal rounded-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="px-4 py-3 sm:px-6 sm:py-3.5 glass-modal-header flex items-center justify-between shrink-0">
          <div>
            <span className="text-2xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {client ? `Client: ${client}` : 'Project Initiative'}
            </span>
            <h2 id="new-project-title" className="text-base font-semibold text-slate-900 dark:text-white leading-tight">
              {initialProject ? 'Edit Project Details' : 'Create New Project'}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {/* Mobile Tab Switcher */}
            <div className="flex items-center lg:hidden bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
              <button
                type="button"
                onClick={() => setActiveMobileTab('details')}
                className={`px-2.5 py-1 rounded-md font-medium cursor-pointer transition-colors ${
                  activeMobileTab === 'details'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-2xs font-semibold'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                }`}
              >
                Details
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveMobileTab('documents');
                  setActiveRightTab('documents');
                }}
                className={`px-2.5 py-1 rounded-md font-medium cursor-pointer transition-colors inline-flex items-center gap-1.5 ${
                  activeMobileTab === 'documents'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-2xs font-semibold'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                }`}
              >
                <Paperclip className="w-3.5 h-3.5" />
                <span>Docs</span>
                {(initialProject ? attachmentCount : stagedFiles.length) > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-3xs bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-bold">
                    {initialProject ? attachmentCount : stagedFiles.length}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveMobileTab('activity');
                  setActiveRightTab('activity');
                }}
                className={`px-2.5 py-1 rounded-md font-medium cursor-pointer transition-colors inline-flex items-center gap-1.5 ${
                  activeMobileTab === 'activity'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-2xs font-semibold'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Info</span>
              </button>
            </div>

            <button
              id="close-new-project-btn"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Main Split Content (Left Form + Right Documents/Overview) */}
        <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
          {/* Left Column: Project Form */}
          <div
            className={`flex-1 flex flex-col min-h-0 overflow-hidden ${
              activeMobileTab !== 'details' ? 'hidden lg:flex' : 'flex'
            }`}
          >
            <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                {/* Project Name */}
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

                {/* Description & Objectives */}
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

                {/* Attached Links */}
                <div>
                  <LinkAttachmentManager links={links} onChange={setLinks} />
                </div>

                {/* What is this project for? */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      What is this project for? <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-3xs text-slate-400 dark:text-slate-500">
                      Check applicable platform scopes (at least one)
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <label
                      className={`relative flex items-start gap-3 p-3 rounded-xl border cursor-pointer select-none transition-all ${
                        projectFor.includes('Mobile App UI')
                          ? 'border-purple-300 dark:border-purple-600/80 bg-purple-50/70 dark:bg-purple-950/30 ring-1 ring-purple-400/50 dark:ring-purple-500/30'
                          : 'border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <input
                        type="checkbox"
                        id="scope-checkbox-mobile"
                        checked={projectFor.includes('Mobile App UI')}
                        onChange={() => toggleScope('Mobile App UI')}
                        className="mt-0.5 rounded border-slate-300 text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <Smartphone className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Mobile App UI</span>
                        </div>
                        <p className="text-3xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                          iOS & Android mobile app screens, responsive mobile layouts
                        </p>
                      </div>
                    </label>

                    <label
                      className={`relative flex items-start gap-3 p-3 rounded-xl border cursor-pointer select-none transition-all ${
                        projectFor.includes('Web UI')
                          ? 'border-sky-300 dark:border-sky-600/80 bg-sky-50/70 dark:bg-sky-950/30 ring-1 ring-sky-400/50 dark:ring-sky-500/30'
                          : 'border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <input
                        type="checkbox"
                        id="scope-checkbox-web"
                        checked={projectFor.includes('Web UI')}
                        onChange={() => toggleScope('Web UI')}
                        className="mt-0.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500 w-4 h-4 cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <Monitor className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Web UI</span>
                        </div>
                        <p className="text-3xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                          Desktop web dashboard, admin portal & browser interfaces
                        </p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Client & Status */}
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

                {/* Timeline Dates */}
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
                    placeholder="Select project lead or manager..."
                    options={leadOptions}
                  />
                </div>

                {/* Assign Team Members */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Assign Team Members to Project
                  </label>
                  <TeamMemberMultiSelect
                    id="new-project-team-members-select"
                    members={teamMembers}
                    selectedMemberIds={selectedMembers}
                    onChange={setSelectedMembers}
                    placeholder="Select team members for this project..."
                  />
                </div>

                {/* Tags & Color Accent */}
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

                      {/* Custom Color Swatch with Custom ColorPickerPopover */}
                      {(() => {
                        const isCustomColor = !COLOR_OPTIONS.some((c) => c.toLowerCase() === color.trim().toLowerCase());

                        return (
                          <div className="relative flex items-center">
                            <button
                              ref={customColorButtonRef}
                              type="button"
                              onClick={() => setIsColorPickerOpen((prev) => !prev)}
                              className={`w-7 h-7 rounded-full transition-all flex items-center justify-center cursor-pointer shadow-xs relative ${
                                isCustomColor
                                  ? 'scale-110 ring-2 ring-offset-2 ring-slate-400 dark:ring-offset-slate-900 text-white'
                                  : 'border-2 border-dashed border-slate-300 dark:border-slate-600 bg-slate-100/80 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 hover:border-slate-400 dark:hover:border-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:scale-105'
                              }`}
                              style={isCustomColor ? { backgroundColor: color } : undefined}
                              title="Pick custom color"
                            >
                              {isCustomColor ? (
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                              ) : (
                                <Pipette className="w-3.5 h-3.5" />
                              )}
                            </button>

                            <ColorPickerPopover
                              color={color}
                              onChange={setColor}
                              isOpen={isColorPickerOpen}
                              onClose={() => setIsColorPickerOpen(false)}
                              anchorRef={customColorButtonRef}
                            />
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Pinned Left Footer */}
              <div className="p-3 sm:p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex items-center justify-end gap-3 shrink-0">
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
                      <span>Save Project Changes</span>
                    </>
                  ) : (
                    <>
                      <FolderPlus className="w-4 h-4" />
                      <span>Create Project</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Right Column: Documents & Overview/Activity (Same as TaskModal) */}
          <div
            id="project-right-panel"
            className={`w-full lg:w-[420px] xl:w-[480px] border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 flex flex-col min-h-0 overflow-hidden shrink-0 ${
              activeMobileTab === 'details' ? 'hidden lg:flex' : 'flex'
            }`}
          >
            {/* Right Panel Header: Tabs */}
            <div className="p-2.5 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2 bg-white dark:bg-slate-900/80 shrink-0">
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setActiveRightTab('documents');
                    setActiveMobileTab('documents');
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                    activeRightTab === 'documents'
                      ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                  }`}
                >
                  <Paperclip className="w-3.5 h-3.5" />
                  <span>Documents</span>
                  {(initialProject ? attachmentCount : stagedFiles.length) > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-3xs font-bold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">
                      {initialProject ? attachmentCount : stagedFiles.length}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveRightTab('activity');
                    setActiveMobileTab('activity');
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                    activeRightTab === 'activity'
                      ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>{initialProject ? 'Activity & Audit' : 'Overview'}</span>
                </button>
              </div>
            </div>

            {/* Right Panel Body */}
            {activeRightTab === 'documents' ? (
              <div className="flex-1 overflow-y-auto p-4 min-h-0 custom-scrollbar bg-white dark:bg-slate-900/60">
                <DocumentAttachmentManager
                  projectId={initialProject?.id}
                  projectName={initialProject?.name || name || 'Project'}
                  currentUser={currentUser}
                  onAttachmentCountChange={setAttachmentCount}
                  isCreateMode={!initialProject}
                  stagedFiles={stagedFiles}
                  onStagedFilesChange={setStagedFiles}
                />
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 min-h-0 space-y-4 bg-white dark:bg-slate-900/60">
                {initialProject ? (
                  <div className="space-y-4">
                    <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 rounded-xl space-y-3">
                      <span className="text-3xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                        Activity & Audit History
                      </span>

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

                    {/* Summary Card */}
                    <div className="p-3.5 bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 rounded-xl space-y-2">
                      <h5 className="text-2xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Project Overview
                      </h5>
                      <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                        <div className="flex justify-between items-center py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                          <span className="text-slate-400 text-2xs">Client:</span>
                          <span className="font-semibold">{client || 'Internal Initiative'}</span>
                        </div>
                        <div className="flex justify-between items-center py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                          <span className="text-slate-400 text-2xs">Status:</span>
                          <span className="font-semibold">{status}</span>
                        </div>
                        <div className="flex justify-between items-center py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                          <span className="text-slate-400 text-2xs">Assigned Team:</span>
                          <span className="font-semibold">{selectedMembers.length} members</span>
                        </div>
                        <div className="flex justify-between items-center py-1">
                          <span className="text-slate-400 text-2xs">Target Deadline:</span>
                          <span className="font-semibold">{targetDeadline}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-800/60">
                      <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 font-bold text-xs mb-1.5">
                        <FolderPlus className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        <span>Project Setup Guide</span>
                      </div>
                      <p className="text-2xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        Organize your team, track deliverables, and keep all documents and links centralized.
                      </p>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200/60 dark:border-slate-800">
                        <span className="font-semibold text-slate-800 dark:text-slate-200 block mb-0.5">Platform Scopes</span>
                        <span className="text-2xs text-slate-500 dark:text-slate-400 leading-relaxed block">
                          Choose Mobile App UI, Web UI, or both to restrict tasks to the right platform deliverables.
                        </span>
                      </div>

                      <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200/60 dark:border-slate-800">
                        <span className="font-semibold text-slate-800 dark:text-slate-200 block mb-0.5">Project Documents</span>
                        <span className="text-2xs text-slate-500 dark:text-slate-400 leading-relaxed block">
                          Switch to the <strong className="text-blue-600 dark:text-blue-400">Documents</strong> tab to drag & drop PRDs, spreadsheets, or design specs.
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
