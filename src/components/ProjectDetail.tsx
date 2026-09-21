import React, { useState, useMemo, useEffect } from 'react';
import {
  ArrowLeft,
  Plus,
  Calendar,
  Layers,
  Users,
  Edit2,
  Trash2,
  CopyPlus,
  CheckCircle2,
  AlertCircle,
  Clock,
  Briefcase,
  Search,
  Filter,
  Check,
  X,
  UserPlus,
  GripVertical,
  AlertTriangle,
  ChevronDown,
  Lock,
  ShieldCheck,
  UserCheck,
  Eye,
  ChevronsLeft,
  ChevronsRight,
  MessageSquare,
  CheckSquare,
  Share2,
  Link as LinkIcon,
  Paperclip,
  FileText,
  Smartphone,
  Monitor,
  MoreVertical,
  MoveLeft,
  MoveRight,
  Palette,
} from 'lucide-react';
import { Project, Task, TeamMember, StatusType, PriorityType, AuthUser, ProjectStage, StageCategory, DEFAULT_PROJECT_STAGES } from '../types';
import { getProjectShareUrl, getTaskShareUrl, copyTextToClipboard } from '../utils/shareUtils';
import { getDueDateStatus, isDueToday, formatDateTime } from '../utils/dateUtils';
import { FORM_STYLES } from '../utils/formStyles';
import { StatusBadge, PriorityBadge, ScopeBadge, getStatusBadgeClass, getPriorityBadgeClass } from './Badges';
import { StatusDropdown } from './ui/StatusDropdown';
import { CustomSelect } from './ui/CustomSelect';
import { FormattedText } from './ui/FormattedText';
import { DocumentAttachmentManager } from './DocumentAttachmentManager';
import { LinkAttachmentManager } from './LinkAttachmentManager';
import { ShareProjectModal } from './ShareProjectModal';
import { ProjectReportModal } from './ProjectReportModal';
import { TeamCapacityBarometer } from './TeamCapacityBarometer';
import { fetchAttachmentsApi, updateProjectStagesApi, deleteProjectStageApi } from '../services/api';

interface ProjectDetailProps {
  project: Project;
  tasks: Task[];
  teamMembers: TeamMember[];
  allTasks?: Task[];
  onBackToDashboard: () => void;
  onUpdateProjectStatus: (projectId: string, newStatus: StatusType) => void;
  onUpdateProjectMembers: (projectId: string, memberIds: string[]) => void;
  onOpenTaskModal: (task?: Task | null, defaultStatus?: StatusType, defaultAssigneeId?: string) => void;
  onDeleteTaskRequest: (task: Task) => void;
  onUpdateTaskStatus: (taskId: string, newStatus: StatusType) => void;
  onReassignTask: (taskId: string, assigneeId: string) => void;
  onOpenAddMember?: () => void;
  currentUser?: AuthUser | null;
  onEditProject?: (project: Project) => void;
  onDeleteProject?: (project: Project) => void;
  onDuplicateTask?: (task: Task) => void;
  onUpdateProjectStages?: (projectId: string, newStages: ProjectStage[]) => Promise<void> | void;
  onDeleteProjectStage?: (projectId: string, stageId: string, stageName: string, reassignToStageName?: string) => Promise<void> | void;
  onTasksChange?: () => void;
}

const STAGE_COLOR_PRESETS = [
  { label: 'Slate', hex: '#6b7280' },
  { label: 'Blue', hex: '#3b82f6' },
  { label: 'Indigo', hex: '#6366f1' },
  { label: 'Purple', hex: '#8b5cf6' },
  { label: 'Pink', hex: '#ec4899' },
  { label: 'Rose', hex: '#ef4444' },
  { label: 'Amber', hex: '#f59e0b' },
  { label: 'Emerald', hex: '#10b981' },
  { label: 'Teal', hex: '#14b8a6' },
];

const STAGE_CATEGORY_INFO: Record<StageCategory, { label: string; description: string; badgeCls: string }> = {
  backlog: {
    label: 'Backlog / Planning',
    description: 'Initial drafting, ideas, or untriaged tasks',
    badgeCls: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  },
  active: {
    label: 'Active Work',
    description: 'Actively in progress or under review (Staff & Admin)',
    badgeCls: 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300',
  },
  blocked: {
    label: 'Blocked',
    description: 'Tasks needing escalation or blocked by dependencies',
    badgeCls: 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300',
  },
  done: {
    label: 'Done / Completed',
    description: 'Finished or deployed deliverables (Admin Only)',
    badgeCls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
  },
};

export const ProjectDetail: React.FC<ProjectDetailProps> = ({
  project,
  tasks = [],
  teamMembers = [],
  allTasks,
  onBackToDashboard,
  onUpdateProjectStatus,
  onUpdateProjectMembers,
  onOpenTaskModal,
  onDeleteTaskRequest,
  onUpdateTaskStatus,
  onReassignTask,
  onOpenAddMember,
  currentUser,
  onEditProject,
  onDeleteProject,
  onDuplicateTask,
  onUpdateProjectStages,
  onDeleteProjectStage,
  onTasksChange,
}) => {
  const isAdmin = currentUser?.role === 'admin';
  const isStaff = currentUser?.role === 'staff';
  const isAssignedToProject =
    isAdmin || (isStaff && (project?.memberIds || []).includes(currentUser?.memberId || ''));

  const [activeTab, setActiveTab] = useState<'board' | 'team' | 'documents'>('board');
  const [projectAttachmentCount, setProjectAttachmentCount] = useState<number>(0);
  const [filterMemberId, setFilterMemberId] = useState<string>('all');
  const [filterScope, setFilterScope] = useState<string>('all');
  const [searchTaskQuery, setSearchTaskQuery] = useState('');
  const [isManagingMembers, setIsManagingMembers] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>(project?.memberIds || []);

  // Custom Stages State
  const [isAddStageModalOpen, setIsAddStageModalOpen] = useState(false);
  const [newStageName, setNewStageName] = useState('');
  const [newStageColor, setNewStageColor] = useState('#3b82f6');
  const [newStageCategory, setNewStageCategory] = useState<StageCategory>('active');
  const [isSubmittingStage, setIsSubmittingStage] = useState(false);

  const [editingStage, setEditingStage] = useState<ProjectStage | null>(null);
  const [editStageName, setEditStageName] = useState('');
  const [editStageColor, setEditStageColor] = useState('#3b82f6');
  const [editStageCategory, setEditStageCategory] = useState<StageCategory>('active');

  const [openMenuStageId, setOpenMenuStageId] = useState<string | null>(null);

  const [stageToDelete, setStageToDelete] = useState<ProjectStage | null>(null);
  const [fallbackStageName, setFallbackStageName] = useState('');
  const [isDeletingStage, setIsDeletingStage] = useState(false);

  const effectiveStages: ProjectStage[] = useMemo(() => {
    if (project?.stages && project.stages.length > 0) {
      return project.stages;
    }
    return DEFAULT_PROJECT_STAGES;
  }, [project?.stages]);

  useEffect(() => {
    if (!openMenuStageId) return;
    const handleClickOutside = () => setOpenMenuStageId(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, [openMenuStageId]);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<StatusType | null>(null);
  const [collapsedColumns, setCollapsedColumns] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(`pm_collapsed_columns_${project?.id || 'default'}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          Draft: parsed.Draft !== undefined ? parsed.Draft : true,
          Completed: parsed.Completed !== undefined ? parsed.Completed : true,
          ...parsed,
        };
      }
    } catch {
      // fallback
    }
    return { Draft: true, Completed: true };
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`pm_collapsed_columns_${project?.id || 'default'}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        setCollapsedColumns({
          Draft: parsed.Draft !== undefined ? parsed.Draft : true,
          Completed: parsed.Completed !== undefined ? parsed.Completed : true,
          ...parsed,
        });
        return;
      }
    } catch {
      // ignore
    }
    setCollapsedColumns({ Draft: true, Completed: true });
  }, [project?.id]);

  useEffect(() => {
    if (project?.id) {
      fetchAttachmentsApi(project.id)
        .then((items) => setProjectAttachmentCount(items.length))
        .catch(() => {});
    }
  }, [project?.id]);

  const toggleColumnCollapse = (status: StatusType) => {
    setCollapsedColumns((prev) => {
      const updated = { ...prev, [status]: !prev[status] };
      try {
        localStorage.setItem(`pm_collapsed_columns_${project?.id || 'default'}`, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    const task = safeTasks.find((t) => t.id === taskId);
    if (!task) return;

    const canMove =
      isAdmin ||
      (task.createdBy && task.createdBy === currentUser?.memberId) ||
      task.assigneeId === currentUser?.memberId;

    if (!canMove) {
      e.preventDefault();
      return;
    }

    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedTaskId(taskId);
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
    setDragOverColumn(null);
  };

  const canModifyDraggedTask = useMemo(() => {
    if (isAdmin) return true;
    if (!draggedTaskId) return false;
    const task = (Array.isArray(tasks) ? tasks : []).find((t) => t.id === draggedTaskId);
    if (!task) return false;
    const isTaskDone =
      (effectiveStages.find((s) => s.name === task.status)?.category === 'done') ||
      task.status === 'Completed';
    if (isStaff && isTaskDone) return false;
    return Boolean(
      (task.createdBy && task.createdBy === currentUser?.memberId) ||
      task.assigneeId === currentUser?.memberId
    );
  }, [isAdmin, isStaff, draggedTaskId, tasks, currentUser, effectiveStages]);

  const handleDragOver = (e: React.DragEvent, status: StatusType) => {
    if (!isAdmin && !canModifyDraggedTask) return;
    const isTargetDone =
      (effectiveStages.find((s) => s.name === status)?.category === 'done') ||
      status === 'Completed';
    if (isStaff && isTargetDone) {
      e.dataTransfer.dropEffect = 'none';
      return;
    }
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColumn !== status) {
      setDragOverColumn(status);
    }
  };

  const handleDragLeave = (e: React.DragEvent, status: StatusType) => {
    if (!isAdmin && !canModifyDraggedTask) return;
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    if (dragOverColumn === status) {
      setDragOverColumn(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetStatus: StatusType) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId;
    if (taskId) {
      const task = safeTasks.find((t) => t.id === taskId);
      if (task) {
        const canModify =
          isAdmin ||
          (isStaff &&
            ((task.createdBy && task.createdBy === currentUser?.memberId) ||
              task.assigneeId === currentUser?.memberId));
        if (canModify && task.status !== targetStatus) {
          const isTargetDone =
            (effectiveStages.find((s) => s.name === targetStatus)?.category === 'done') ||
            targetStatus === 'Completed';
          const isTaskDone =
            (effectiveStages.find((s) => s.name === task.status)?.category === 'done') ||
            task.status === 'Completed';

          if (isStaff && (isTargetDone || isTaskDone)) {
            setDraggedTaskId(null);
            setDragOverColumn(null);
            return;
          }
          onUpdateTaskStatus(taskId, targetStatus);
        }
      }
    }
    setDraggedTaskId(null);
    setDragOverColumn(null);
  };

  // Stage Management Handlers
  const handleAddStage = async () => {
    if (!isAdmin || !newStageName.trim()) return;
    if (effectiveStages.some((s) => s.name.trim().toLowerCase() === newStageName.trim().toLowerCase())) {
      alert(`A column named "${newStageName.trim()}" already exists.`);
      return;
    }

    const newStage: ProjectStage = {
      id: `stage-${Date.now()}`,
      name: newStageName.trim(),
      color: newStageColor || '#3b82f6',
      category: newStageCategory,
    };

    const updated = [...effectiveStages, newStage];

    try {
      setIsSubmittingStage(true);
      if (onUpdateProjectStages) {
        await onUpdateProjectStages(project.id, updated);
      } else {
        await updateProjectStagesApi(project.id, updated, currentUser);
      }
      setIsAddStageModalOpen(false);
      setNewStageName('');
      setNewStageColor('#3b82f6');
      setNewStageCategory('active');
    } catch (err: any) {
      alert(err.message || 'Failed to add column');
    } finally {
      setIsSubmittingStage(false);
    }
  };

  const handleSaveEditStage = async () => {
    if (!isAdmin || !editingStage || !editStageName.trim()) return;
    const oldName = editingStage.name;
    const newName = editStageName.trim();

    const updated = effectiveStages.map((s) =>
      s.id === editingStage.id
        ? {
            ...s,
            name: newName,
            color: editStageColor,
            category: editStageCategory,
          }
        : s
    );

    try {
      setIsSubmittingStage(true);
      if (onUpdateProjectStages) {
        await onUpdateProjectStages(project.id, updated);
      } else {
        await updateProjectStagesApi(project.id, updated, currentUser);
      }
      if (oldName !== newName && onTasksChange) {
        onTasksChange();
      }
      setEditingStage(null);
    } catch (err: any) {
      alert(err.message || 'Failed to update column');
    } finally {
      setIsSubmittingStage(false);
    }
  };

  const handleMoveStage = async (stageIndex: number, direction: 'left' | 'right') => {
    if (!isAdmin) return;
    const targetIndex = direction === 'left' ? stageIndex - 1 : stageIndex + 1;
    if (targetIndex < 0 || targetIndex >= effectiveStages.length) return;

    const updated = [...effectiveStages];
    const [removed] = updated.splice(stageIndex, 1);
    updated.splice(targetIndex, 0, removed);

    try {
      if (onUpdateProjectStages) {
        await onUpdateProjectStages(project.id, updated);
      } else {
        await updateProjectStagesApi(project.id, updated, currentUser);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to reorder columns');
    }
  };

  const handleConfirmDeleteStage = async () => {
    if (!isAdmin || !stageToDelete) return;
    if (effectiveStages.length <= 1) {
      alert('A project must have at least one column.');
      return;
    }

    const tasksInColumn = safeTasks.filter(
      (t) => t.status.trim().toLowerCase() === stageToDelete.name.trim().toLowerCase()
    );

    if (tasksInColumn.length > 0 && !fallbackStageName) {
      alert('Please select a destination column to move existing tasks to.');
      return;
    }

    try {
      setIsDeletingStage(true);
      if (onDeleteProjectStage) {
        await onDeleteProjectStage(
          project.id,
          stageToDelete.id,
          stageToDelete.name,
          fallbackStageName || undefined
        );
      } else {
        await deleteProjectStageApi(
          project.id,
          stageToDelete.id,
          stageToDelete.name,
          fallbackStageName || undefined,
          currentUser
        );
      }
      if (onTasksChange) {
        onTasksChange();
      }
      setStageToDelete(null);
      setFallbackStageName('');
    } catch (err: any) {
      alert(err.message || 'Failed to delete column');
    } finally {
      setIsDeletingStage(false);
    }
  };

  const safeTasks = Array.isArray(tasks) ? tasks : [];
  const safeMembers = Array.isArray(teamMembers) ? teamMembers : [];
  const memberIdsList = Array.isArray(project?.memberIds) ? project.memberIds : [];

  // Sync selectedMemberIds if project.memberIds changes
  React.useEffect(() => {
    setSelectedMemberIds(project?.memberIds || []);
  }, [project?.memberIds]);

  // Tasks in this project
  const projectTasks = useMemo(() => {
    if (!project?.id) return [];
    return safeTasks.filter((t) => t.projectId === project.id);
  }, [safeTasks, project?.id]);

  // Filtered tasks by search, member & scope
  const filteredTasks = useMemo(() => {
    return projectTasks.filter((t) => {
      const matchesMember = filterMemberId === 'all' || t.assigneeId === filterMemberId;
      const matchesScope = filterScope === 'all' || t.taskFor === filterScope;
      const matchesSearch =
        (t.title || '').toLowerCase().includes(searchTaskQuery.toLowerCase()) ||
        (t.description || '').toLowerCase().includes(searchTaskQuery.toLowerCase());
      return matchesMember && matchesScope && matchesSearch;
    });
  }, [projectTasks, filterMemberId, filterScope, searchTaskQuery]);

  // Project assigned members
  const projectTeam = useMemo(() => {
    return safeMembers.filter((m) => memberIdsList.includes(m.id));
  }, [safeMembers, memberIdsList]);

  // Project Lead / Manager
  const projectManager = safeMembers.find((m) => m.id === project?.managerId);

  // Metrics based on stage categories
  const doneStageNames = useMemo(() => {
    const list = effectiveStages.filter((s) => s.category === 'done').map((s) => s.name);
    return list.length > 0 ? list : ['Completed'];
  }, [effectiveStages]);

  const activeStageNames = useMemo(() => {
    const list = effectiveStages.filter((s) => s.category === 'active').map((s) => s.name);
    return list.length > 0 ? list : ['In Progress'];
  }, [effectiveStages]);

  const blockedStageNames = useMemo(() => {
    const list = effectiveStages.filter((s) => s.category === 'blocked').map((s) => s.name);
    return list.length > 0 ? list : ['Blocked'];
  }, [effectiveStages]);

  const totalTasks = projectTasks.length;
  const completedTasks = projectTasks.filter((t) => doneStageNames.includes(t.status)).length;
  const inProgressTasks = projectTasks.filter((t) => activeStageNames.includes(t.status)).length;
  const blockedTasks = projectTasks.filter((t) => blockedStageNames.includes(t.status)).length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const getStatusBadge = (status: StatusType) => getStatusBadgeClass(status, 'sm');
  const getPriorityBadge = (priority: PriorityType) => getPriorityBadgeClass(priority, 'sm');

  const toggleMemberInProject = (memberId: string) => {
    if (selectedMemberIds.includes(memberId)) {
      if (selectedMemberIds.length > 1) {
        setSelectedMemberIds(selectedMemberIds.filter((id) => id !== memberId));
      }
    } else {
      setSelectedMemberIds([...selectedMemberIds, memberId]);
    }
  };

  const handleSaveMembers = () => {
    onUpdateProjectMembers(project.id, selectedMemberIds);
    setIsManagingMembers(false);
  };

  const getInitials = (fullName: string) => {
    if (!fullName) return '?';
    const parts = fullName.trim().split(' ');
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const [copiedProjectLink, setCopiedProjectLink] = useState(false);
  const [copiedTaskId, setCopiedTaskId] = useState<string | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  const handleShareProjectLink = () => {
    setIsShareModalOpen(true);
  };

  const handleShareTaskDirectLink = async (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation();
    if (!project?.id || !taskId) return;
    const url = getTaskShareUrl(project.id, taskId);
    const success = await copyTextToClipboard(url);
    if (success) {
      setCopiedTaskId(taskId);
      setTimeout(() => setCopiedTaskId(null), 2000);
    }
  };

  return (
    <div id="project-detail-workspace" className="space-y-6 pb-20">
      {/* Top Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button
          id="back-to-dashboard-btn"
          onClick={onBackToDashboard}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-lg shadow-2xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors w-fit cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </button>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Admin Project Edit & Delete & Add Task */}
          {isAdmin ? (
            <>
              {onEditProject && (
                <button
                  id="header-edit-project-btn"
                  onClick={() => onEditProject(project)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  Edit
                </button>
              )}
              {onDeleteProject && (
                <button
                  id="header-delete-project-btn"
                  onClick={() => onDeleteProject(project)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-rose-700 dark:text-rose-300 rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                  Delete
                </button>
              )}
             {/*  <button
                id="manage-project-members-btn"
                onClick={() => setIsManagingMembers(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
              >
                <Users className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                Manage Team ({projectTeam.length})
              </button> */}
              <button
                id="header-share-project-btn"
                type="button"
                onClick={handleShareProjectLink}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                title="Share project with team or generate Client Portal link"
              >
                <Share2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Share</span>
              </button>
              <button
                id="header-export-project-btn"
                type="button"
                onClick={() => setIsReportModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                title="Export project to Excel, CSV, or Executive PDF Report"
              >
                <FileText className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Export Report</span>
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <span
                id="staff-view-only-indicator"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-semibold shadow-2xs"
              >
                <Eye className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                Staff Mode &bull; View Project Details
              </span>
              <button
                id="staff-share-project-btn"
                type="button"
                onClick={handleShareProjectLink}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                title="Share project with team or generate Client Portal link"
              >
                <Share2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Share Project</span>
              </button>
              <button
                id="staff-export-project-btn"
                type="button"
                onClick={() => setIsReportModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                title="Export project to Excel, CSV, or Executive PDF Report"
              >
                <FileText className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Export Report</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Project Overview Card */}
      <div className="glass-panel rounded-2xl p-6 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          <div className="space-y-2 max-w-3xl">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: project.color }}
              />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {project.client}
              </span>
              <span className="text-slate-300 dark:text-slate-600">&bull;</span>
              {/* Status Display: Editable by Admin, Read-only badge for Staff */}
              {isAdmin ? (
                <StatusDropdown
                  id="project-detail-status-select"
                  status={project.status}
                  onChange={(newStatus) => onUpdateProjectStatus(project.id, newStatus)}
                  size="sm"
                  stages={effectiveStages}
                />
              ) : (
                <StatusBadge
                  status={project.status}
                  stageColor={effectiveStages.find((s) => s.name === project.status)?.color}
                  size="sm"
                />
              )}
            </div>

            <h1 id="project-detail-name" className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              {project.name}
            </h1>

            <FormattedText
              content={project.description}
              className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed"
            />

            {/* Project Attached Links */}
            {project.links && project.links.length > 0 && (
              <div className="pt-2">
                <LinkAttachmentManager
                  links={project.links}
                  readOnly
                  titleLabel="Project Links"
                />
              </div>
            )}

            {/* Tags & Manager */}
            <div className="flex items-center gap-2 pt-1 flex-wrap text-2xs">
              {projectManager && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-medium border border-blue-200 dark:border-blue-800">
                  <Briefcase className="w-3 h-3" />
                  Lead: {projectManager.name}
                </span>
              )}
              {Array.isArray(project.projectFor) && project.projectFor.map((scope) => (
                <ScopeBadge key={scope} scope={scope} size="xs" />
              ))}
              {project.tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium"
                >
                  {tag}
                </span>
              ))}
            </div>

            {/* Project Audit History Banner */}
            <div id="project-audit-history-strip" className="flex items-center gap-3 pt-3 flex-wrap text-2xs border-t border-slate-100 dark:border-slate-800/80 text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/60 px-2.5 py-1 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
                <span className="text-3xs uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500">
                  Created:
                </span>
                {project.createdByAvatar ? (
                  <img
                    src={project.createdByAvatar}
                    alt={project.createdByName || 'Creator'}
                    className="w-4 h-4 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <span className="w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold text-4xs flex items-center justify-center shrink-0">
                    {(project.createdByName || 'U').charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {project.createdByName || 'System'}
                </span>
                <span className="text-3xs text-slate-400 dark:text-slate-500">
                  • {formatDateTime(project.createdAt)}
                </span>
              </div>

              <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/60 px-2.5 py-1 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
                <span className="text-3xs uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500">
                  Last Updated:
                </span>
                {project.updatedByAvatar ? (
                  <img
                    src={project.updatedByAvatar}
                    alt={project.updatedByName || 'Updater'}
                    className="w-4 h-4 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <span className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-4xs flex items-center justify-center shrink-0">
                    {(project.updatedByName || project.createdByName || 'U').charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {project.updatedByName || project.createdByName || 'System'}
                </span>
                <span className="text-3xs text-slate-400 dark:text-slate-500">
                  • {formatDateTime(project.updatedAt || project.createdAt)}
                </span>
              </div>
            </div>
          </div>

          {/* Right Summary Info */}
          <div className="flex flex-row lg:flex-col items-start lg:items-end justify-between gap-4 border-t lg:border-t-0 pt-4 lg:pt-0 border-slate-100 dark:border-slate-800">
            <div className="text-left lg:text-right">
              <span className="text-2xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Target Deadline
              </span>
              {(() => {
                const projDue = getDueDateStatus(project.targetDeadline);
                if (projDue.isToday) {
                  return (
                    <div className="flex items-center gap-1.5 text-xs font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 px-2 py-1 rounded-lg mt-1 ring-1 ring-rose-400/80 shadow-2xs animate-pulse">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                      <span>Due Today! ({project.targetDeadline})</span>
                    </div>
                  );
                }
                if (projDue.isOverdue) {
                  return (
                    <div className="flex items-center gap-1.5 text-xs font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 px-2 py-0.5 rounded-lg mt-0.5">
                      <Clock className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                      <span>Overdue ({project.targetDeadline})</span>
                    </div>
                  );
                }
                return (
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                    <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span>{project.targetDeadline}</span>
                  </div>
                );
              })()}
            </div>

            {/* Project Team Avatars with Quick Add */}
            <div className="text-left lg:text-right">
              <div className="flex items-center justify-between lg:justify-end gap-2 mb-1">
                <span className="text-2xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Project Team ({projectTeam.length})
                </span>
                {isAdmin && (
                  <button
                    onClick={() => setIsManagingMembers(true)}
                    className="text-2xs text-blue-600 dark:text-blue-400 hover:underline font-medium cursor-pointer"
                  >
                    Edit Roster
                  </button>
                )}
              </div>
              <div className="flex items-center -space-x-1.5">
                {projectTeam.map((mem) => (
                  <div key={mem.id} className="relative group">
                    {mem.avatar ? (
                      <img
                        src={mem.avatar}
                        alt={mem.name}
                        title={`${mem.name} (${mem.role})`}
                        className="w-7 h-7 rounded-full ring-2 ring-white dark:ring-slate-900 object-cover cursor-pointer"
                        onClick={() => setFilterMemberId(filterMemberId === mem.id ? 'all' : mem.id)}
                      />
                    ) : (
                      <div
                        style={{ backgroundColor: mem.color || '#2563eb' }}
                        className="w-7 h-7 rounded-full ring-2 ring-white dark:ring-slate-900 text-white text-3xs font-semibold flex items-center justify-center cursor-pointer shadow-2xs"
                        title={`${mem.name} (${mem.role})`}
                        onClick={() => setFilterMemberId(filterMemberId === mem.id ? 'all' : mem.id)}
                      >
                        {getInitials(mem.name)}
                      </div>
                    )}
                  </div>
                ))}
                {isAdmin && (
                  <button
                    onClick={() => setIsManagingMembers(true)}
                    className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 ring-2 ring-white dark:ring-slate-900 flex items-center justify-center text-xs font-bold transition-colors cursor-pointer"
                    title="Add or remove members from project"
                  >
                    +
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Progress Strip */}
        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-slate-500 dark:text-slate-400 font-medium">
              Progress: {completedTasks} of {totalTasks} deliverables completed
              {blockedTasks > 0 && (
                <span className="text-rose-600 dark:text-rose-400 font-semibold ml-2">
                  &bull; {blockedTasks} blocked
                </span>
              )}
            </span>
            <span className="font-bold text-slate-800 dark:text-slate-200">{completionRate}%</span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                project.status === 'Blocked'
                  ? 'bg-rose-500'
                  : project.status === 'Completed'
                  ? 'bg-emerald-500'
                  : 'bg-blue-600 dark:bg-blue-500'
              }`}
              style={{ width: `${completionRate}%` }}
            />
          </div>
        </div>

        {/* Blocked Alert Banner with Quick Action (Addressing red circle on Blocked) */}
        {project.status === 'Blocked' && (
          <div
            id="project-blocked-alert-banner"
            className="mt-4 p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
          >
            <div className="flex items-center gap-2.5 text-rose-800 dark:text-rose-300">
              <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
              <div>
                <span className="font-bold text-rose-900 dark:text-rose-200">Project is currently Blocked:</span>{' '}
                <span className="text-rose-700 dark:text-rose-300">
                  {blockedTasks > 0
                    ? `${blockedTasks} deliverable task(s) currently marked as Blocked in the Task Board below.`
                    : 'Deliverables are stalled. You can change the project status back to In Progress.'}
                </span>
              </div>
            </div>
            {isAdmin && (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  id="quick-unblock-project-btn"
                  onClick={() => {
                    onUpdateProjectStatus(project.id, 'In Progress');
                    if (blockedTasks > 0) {
                      projectTasks
                        .filter((t) => t.status === 'Blocked')
                        .forEach((t) => onUpdateTaskStatus(t.id, 'In Progress'));
                    }
                  }}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-md font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Unblock Project & Tasks
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tabs & Filters Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center glass-panel p-1 rounded-xl text-xs">
          <button
            id="tab-btn-board"
            onClick={() => setActiveTab('board')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'board'
                ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-2xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Task Board ({projectTasks.length})
          </button>

          <button
            id="tab-btn-documents"
            onClick={() => setActiveTab('documents')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'documents'
                ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-2xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Paperclip className="w-3.5 h-3.5" />
            <span>Documents</span>
            {projectAttachmentCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-3xs font-bold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">
                {projectAttachmentCount}
              </span>
            )}
          </button>

          <button
            id="tab-btn-team"
            onClick={() => setActiveTab('team')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'team'
                ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-2xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Project Team ({projectTeam.length})
          </button>
        </div>

        {/* Member filter & Search within board */}
        {activeTab === 'board' && (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search tasks..."
                value={searchTaskQuery}
                onChange={(e) => setSearchTaskQuery(e.target.value)}
                className="h-8 pl-8 pr-7 py-1 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 rounded-lg shadow-2xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-36 sm:w-48 transition-colors"
              />
              {searchTaskQuery && (
                <button
                  type="button"
                  onClick={() => setSearchTaskQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded cursor-pointer"
                  title="Clear"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <CustomSelect
              id="filter-by-member-select"
              value={filterMemberId}
              onChange={setFilterMemberId}
              icon={<Filter className="w-3.5 h-3.5" />}
              size="sm"
              options={[
                { value: 'all', label: 'All Members', badge: projectTasks.length },
                ...projectTeam.map((m) => ({
                  value: m.id,
                  label: m.name.split(' ')[0],
                  sublabel: m.role,
                  color: m.color || '#2563eb',
                  badge: projectTasks.filter((t) => t.assigneeId === m.id).length,
                })),
              ]}
            />

            {/* Scope Filter (when project has multiple scopes) */}
            {Array.isArray(project.projectFor) && project.projectFor.length > 1 && (
              <CustomSelect
                id="filter-by-scope-select"
                value={filterScope}
                onChange={setFilterScope}
                size="sm"
                options={[
                  { value: 'all', label: 'All Scopes', badge: projectTasks.length },
                  ...project.projectFor.map((scope) => ({
                    value: scope,
                    label: scope,
                    badge: projectTasks.filter((t) => t.taskFor === scope).length,
                    icon: scope.toLowerCase().includes('mobile') ? (
                      <Smartphone className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                    ) : (
                      <Monitor className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                    ),
                  })),
                ]}
              />
            )}

            {isAdmin && (
              <button
                type="button"
                id="add-kanban-column-btn"
                onClick={() => setIsAddStageModalOpen(true)}
                className="h-8 px-2.5 py-1 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer ml-auto sm:ml-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Column</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* VIEW 1: Task Board (Kanban Columns with same status as Project: Draft, In Progress, Ready Review, Blocked, Completed) */}
      {activeTab === 'board' && (
        <>
          {/* Team Workload & Capacity Barometer Strip */}
          <TeamCapacityBarometer
            project={project}
            projectTeam={projectTeam}
            projectTasks={projectTasks}
            allTasks={allTasks || safeTasks}
            selectedMemberId={filterMemberId}
            onSelectMember={(memberId) => setFilterMemberId(memberId)}
            onOpenTaskModal={onOpenTaskModal}
            currentUser={currentUser}
            className="mb-5"
          />

          <div id="kanban-board-container" className="flex gap-3.5 items-start pb-8 overflow-x-auto min-w-full">
          {effectiveStages.map((stage, stageIdx) => {
            const status = stage.name;
            const columnTasks = filteredTasks.filter((t) => t.status.trim().toLowerCase() === status.trim().toLowerCase());
            const isCollapsed = Boolean(collapsedColumns[status]);
            const isDoneCategory = stage.category === 'done';

            if (isCollapsed) {
              return (
                <div
                  key={stage.id || status}
                  id={`kanban-column-${stage.id || status.toLowerCase().replace(/\s+/g, '-')}`}
                  onDragOver={(e) => handleDragOver(e, status)}
                  onDragLeave={(e) => handleDragLeave(e, status)}
                  onDrop={(e) => handleDrop(e, status)}
                  onClick={() => toggleColumnCollapse(status)}
                  title={`Click to expand ${status} list (${columnTasks.length} tasks)`}
                  className={`w-12 shrink-0 min-h-[480px] rounded-xl p-2 flex flex-col items-center justify-between transition-all duration-200 cursor-pointer select-none group ${
                    dragOverColumn === status
                      ? 'border border-blue-400 dark:border-blue-500 bg-blue-50/80 dark:bg-blue-950/60 ring-2 ring-blue-300 shadow-xs'
                      : 'glass-card-subtle hover:border-slate-300 dark:hover:border-slate-700 hover:bg-white/50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  {/* Top Header: Expand Icon on top right & Count Badge */}
                  <div className="flex flex-col items-center gap-2 pt-1 w-full">
                    <button
                      id={`expand-column-${stage.id || status.toLowerCase().replace(/\s+/g, '-')}`}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleColumnCollapse(status);
                      }}
                      title={`Expand ${status} list`}
                      className="w-7 h-7 rounded-lg text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 hover:bg-white dark:hover:bg-slate-800 flex items-center justify-center transition-colors cursor-pointer"
                    >
                      {isDoneCategory ? <ChevronsLeft className="w-4 h-4" /> : <ChevronsRight className="w-4 h-4" />}
                    </button>
                    <span
                      className="text-2xs font-bold px-1.5 py-0.5 rounded-full bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300 min-w-[20px] text-center"
                      title={`${columnTasks.length} tasks`}
                    >
                      {columnTasks.length}
                    </span>
                  </div>

                  {/* Center: Vertical Status Badge */}
                  <div className="flex-1 flex items-center justify-center my-4 py-2">
                    <div className="rotate-180 [writing-mode:vertical-rl] flex items-center justify-center">
                      <StatusBadge status={status} stageColor={stage.color} size="xs" className="tracking-wide whitespace-nowrap" />
                    </div>
                  </div>

                  {/* Bottom: Quick Add Task button */}
                  <div className="pb-1 w-full flex justify-center">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenTaskModal(null, status);
                      }}
                      title={`Add ${status} Task`}
                      className="w-7 h-7 rounded-lg text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-white dark:hover:bg-slate-800 flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={stage.id || status}
                id={`kanban-column-${stage.id || status.toLowerCase().replace(/\s+/g, '-')}`}
                onDragOver={(e) => handleDragOver(e, status)}
                onDragLeave={(e) => handleDragLeave(e, status)}
                onDrop={(e) => handleDrop(e, status)}
                className={`flex-1 min-w-[240px] rounded-xl p-3 flex flex-col gap-3 min-h-[460px] transition-all duration-200 ${
                  dragOverColumn === status
                    ? 'border border-blue-400 dark:border-blue-500 bg-blue-50/60 dark:bg-blue-950/40 ring-2 ring-blue-300/40 shadow-xs'
                    : 'glass-card-subtle'
                }`}
              >
                {/* Column Header */}
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <StatusBadge status={status} stageColor={stage.color} size="sm" />
                    <span className="text-xs text-slate-400 dark:text-slate-500 font-semibold">
                      {columnTasks.length}
                    </span>
                    {isDoneCategory && (
                      <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.2 bg-emerald-100/70 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 rounded text-3xs shrink-0">
                        Admin
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-0.5">
                    <button
                      id={`add-task-to-column-${stage.id || status}`}
                      onClick={() => onOpenTaskModal(null, status)}
                      title={`Add ${status} Task`}
                      className="text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 p-1 rounded-md hover:bg-white dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    <button
                      id={`collapse-column-${stage.id || status.toLowerCase().replace(/\s+/g, '-')}`}
                      onClick={() => toggleColumnCollapse(status)}
                      title={`Collapse ${status} list`}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-md hover:bg-white dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      {isDoneCategory ? <ChevronsRight className="w-4 h-4" /> : <ChevronsLeft className="w-4 h-4" />}
                    </button>

                    {/* Column Settings Menu (Admin Only) */}
                    {isAdmin && (
                      <div className="relative">
                        <button
                          type="button"
                          id={`col-menu-btn-${stage.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuStageId(openMenuStageId === stage.id ? null : stage.id);
                          }}
                          title="Column Settings"
                          className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded-md hover:bg-white dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        {openMenuStageId === stage.id && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 p-1 z-50 animate-in fade-in zoom-in-95 duration-100"
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuStageId(null);
                                setEditingStage(stage);
                                setEditStageName(stage.name);
                                setEditStageColor(stage.color);
                                setEditStageCategory(stage.category);
                              }}
                              className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-left cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                              <span>Edit Column</span>
                            </button>
                            <button
                              type="button"
                              disabled={stageIdx === 0}
                              onClick={() => {
                                setOpenMenuStageId(null);
                                handleMoveStage(stageIdx, 'left');
                              }}
                              className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors text-left ${
                                stageIdx === 0
                                  ? 'text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-50'
                                  : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer'
                              }`}
                            >
                              <MoveLeft className="w-3.5 h-3.5" />
                              <span>Move Left</span>
                            </button>
                            <button
                              type="button"
                              disabled={stageIdx === effectiveStages.length - 1}
                              onClick={() => {
                                setOpenMenuStageId(null);
                                handleMoveStage(stageIdx, 'right');
                              }}
                              className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors text-left ${
                                stageIdx === effectiveStages.length - 1
                                  ? 'text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-50'
                                  : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer'
                              }`}
                            >
                              <MoveRight className="w-3.5 h-3.5" />
                              <span>Move Right</span>
                            </button>
                            {effectiveStages.length > 1 && (
                              <>
                                <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenMenuStageId(null);
                                    setStageToDelete(stage);
                                    const otherStage = effectiveStages.find((s) => s.id !== stage.id);
                                    setFallbackStageName(otherStage?.name || '');
                                  }}
                                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors text-left cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Delete Column</span>
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Task Cards */}
                <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[calc(100vh-280px)] pr-0.5">
                  {columnTasks.map((task) => {
                    const assignee = teamMembers.find((m) => m.id === task.assigneeId);
                    const isOwnTask = Boolean(
                      (task.createdBy && task.createdBy === currentUser?.memberId) ||
                      task.assigneeId === currentUser?.memberId
                    );
                    const isTaskDone =
                      isDoneCategory ||
                      (effectiveStages.find((s) => s.name.trim().toLowerCase() === task.status.trim().toLowerCase())?.category === 'done') ||
                      task.status === 'Completed';
                    const canModifyTask = isAdmin || (isStaff && isOwnTask);
                    const canDragTask = canModifyTask && !(isStaff && isTaskDone);

                    return (
                      <div
                        key={task.id}
                        id={`task-card-${task.id}`}
                        draggable={canDragTask}
                        onDragStart={(e) => handleDragStart(e, task.id)}
                        onDragEnd={handleDragEnd}
                        className={`glass-panel-interactive rounded-xl p-3 shadow-2xs space-y-2.5 select-none ${
                          canDragTask ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
                        } group ${
                          draggedTaskId === task.id ? 'opacity-40 scale-[0.98] ring-2 ring-blue-400' : ''
                        }`}
                      >
                        {/* Priority Badge, Drag Handle & Card Actions */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {canDragTask ? (
                              <GripVertical className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 group-hover:text-slate-500 dark:group-hover:text-slate-400 transition-colors shrink-0" />
                            ) : (
                              <Eye className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" title={isStaff && isTaskDone ? `${task.status} (Admin Only)` : "Staff: View detail mode"} />
                            )}
                            <PriorityBadge priority={task.priority} size="xs" />
                            {task.taskFor && <ScopeBadge scope={task.taskFor} size="xs" />}
                            {Boolean(task.subtasks && task.subtasks.length > 0) && (() => {
                              const total = task.subtasks!.length;
                              const completed = task.subtasks!.filter((s) => s.completed).length;
                              const isDone = completed === total;
                              return (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onOpenTaskModal(task);
                                  }}
                                  title={`Checklist: ${completed} of ${total} completed (${Math.round((completed / total) * 100)}%) • Click to view`}
                                  className={`inline-flex items-center gap-1 text-3xs font-semibold px-1.5 py-0.5 rounded-full border transition-colors cursor-pointer ${
                                    isDone
                                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700/70 hover:bg-emerald-100 dark:hover:bg-emerald-900/60'
                                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600 hover:text-blue-600 dark:hover:text-blue-400'
                                  }`}
                                >
                                  {isDone ? (
                                    <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                  ) : (
                                    <CheckSquare className="w-2.5 h-2.5 text-slate-500 dark:text-slate-400 shrink-0" />
                                  )}
                                  <span>{completed}/{total}</span>
                                </button>
                              );
                            })()}
                            {Boolean(task.commentCount && task.commentCount > 0) && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onOpenTaskModal(task);
                                }}
                                title={`${task.commentCount} ${task.commentCount === 1 ? 'comment' : 'comments'} • Click to view discussion`}
                                className="inline-flex items-center gap-1 text-3xs font-semibold px-1.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/80 dark:border-blue-800/80 hover:bg-blue-100 dark:hover:bg-blue-900/60 cursor-pointer transition-colors"
                              >
                                <MessageSquare className="w-2.5 h-2.5" />
                                <span>{task.commentCount}</span>
                              </button>
                            )}
                            {isStaff && isOwnTask && (
                              <span className="text-3xs font-semibold px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                My Task
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-0.5">
                            <button
                              id={`share-task-btn-${task.id}`}
                              type="button"
                              onClick={(e) => handleShareTaskDirectLink(e, task.id)}
                              title={copiedTaskId === task.id ? 'Direct link copied!' : 'Copy direct link to task'}
                              className={`p-1 rounded-md transition-colors cursor-pointer ${
                                copiedTaskId === task.id
                                  ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-400'
                                  : 'text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                              }`}
                            >
                              {copiedTaskId === task.id ? (
                                <Check className="w-3.5 h-3.5" />
                              ) : (
                                <LinkIcon className="w-3.5 h-3.5" />
                              )}
                            </button>
                            {canModifyTask ? (
                              <>
                                {onDuplicateTask && (
                                  <button
                                    id={`duplicate-task-btn-${task.id}`}
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onDuplicateTask(task);
                                    }}
                                    title="Duplicate Task"
                                    className="text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer transition-colors"
                                  >
                                    <CopyPlus className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button
                                  id={`edit-task-btn-${task.id}`}
                                  onClick={() => onOpenTaskModal(task)}
                                  title="Edit Task"
                                  className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer transition-colors"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  id={`delete-task-btn-${task.id}`}
                                  onClick={() => onDeleteTaskRequest(task)}
                                  title="Delete Task"
                                  className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => onOpenTaskModal(task)}
                                title="View Task Detail"
                                className="text-3xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 px-2 py-0.5 rounded font-medium border border-blue-200/60 dark:border-blue-800/60 cursor-pointer transition-colors inline-flex items-center gap-1"
                              >
                                View Detail
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Title & Description */}
                        <div>
                          <h4
                            onClick={() => onOpenTaskModal(task)}
                            className="text-xs font-bold text-slate-900 dark:text-white leading-snug hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer transition-colors"
                            title={isAdmin ? 'Edit task details' : 'View task details'}
                          >
                            {task.title}
                          </h4>
                          {task.description && (
                            <p className="text-2xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                              {task.description}
                            </p>
                          )}
                        </div>

                        {/* Assignee & Due Date */}
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-2xs text-slate-500 dark:text-slate-400 gap-1.5">
                          {/* Assignee display (avatar & name) */}
                          <div className="relative flex-1 min-w-0">
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenTaskModal(task);
                              }}
                              title={
                                canModifyTask
                                  ? `Assigned to: ${assignee?.name || 'Unassigned'} • Click to edit`
                                  : `Assigned to: ${assignee?.name || 'Unassigned'}`
                              }
                              className="inline-flex items-center gap-1.5 py-0.5 max-w-full text-2xs font-medium cursor-pointer hover:opacity-85 transition-opacity group/assignee"
                            >
                              {assignee?.avatar ? (
                                <img
                                  src={assignee.avatar}
                                  alt={assignee.name}
                                  className="w-5 h-5 rounded-full object-cover shrink-0 ring-1 ring-slate-200/80 dark:ring-slate-700/80"
                                />
                              ) : assignee ? (
                                <span
                                  style={{ backgroundColor: assignee.color || '#2563eb' }}
                                  className="w-5 h-5 rounded-full text-white text-3xs font-bold flex items-center justify-center shrink-0 shadow-2xs"
                                >
                                  {getInitials(assignee.name)}
                                </span>
                              ) : (
                                <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-600 text-slate-400 dark:text-slate-500 text-3xs font-semibold flex items-center justify-center shrink-0">
                                  ?
                                </span>
                              )}
                              <span className="truncate text-slate-700 dark:text-slate-200 group-hover/assignee:text-blue-600 dark:group-hover/assignee:text-blue-400 transition-colors">
                                {assignee?.name || 'Unassigned'}
                              </span>
                            </div>
                          </div>

                          {(() => {
                            const taskDue = getDueDateStatus(task.dueDate);
                            if (taskDue.isToday) {
                              return (
                                <div
                                  title={`Due Today (${task.dueDate})`}
                                  className="flex items-center gap-1 text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 px-1.5 py-0.5 rounded text-2xs font-bold shrink-0 ring-1 ring-rose-400/80 shadow-2xs animate-pulse"
                                >
                                  <AlertCircle className="w-3 h-3 text-rose-600 dark:text-rose-400 shrink-0" />
                                  <span>Today ({task.dueDate.slice(5)})</span>
                                </div>
                              );
                            }
                            if (taskDue.isOverdue) {
                              return (
                                <div
                                  title={`Overdue (${task.dueDate})`}
                                  className="flex items-center gap-1 text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 px-1.5 py-0.5 rounded text-2xs font-semibold shrink-0"
                                >
                                  <Clock className="w-3 h-3 text-rose-500 shrink-0" />
                                  <span>{task.dueDate.slice(5)}</span>
                                </div>
                              );
                            }
                            return (
                              <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 shrink-0">
                                <Clock className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                                <span>{task.dueDate.slice(5)}</span>
                              </div>
                            );
                          })()}
                        </div>

                        {/* Task Audit Info */}
                        <div
                          className="pt-1.5 flex items-center justify-between text-3xs text-slate-400 dark:text-slate-500 gap-2 border-t border-slate-100/80 dark:border-slate-700/50"
                          title={`Created by ${task.createdByName || 'Team'} on ${formatDateTime(task.createdAt)} • Last updated by ${task.updatedByName || task.createdByName || 'Team'} on ${formatDateTime(task.updatedAt || task.createdAt)}`}
                        >
                          <span className="truncate flex items-center gap-1">
                            <span className="text-slate-400 dark:text-slate-500">By</span>
                            <span className="font-medium text-slate-600 dark:text-slate-300 truncate">
                              {task.createdByName || 'Team'}
                            </span>
                          </span>
                          <span className="shrink-0 flex items-center gap-1 text-slate-400 dark:text-slate-500">
                            <Clock className="w-2.5 h-2.5 shrink-0" />
                            {formatDateTime(task.updatedAt || task.createdAt).split(',')[0]}
                          </span>
                        </div>

                        {/* Quick Move status bar: if canModifyTask, allow status change; else View Detail prompt */}
                        {canModifyTask ? (
                          <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-700/60 text-2xs">
                            <span className="text-3xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Move</span>
                            {isStaff && isTaskDone ? (
                              <span className="text-3xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                                <Lock className="w-2.5 h-2.5" /> {task.status} (Admin Only)
                              </span>
                            ) : (
                              <StatusDropdown
                                id={`move-task-status-${task.id}`}
                                status={task.status}
                                onChange={(newStatus) => onUpdateTaskStatus(task.id, newStatus)}
                                size="xs"
                                align="right"
                                stages={effectiveStages}
                                role={currentUser?.role}
                              />
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-700/60 text-2xs">
                            <span className="text-3xs font-medium text-slate-400 dark:text-slate-500 flex items-center gap-1">
                              <Eye className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                              View detail mode
                            </span>
                            <button
                              onClick={() => onOpenTaskModal(task)}
                              className="text-3xs text-blue-600 dark:text-blue-400 hover:underline font-semibold cursor-pointer"
                            >
                              Inspect &rarr;
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {columnTasks.length === 0 && (
                    <div
                      onClick={() => onOpenTaskModal(null, status)}
                      className="p-5 border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-600 rounded-lg text-center text-2xs text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex flex-col items-center justify-center gap-1.5 bg-white/40 dark:bg-slate-800/30 cursor-pointer"
                    >
                      <Plus className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                      <span>{isAdmin ? 'Click to add task' : `Click to add ${status.toLowerCase()} task`}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          </div>
        </>
      )}

      {/* VIEW 2: Project Team & Workload */}
      {activeTab === 'team' && (
        <div id="project-team-workload-view" className="space-y-4">
          <div className="flex items-center justify-between glass-panel p-4 rounded-2xl shadow-2xs">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Team Workload & Assignment Distribution
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                See individual task load and deliverables for this project
              </p>
            </div>
            {isAdmin && (
              <button
                onClick={() => setIsManagingMembers(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
              >
                <Users className="w-3.5 h-3.5" />
                Manage Project Roster
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {projectTeam.map((member) => {
              const memberProjectTasks = projectTasks.filter((t) => t.assigneeId === member.id);
              const activeCount = memberProjectTasks.filter((t) => activeStageNames.includes(t.status)).length;
              const blockedCount = memberProjectTasks.filter((t) => blockedStageNames.includes(t.status)).length;
              const completedCount = memberProjectTasks.filter((t) => doneStageNames.includes(t.status)).length;

              return (
                <div
                  key={member.id}
                  className="glass-panel-interactive rounded-2xl p-4 shadow-2xs space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {member.avatar ? (
                        <img
                          src={member.avatar}
                          alt={member.name}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div
                          style={{ backgroundColor: member.color || '#2563eb' }}
                          className="w-10 h-10 rounded-full text-white font-semibold flex items-center justify-center text-xs"
                        >
                          {getInitials(member.name)}
                        </div>
                      )}
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">{member.name}</h4>
                        <p className="text-2xs text-slate-500 dark:text-slate-400">{member.role}</p>
                        <span className="text-3xs text-slate-400 dark:text-slate-500">{member.email}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => onOpenTaskModal(null, 'In Progress')}
                      className="text-2xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline"
                    >
                      + Assign Task
                    </button>
                  </div>

                  {/* Task Workload Bar */}
                  <div className="grid grid-cols-3 gap-2 text-center text-2xs pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="p-1.5 bg-blue-50/60 dark:bg-blue-950/40 rounded-md border border-blue-100 dark:border-blue-900/50">
                      <span className="font-bold text-blue-700 dark:text-blue-400">{activeCount}</span>
                      <p className="text-3xs text-slate-500 dark:text-slate-400">In Progress</p>
                    </div>
                    <div className="p-1.5 bg-amber-50/60 dark:bg-amber-950/40 rounded-md border border-amber-100 dark:border-amber-900/50">
                      <span className="font-bold text-amber-700 dark:text-amber-400">{blockedCount}</span>
                      <p className="text-3xs text-slate-500 dark:text-slate-400">Blocked</p>
                    </div>
                    <div className="p-1.5 bg-emerald-50/60 dark:bg-emerald-950/40 rounded-md border border-emerald-100 dark:border-emerald-900/50">
                      <span className="font-bold text-emerald-700 dark:text-emerald-400">{completedCount}</span>
                      <p className="text-3xs text-slate-500 dark:text-slate-400">Completed</p>
                    </div>
                  </div>

                  {/* Task List */}
                  <div className="space-y-1 pt-1">
                    <span className="text-2xs font-semibold text-slate-400 dark:text-slate-500 block">
                      Deliverables ({memberProjectTasks.length}):
                    </span>
                    {memberProjectTasks.slice(0, 4).map((t) => {
                      const tDue = getDueDateStatus(t.dueDate);
                      return (
                        <div
                          key={t.id}
                          onClick={() => onOpenTaskModal(t)}
                          className="flex items-center justify-between p-1.5 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer text-2xs border border-slate-100 dark:border-slate-800 gap-1.5"
                        >
                          <span className="truncate max-w-[170px] text-slate-700 dark:text-slate-300 font-medium">
                            {t.title}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            {tDue.isToday && (
                              <span className="text-3xs font-bold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 px-1 py-0.2 rounded-sm flex items-center gap-0.5 ring-1 ring-rose-400/80 dark:ring-rose-800/80 animate-pulse">
                                <AlertCircle className="w-2.5 h-2.5 text-rose-600 dark:text-rose-400" />
                                Today
                              </span>
                            )}
                            {t.taskFor && <ScopeBadge scope={t.taskFor} size="xs" />}
                            <StatusBadge status={t.status} size="xs" />
                          </div>
                        </div>
                      );
                    })}
                    {memberProjectTasks.length === 0 && (
                      <p className="text-2xs text-slate-400 dark:text-slate-500 italic">No tasks currently assigned</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW 3: Project Documents & Files */}
      {activeTab === 'documents' && (
        <div className="glass-panel rounded-2xl p-6 shadow-2xs">
          <DocumentAttachmentManager
            projectId={project.id}
            projectName={project.name}
            currentUser={currentUser}
            onAttachmentCountChange={setProjectAttachmentCount}
            readOnly={!isAdmin && !isAssignedToProject}
          />
        </div>
      )}

      {/* Modal: Manage Project Members Roster */}
      {isManagingMembers && (
        <div
          id="manage-project-members-modal"
          className="fixed inset-0 z-50 flex items-center justify-center glass-modal-backdrop p-4 animate-in fade-in duration-150"
        >
          <div className="w-full max-w-md glass-modal rounded-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="px-5 py-4 glass-modal-header flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Manage Project Members
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{project.name}</p>
                </div>
              </div>
              <button
                onClick={() => setIsManagingMembers(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 max-h-80 overflow-y-auto space-y-2">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Select team members to include on this project:
                </p>
                {onOpenAddMember && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsManagingMembers(false);
                      onOpenAddMember();
                    }}
                    className="text-2xs text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 font-semibold"
                  >
                    <UserPlus className="w-3 h-3" />
                    + New Member
                  </button>
                )}
              </div>

              {teamMembers.map((member) => {
                const isSelected = selectedMemberIds.includes(member.id);
                return (
                  <div
                    key={member.id}
                    onClick={() => toggleMemberInProject(member.id)}
                    className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer text-xs transition-colors ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200 font-medium'
                        : 'bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      {member.avatar ? (
                        <img
                          src={member.avatar}
                          alt={member.name}
                          className="w-8 h-8 rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <div
                          style={{ backgroundColor: member.color || '#2563eb' }}
                          className="w-8 h-8 rounded-full text-white text-xs font-semibold flex items-center justify-center shrink-0"
                        >
                          {getInitials(member.name)}
                        </div>
                      )}
                      <div className="truncate">
                        <p className="font-semibold text-slate-900 dark:text-white truncate">{member.name}</p>
                        <p className="text-2xs text-slate-500 dark:text-slate-400 truncate">{member.role}</p>
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

            <div className="px-5 py-3 glass-modal-footer flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsManagingMembers(false)}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveMembers}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs"
              >
                Save Project Team
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Client & Internal Project Share Modal */}
      {isShareModalOpen && (
        <ShareProjectModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          project={project}
          currentUser={currentUser}
        />
      )}

      {/* Project Export & Executive Report Modal */}
      {isReportModalOpen && (
        <ProjectReportModal
          isOpen={isReportModalOpen}
          onClose={() => setIsReportModalOpen(false)}
          project={project}
          tasks={tasks}
          teamMembers={teamMembers}
        />
      )}

      {/* 1. Add Custom Kanban Column Modal */}
      {isAddStageModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md glass-modal rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Add Kanban Column</h3>
                  <p className="text-2xs text-slate-500 dark:text-slate-400">Create a custom workflow column for this project</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddStageModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleAddStage(); }} className="p-5 space-y-4">
              {/* Column Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Column Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. QA Testing, Design Review, Deployed"
                  value={newStageName}
                  onChange={(e) => setNewStageName(e.target.value)}
                  className="w-full h-9 px-3 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                />
              </div>

              {/* Color Presets */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Badge & Accent Color
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {STAGE_COLOR_PRESETS.map((preset) => (
                    <button
                      key={preset.hex}
                      type="button"
                      onClick={() => setNewStageColor(preset.hex)}
                      style={{ backgroundColor: preset.hex }}
                      title={preset.label}
                      className={`w-6 h-6 rounded-full transition-transform cursor-pointer flex items-center justify-center ${
                        newStageColor === preset.hex ? 'ring-2 ring-offset-2 ring-blue-500 scale-110' : 'hover:scale-105'
                      }`}
                    >
                      {newStageColor === preset.hex && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                    </button>
                  ))}
                  <div className="relative flex items-center">
                    <input
                      type="color"
                      value={newStageColor}
                      onChange={(e) => setNewStageColor(e.target.value)}
                      className="w-6 h-6 rounded-full cursor-pointer border-0 p-0 overflow-hidden"
                      title="Choose custom color"
                    />
                  </div>
                </div>
              </div>

              {/* Workflow Category */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Status Category & Permissions
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(['backlog', 'active', 'blocked', 'done'] as StageCategory[]).map((cat) => {
                    const info = STAGE_CATEGORY_INFO[cat];
                    const isSelected = newStageCategory === cat;
                    return (
                      <div
                        key={cat}
                        onClick={() => setNewStageCategory(cat)}
                        className={`p-2.5 rounded-xl border cursor-pointer transition-all select-none ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/40 ring-1 ring-blue-500'
                            : 'border-slate-200 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800/40'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-2xs font-bold px-1.5 py-0.5 rounded ${info.badgeCls}`}>
                            {info.label}
                          </span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />}
                        </div>
                        <p className="text-3xs text-slate-500 dark:text-slate-400 leading-relaxed">
                          {info.description}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddStageModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newStageName.trim() || isSubmittingStage}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-xs cursor-pointer transition-colors"
                >
                  {isSubmittingStage ? 'Adding...' : 'Add Column'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Edit Column Modal */}
      {editingStage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md glass-modal rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Edit Column: {editingStage.name}</h3>
                  <p className="text-2xs text-slate-500 dark:text-slate-400">Update column name, appearance, or category</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingStage(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleSaveEditStage(); }} className="p-5 space-y-4">
              {/* Column Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Column Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editStageName}
                  onChange={(e) => setEditStageName(e.target.value)}
                  className="w-full h-9 px-3 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                />
              </div>

              {/* Color Presets */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Badge & Accent Color
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {STAGE_COLOR_PRESETS.map((preset) => (
                    <button
                      key={preset.hex}
                      type="button"
                      onClick={() => setEditStageColor(preset.hex)}
                      style={{ backgroundColor: preset.hex }}
                      title={preset.label}
                      className={`w-6 h-6 rounded-full transition-transform cursor-pointer flex items-center justify-center ${
                        editStageColor === preset.hex ? 'ring-2 ring-offset-2 ring-blue-500 scale-110' : 'hover:scale-105'
                      }`}
                    >
                      {editStageColor === preset.hex && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                    </button>
                  ))}
                  <div className="relative flex items-center">
                    <input
                      type="color"
                      value={editStageColor}
                      onChange={(e) => setEditStageColor(e.target.value)}
                      className="w-6 h-6 rounded-full cursor-pointer border-0 p-0 overflow-hidden"
                      title="Choose custom color"
                    />
                  </div>
                </div>
              </div>

              {/* Workflow Category */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Status Category & Permissions
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(['backlog', 'active', 'blocked', 'done'] as StageCategory[]).map((cat) => {
                    const info = STAGE_CATEGORY_INFO[cat];
                    const isSelected = editStageCategory === cat;
                    return (
                      <div
                        key={cat}
                        onClick={() => setEditStageCategory(cat)}
                        className={`p-2.5 rounded-xl border cursor-pointer transition-all select-none ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/40 ring-1 ring-blue-500'
                            : 'border-slate-200 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800/40'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-2xs font-bold px-1.5 py-0.5 rounded ${info.badgeCls}`}>
                            {info.label}
                          </span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />}
                        </div>
                        <p className="text-3xs text-slate-500 dark:text-slate-400 leading-relaxed">
                          {info.description}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingStage(null)}
                  className="px-3.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!editStageName.trim() || isSubmittingStage}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-xs cursor-pointer transition-colors"
                >
                  {isSubmittingStage ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Safe Delete Column Modal */}
      {stageToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md glass-modal rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Delete Column</h3>
                  <p className="text-2xs text-slate-500 dark:text-slate-400">Remove "{stageToDelete.name}" from this project</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStageToDelete(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {(() => {
                const tasksInColumn = safeTasks.filter(
                  (t) => t.status.trim().toLowerCase() === stageToDelete.name.trim().toLowerCase()
                );

                return (
                  <>
                    {tasksInColumn.length > 0 ? (
                      <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs space-y-2">
                        <div className="flex items-center gap-1.5 font-bold">
                          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                          <span>Active tasks detected ({tasksInColumn.length})</span>
                        </div>
                        <p className="text-2xs leading-relaxed">
                          There are <strong>{tasksInColumn.length} task(s)</strong> currently in the "{stageToDelete.name}" column. Before deleting this column, choose a destination column to reassign them to so no work is lost:
                        </p>
                        <div>
                          <label className="block text-2xs font-bold text-amber-900 dark:text-amber-200 mb-1">
                            Move Tasks To:
                          </label>
                          <select
                            value={fallbackStageName}
                            onChange={(e) => setFallbackStageName(e.target.value)}
                            className="w-full h-8 px-2.5 text-xs bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500/20"
                          >
                            <option value="">-- Choose destination column --</option>
                            {effectiveStages
                              .filter((s) => s.id !== stageToDelete.id)
                              .map((s) => (
                                <option key={s.id} value={s.name}>
                                  {s.name} ({s.category})
                                </option>
                              ))}
                          </select>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-600 dark:text-slate-300">
                        Are you sure you want to delete the column <strong>"{stageToDelete.name}"</strong>? This column currently has 0 tasks.
                      </p>
                    )}
                  </>
                );
              })()}

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setStageToDelete(null)}
                  className="px-3.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={
                    isDeletingStage ||
                    (safeTasks.some((t) => t.status.trim().toLowerCase() === stageToDelete.name.trim().toLowerCase()) &&
                      !fallbackStageName)
                  }
                  onClick={handleConfirmDeleteStage}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-xs cursor-pointer transition-colors"
                >
                  {isDeletingStage ? 'Deleting...' : 'Confirm Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
