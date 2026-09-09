import React, { useState, useEffect } from 'react';
import {
  X,
  Check,
  Copy,
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
  Trash2,
  MessageSquare,
  Send,
  History,
  ArrowRight,
  Plus,
  Loader2,
  CheckCircle2,
  ListTodo,
  CheckSquare,
  Filter,
  Link as LinkIcon,
  Share2,
  Paperclip,
} from 'lucide-react';
import { Task, StatusType, PriorityType, TeamMember, Project, AuthUser, TaskTimelineEvent, TaskSubtask } from '../types';
import { getTaskShareUrl, copyTextToClipboard } from '../utils/shareUtils';
import { getDueDateStatus, isDueToday, formatDateTime } from '../utils/dateUtils';
import { FORM_STYLES } from '../utils/formStyles';
import { StatusBadge, PriorityBadge, getStatusBadgeClass, getPriorityBadgeClass } from './Badges';
import { StatusDropdown } from './ui/StatusDropdown';
import { CustomSelect, CustomSelectOption } from './ui/CustomSelect';
import { DatePicker } from './ui/DatePicker';
import { FormattedText } from './ui/FormattedText';
import { RichTextEditor } from './ui/RichTextEditor';
import { DocumentAttachmentManager } from './DocumentAttachmentManager';
import {
  fetchTaskTimelineApi,
  addTaskCommentApi,
  deleteTaskCommentApi,
  fetchTaskSubtasksApi,
  addTaskSubtaskApi,
  updateTaskSubtaskApi,
  deleteTaskSubtaskApi,
} from '../services/api';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (taskData: Partial<Task>, stagedFiles?: File[]) => Promise<void> | void;
  onDelete?: (task: Task) => void;
  initialTask?: Task | null;
  projectId?: string;
  projectName?: string;
  projectMembers?: TeamMember[];
  projects?: Project[];
  teamMembers?: TeamMember[];
  onOpenAddMember?: () => void;
  currentUser?: AuthUser | null;
  onCommentCountChange?: (taskId: string, count: number) => void;
  onSubtasksChange?: (taskId: string, subtasks: TaskSubtask[]) => void;
}

const getStatusBadge = (status: StatusType) => getStatusBadgeClass(status, 'sm');
const getPriorityBadge = (priority: PriorityType) => getPriorityBadgeClass(priority, 'sm');

export const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  initialTask,
  projectId: defaultProjectId,
  projectName,
  projectMembers,
  projects = [],
  teamMembers = [],
  onOpenAddMember,
  currentUser,
  onCommentCountChange,
  onSubtasksChange,
}) => {
  const isAdmin = currentUser?.role === 'admin';
  const isStaff = currentUser?.role === 'staff';

  const canDeleteTask =
    isAdmin ||
    (isStaff &&
      initialTask &&
      ((initialTask.createdBy && initialTask.createdBy === currentUser?.memberId) ||
        initialTask.assigneeId === currentUser?.memberId));

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

  // Subtasks & Deliverable Checklists state
  const [subtasks, setSubtasks] = useState<TaskSubtask[]>(initialTask?.subtasks || []);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [isAddingSubtask, setIsAddingSubtask] = useState(false);

  // Task Timeline & Discussion state
  const [timeline, setTimeline] = useState<TaskTimelineEvent[]>([]);
  const [isLoadingTimeline, setIsLoadingTimeline] = useState(false);
  const [timelineFilter, setTimelineFilter] = useState<'all' | 'comments' | 'activity'>('all');
  const [commentInput, setCommentInput] = useState('');
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  const [activeMobileTab, setActiveMobileTab] = useState<'details' | 'discussion' | 'documents'>('details');
  const [activeRightTab, setActiveRightTab] = useState<'documents' | 'discussion'>('documents');
  const [attachmentCount, setAttachmentCount] = useState<number>(0);
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);

  useEffect(() => {
    if (isOpen && initialTask?.id) {
      let isMounted = true;
      setIsLoadingTimeline(true);
      fetchTaskTimelineApi(initialTask.id)
        .then((res) => {
          if (isMounted) {
            setTimeline(res.timeline);
            if (onCommentCountChange) {
              onCommentCountChange(initialTask.id, res.commentCount);
            }
          }
        })
        .catch((err) => {
          console.error('Failed to load task timeline:', err);
        })
        .finally(() => {
          if (isMounted) {
            setIsLoadingTimeline(false);
          }
        });

      // Refresh subtasks from database
      fetchTaskSubtasksApi(initialTask.id)
        .then((loaded) => {
          if (isMounted) {
            setSubtasks(loaded);
            if (initialTask) {
              initialTask.subtasks = loaded;
            }
            onSubtasksChange?.(initialTask.id, loaded);
          }
        })
        .catch((err) => console.error('Failed to load subtasks:', err));

      return () => {
        isMounted = false;
      };
    } else {
      setTimeline([]);
      setCommentInput('');
      setCommentError(null);
    }
  }, [isOpen, initialTask?.id]);

  const handleToggleSubtask = async (subtaskId: string, currentCompleted: boolean) => {
    const nextCompleted = !currentCompleted;
    const nextSubtasks = subtasks.map((s) =>
      s.id === subtaskId ? { ...s, completed: nextCompleted } : s
    );
    setSubtasks(nextSubtasks);
    if (initialTask?.id) {
      initialTask.subtasks = nextSubtasks;
      onSubtasksChange?.(initialTask.id, nextSubtasks);
      try {
        await updateTaskSubtaskApi(initialTask.id, subtaskId, { completed: nextCompleted }, currentUser);
      } catch (err) {
        console.error('Failed to toggle subtask:', err);
        setSubtasks(subtasks);
      }
    }
  };

  const handleAddSubtask = async () => {
    if (!newSubtaskTitle.trim() || isAddingSubtask) return;
    const text = newSubtaskTitle.trim();
    setNewSubtaskTitle('');

    if (initialTask?.id) {
      setIsAddingSubtask(true);
      try {
        const created = await addTaskSubtaskApi(initialTask.id, text, currentUser);
        const nextSubtasks = [...subtasks, created];
        setSubtasks(nextSubtasks);
        if (initialTask) {
          initialTask.subtasks = nextSubtasks;
        }
        onSubtasksChange?.(initialTask.id, nextSubtasks);
      } catch (err) {
        console.error('Failed to add subtask:', err);
      } finally {
        setIsAddingSubtask(false);
      }
    } else {
      const localSubtask: TaskSubtask = {
        id: `local-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        taskId: '',
        title: text,
        completed: false,
        position: subtasks.length,
      };
      setSubtasks((prev) => [...prev, localSubtask]);
    }
  };

  const handleDeleteSubtask = async (subtaskId: string) => {
    const prevSubtasks = subtasks;
    const nextSubtasks = subtasks.filter((s) => s.id !== subtaskId);
    setSubtasks(nextSubtasks);
    if (initialTask?.id) {
      initialTask.subtasks = nextSubtasks;
      onSubtasksChange?.(initialTask.id, nextSubtasks);
      try {
        await deleteTaskSubtaskApi(initialTask.id, subtaskId, currentUser);
      } catch (err) {
        console.error('Failed to delete subtask:', err);
        setSubtasks(prevSubtasks);
      }
    }
  };

  const totalSubtasks = subtasks.length;
  const completedSubtasks = subtasks.filter((s) => s.completed).length;
  const progressPercent = totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0;
  const isAllChecklistDone = totalSubtasks > 0 && completedSubtasks === totalSubtasks;

  const handlePostComment = async () => {
    if (!initialTask?.id || !commentInput.trim() || isPostingComment) return;
    setIsPostingComment(true);
    setCommentError(null);
    try {
      const res = await addTaskCommentApi(initialTask.id, commentInput.trim(), currentUser);
      setTimeline((prev) => [...prev, res.comment]);
      setCommentInput('');
      if (initialTask) {
        initialTask.commentCount = res.commentCount;
      }
      onCommentCountChange?.(initialTask.id, res.commentCount);
    } catch (err: any) {
      setCommentError(err.message || 'Failed to post comment');
    } finally {
      setIsPostingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!initialTask?.id || deletingCommentId) return;
    setDeletingCommentId(commentId);
    try {
      const res = await deleteTaskCommentApi(initialTask.id, commentId, currentUser);
      setTimeline((prev) => prev.filter((item) => item.id !== commentId));
      if (initialTask) {
        initialTask.commentCount = res.commentCount;
      }
      onCommentCountChange?.(initialTask.id, res.commentCount);
    } catch (err: any) {
      console.error('Failed to delete comment:', err);
    } finally {
      setDeletingCommentId(null);
    }
  };

  const commentsCount = timeline.filter((item) => item.type === 'comment').length;
  const activityCount = timeline.filter((item) => item.type === 'activity').length;

  const filteredTimeline = timeline.filter((item) => {
    if (timelineFilter === 'comments') return item.type === 'comment';
    if (timelineFilter === 'activity') return item.type === 'activity';
    return true;
  });

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

  const [copied, setCopied] = useState(false);

  // Format task details cleanly as text for team communication apps (Slack, Telegram, Teams, WhatsApp, etc.)
  const formatTaskText = () => {
    const taskTitle = title.trim() || initialTask?.title || 'Untitled Deliverable';
    const proj = safeProjects.find(
      (p) => p.id === (selectedProjectId || initialTask?.projectId)
    );
    const projName = proj
      ? `${proj.name}${proj.client ? ` (Client: ${proj.client})` : ''}`
      : projectName || 'Project';

    const taskPriority = priority || initialTask?.priority || 'Medium';
    const taskStatus = status || initialTask?.status || 'In Progress';
    const desc = (description || initialTask?.description || '').trim();

    const lines = [
      `📁 Project: ${projName}`,
      `📋 Task: ${taskTitle}`,
      `📌 Status: ${taskStatus}`,
      `⚡ Priority: ${taskPriority}`,
    ];

    if (desc) {
      lines.push('', `📝 Description:`, desc);
    }

    return lines.join('\n');
  };

  const handleCopyTask = async () => {
    const text = formatTaskText();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn('Failed to copy task:', err);
    }
  };

  const [copiedLink, setCopiedLink] = useState(false);

  const handleShareTaskLink = async () => {
    const currentTaskId = initialTask?.id;
    const currentProjId = initialTask?.projectId || selectedProjectId;
    if (!currentTaskId) return;

    const url = getTaskShareUrl(currentProjId, currentTaskId);
    const success = await copyTextToClipboard(url);
    if (success) {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  useEffect(() => {
    setCopied(false);
    setCopiedLink(false);
    if (initialTask) {
      setSelectedProjectId(initialTask.projectId);
      setTitle(initialTask.title);
      setDescription(initialTask.description);
      setStatus(initialTask.status);
      setPriority(initialTask.priority);
      setAssigneeId(initialTask.assigneeId);
      setStartDate(initialTask.startDate || '');
      setDueDate(initialTask.dueDate);
      setSubtasks(initialTask.subtasks || []);
    } else {
      const activeProjId = defaultProjectId || safeProjects[0]?.id || '';
      setSelectedProjectId(activeProjId);
      setTitle('');
      setDescription('');
      setStatus('In Progress');
      setPriority('Medium');
      setSubtasks([]);
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
    setNewSubtaskTitle('');
    setStagedFiles([]);
    setActiveRightTab('documents');
  }, [initialTask, isOpen, defaultProjectId, projects, teamMembers, currentUser]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditTask) return;
    if (!title.trim() || !dueDate || !selectedProjectId) return;

    onSave(
      {
        projectId: selectedProjectId,
        title: title.trim(),
        description: description.trim(),
        status,
        priority,
        assigneeId: isStaff ? (currentUser?.memberId || assigneeId) : (assigneeId || safeMembers[0]?.id || 'unassigned'),
        startDate: startDate || undefined,
        dueDate,
        subtasks,
      },
      stagedFiles
    );
    onClose();
  };

  const selectedMemberObj = safeMembers.find((m) => m.id === (assigneeId || initialTask?.assigneeId));

  const timelineFilterOptions: CustomSelectOption[] = [
    {
      value: 'all',
      label: 'All',
      badge: timeline.length,
      icon: <Filter className="w-3.5 h-3.5 text-slate-400" />,
      sublabel: 'All comments & status updates',
    },
    {
      value: 'comments',
      label: 'Comments',
      badge: commentsCount,
      icon: <MessageSquare className="w-3.5 h-3.5 text-blue-500" />,
      sublabel: 'Team feedback & notes',
    },
    {
      value: 'activity',
      label: 'Updates',
      badge: activityCount,
      icon: <History className="w-3.5 h-3.5 text-indigo-500" />,
      sublabel: 'Status changes & history',
    },
  ];

  const renderDiscussionPanel = () => (
    <div
      id="task-discussion-right-panel"
      className={`w-full lg:w-[420px] xl:w-[480px] border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 flex flex-col min-h-0 overflow-hidden shrink-0 ${
        activeMobileTab === 'details' ? 'hidden lg:flex' : 'flex'
      }`}
    >
      {/* Right Panel Header: Tabs between Documents and Discussion (Documents First!) */}
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
            {(initialTask ? attachmentCount : stagedFiles.length) > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-3xs font-bold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">
                {initialTask ? attachmentCount : stagedFiles.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveRightTab('discussion');
              setActiveMobileTab('discussion');
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              activeRightTab === 'discussion'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Discussion</span>
            {commentsCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-3xs font-bold bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                {commentsCount}
              </span>
            )}
          </button>
        </div>

        {activeRightTab === 'discussion' && initialTask && (
          <div className="shrink-0">
            <CustomSelect
              id="timeline-filter-select"
              value={timelineFilter}
              onChange={(val) => setTimelineFilter(val as 'all' | 'comments' | 'activity')}
              options={timelineFilterOptions}
              size="sm"
              align="right"
              className="w-32 sm:w-36"
            />
          </div>
        )}
      </div>

      {activeRightTab === 'documents' ? (
        <div className="flex-1 overflow-y-auto p-4 min-h-0 custom-scrollbar bg-white dark:bg-slate-900/60">
          <DocumentAttachmentManager
            taskId={initialTask?.id}
            projectId={initialTask?.projectId || selectedProjectId || defaultProjectId}
            projectName={currentProject?.name || projectName}
            taskTitle={initialTask?.title || title}
            currentUser={currentUser}
            onAttachmentCountChange={setAttachmentCount}
            readOnly={isStaff && !isOwnTask}
            isCreateMode={!initialTask}
            stagedFiles={stagedFiles}
            onStagedFilesChange={setStagedFiles}
          />
        </div>
      ) : !initialTask ? (
        <div className="flex-1 p-8 flex flex-col items-center justify-center text-center">
          <div className="w-11 h-11 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3">
            <MessageSquare className="w-5 h-5" />
          </div>
          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
            Discussion & Activity Timeline
          </h4>
          <p className="text-3xs text-slate-500 dark:text-slate-400 max-w-xs mt-1 leading-relaxed">
            Team comments and status tracking will activate once this task deliverable is saved. Switch to the <strong className="text-blue-600 dark:text-blue-400">Documents</strong> tab to attach files right now!
          </p>
        </div>
      ) : (
        <>
      {/* Add Comment Input Form (Situated right at TOP under the header!) */}
      <div className="p-3 bg-white dark:bg-slate-900/90 border-b border-slate-200/80 dark:border-slate-800 space-y-2 shrink-0">
        <div className="flex items-start gap-2.5">
          {currentUser?.avatar ? (
            <img
              src={currentUser.avatar}
              alt={currentUser.name}
              className="w-7 h-7 rounded-full object-cover shrink-0 ring-2 ring-white dark:ring-slate-900 shadow-2xs"
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold text-3xs flex items-center justify-center shrink-0 ring-2 ring-white dark:ring-slate-900 shadow-2xs">
              {(currentUser?.name || 'U').charAt(0).toUpperCase()}
            </div>
          )}

          <div className="flex-1">
            <textarea
              id="task-comment-input"
              rows={2}
              value={commentInput}
              onChange={(e) => setCommentInput(e.target.value)}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                  e.preventDefault();
                  handlePostComment();
                }
              }}
              placeholder="Write a comment or feedback... (Press Ctrl+Enter to post)"
              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 resize-none transition-all"
              disabled={isPostingComment}
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-0.5">
          <span className="text-3xs text-slate-400 dark:text-slate-500">
            Press <kbd className="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-700 font-mono text-3xs">Ctrl</kbd> + <kbd className="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-700 font-mono text-3xs">Enter</kbd> to post
          </span>

          <button
            id="post-task-comment-btn"
            type="button"
            onClick={handlePostComment}
            disabled={!commentInput.trim() || isPostingComment}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-2xs transition-colors cursor-pointer"
          >
            {isPostingComment ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Posting...</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>Post Comment</span>
              </>
            )}
          </button>
        </div>

        {commentError && (
          <p className="text-2xs text-rose-600 dark:text-rose-400 font-medium">
            {commentError}
          </p>
        )}
      </div>

      {/* Feed List (Scrollable below the comment form) */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
        {isLoadingTimeline ? (
          <div className="py-8 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 text-xs gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
            <span>Loading discussion & activity timeline...</span>
          </div>
        ) : filteredTimeline.length === 0 ? (
          <div className="py-7 text-center rounded-xl bg-slate-50/60 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-800 p-4">
            <MessageSquare className="w-6 h-6 text-slate-300 dark:text-slate-600 mx-auto mb-1.5" />
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {timelineFilter === 'comments'
                ? 'No comments on this task yet.'
                : timelineFilter === 'activity'
                ? 'No status updates logged yet.'
                : 'No discussion or updates yet.'}
            </p>
            <p className="text-3xs text-slate-400 dark:text-slate-500 mt-0.5">
              Post a comment above to share feedback or instructions with your team.
            </p>
          </div>
        ) : (
          <div className="relative space-y-3 py-1 px-1">
            {filteredTimeline.map((item, index) => {
              if (item.type === 'comment') {
                const canDelete =
                  currentUser?.role === 'admin' ||
                  (currentUser?.memberId && item.userId === currentUser.memberId);
                return (
                  <div key={item.id} className="relative flex items-start gap-3 group">
                    {/* Vertical connector line */}
                    {index < filteredTimeline.length - 1 && (
                      <span
                        aria-hidden="true"
                        className="absolute left-[13px] top-[26px] bottom-[-14px] w-[2px] bg-slate-200 dark:bg-slate-700/70 pointer-events-none"
                      />
                    )}

                    {/* Avatar */}
                    <div className="relative z-10 shrink-0">
                      {item.userAvatar ? (
                        <img
                          src={item.userAvatar}
                          alt={item.userName}
                          className="w-7 h-7 rounded-full object-cover ring-2 ring-white dark:ring-slate-900 shadow-2xs"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-bold text-3xs flex items-center justify-center ring-2 ring-white dark:ring-slate-900 shadow-2xs">
                          {(item.userName || 'U').charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>

                    {/* Comment Bubble */}
                    <div className="flex-1 bg-white dark:bg-slate-800/90 border border-slate-200/90 dark:border-slate-700/80 rounded-xl p-3 shadow-2xs text-xs">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-semibold text-slate-800 dark:text-slate-200 text-2xs truncate">
                            {item.userName}
                          </span>
                          {item.userRole && (
                            <span className="px-1.5 py-0.5 rounded text-3xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 shrink-0">
                              {item.userRole}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-3xs text-slate-400 dark:text-slate-500 font-medium tabular-nums">
                            {formatDateTime(item.createdAt)}
                          </span>
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => handleDeleteComment(item.id)}
                              disabled={deletingCommentId === item.id}
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                              title="Delete comment"
                            >
                              {deletingCommentId === item.id ? (
                                <Loader2 className="w-3 h-3 animate-spin text-rose-500" />
                              ) : (
                                <Trash2 className="w-3 h-3" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="text-slate-700 dark:text-slate-200 text-xs leading-relaxed break-words">
                        <FormattedText content={item.content} />
                      </div>
                    </div>
                  </div>
                );
              }

              // Otherwise: Activity Event (Status changes, Task creations, etc.)
              const isStatusChange = item.actionType === 'update_task_status';
              const fromStatus = (item.details?.fromStatus as StatusType) || null;
              const toStatus = (item.details?.toStatus || item.details?.newStatus) as StatusType;

              return (
                <div key={item.id} className="relative flex items-start gap-3">
                  {/* Vertical connector line */}
                  {index < filteredTimeline.length - 1 && (
                    <span
                      aria-hidden="true"
                      className="absolute left-[13px] top-[26px] bottom-[-14px] w-[2px] bg-slate-200 dark:bg-slate-700/70 pointer-events-none"
                    />
                  )}

                  {/* Node icon */}
                  <div
                    className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center shrink-0 ring-2 ring-white dark:ring-slate-900 shadow-2xs border ${
                      isStatusChange
                        ? 'bg-blue-50 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800/80'
                        : item.actionType === 'create_task'
                        ? 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/80'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {isStatusChange ? (
                      <Clock className="w-3.5 h-3.5" />
                    ) : item.actionType === 'create_task' ? (
                      <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                    ) : (
                      <History className="w-3.5 h-3.5" />
                    )}
                  </div>

                  {/* Node content */}
                  <div className="flex-1 text-2xs text-slate-600 dark:text-slate-300 bg-slate-50/85 dark:bg-slate-800/50 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 transition-colors px-3 py-2 rounded-lg border border-slate-200/75 dark:border-slate-700/60 shadow-2xs space-y-1">
                    {/* Top Row: User Name aligned with Timestamp */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {item.userName}
                      </span>
                      <span className="text-3xs text-slate-400 dark:text-slate-500 shrink-0 font-medium tabular-nums">
                        {formatDateTime(item.createdAt)}
                      </span>
                    </div>

                    {/* Bottom Row: Action Details & Status Badges */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {isStatusChange && toStatus ? (
                        <div className="inline-flex items-center gap-1.5 flex-wrap">
                          <span className="text-slate-500 dark:text-slate-400">changed status</span>
                          {fromStatus && (
                            <>
                              <StatusBadge status={fromStatus} size="xs" />
                              <ArrowRight className="w-2.5 h-2.5 text-slate-400 dark:text-slate-500 shrink-0" />
                            </>
                          )}
                          <StatusBadge status={toStatus} size="xs" />
                        </div>
                      ) : item.actionType === 'create_task' ? (
                        <span className="text-slate-500 dark:text-slate-400">created this deliverable</span>
                      ) : (
                        <span className="text-slate-500 dark:text-slate-400">updated deliverable details</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      </>
    )}
  </div>
);

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
          className="w-full max-w-5xl bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]"
        >
          {/* Read-Only Header */}
          <div className="px-6 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 flex items-center justify-center shrink-0">
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
                  {attachmentCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-3xs bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-bold">
                      {attachmentCount}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveMobileTab('discussion');
                    setActiveRightTab('discussion');
                  }}
                  className={`px-2.5 py-1 rounded-md font-medium cursor-pointer transition-colors inline-flex items-center gap-1.5 ${
                    activeMobileTab === 'discussion'
                      ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-2xs font-semibold'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Discussion</span>
                  {commentsCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-3xs bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold">
                      {commentsCount}
                    </span>
                  )}
                </button>
              </div>

              {initialTask && (
                <button
                  id="share-readonly-task-link-btn"
                  type="button"
                  onClick={handleShareTaskLink}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                    copiedLink
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700/60 text-emerald-700 dark:text-emerald-300'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 shadow-2xs'
                  }`}
                  title="Copy direct shareable link to this task"
                >
                  {copiedLink ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Link Copied!</span>
                    </>
                  ) : (
                    <>
                      <LinkIcon className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      <span>Share Link</span>
                    </>
                  )}
                </button>
              )}

              <button
                id="copy-readonly-task-btn"
                type="button"
                onClick={handleCopyTask}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                  copied
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700/60 text-emerald-700 dark:text-emerald-300'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 shadow-2xs'
                }`}
                title="Copy task details to clipboard for team chat"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                    <span>Copy Task</span>
                  </>
                )}
              </button>
              <button
                id="close-task-modal-btn"
                onClick={onClose}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Read-Only Split Main Content */}
          <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
            {/* Left Column: Read-Only Details */}
            <div className={`flex-1 flex flex-col min-h-0 overflow-hidden ${
              activeMobileTab !== 'details' ? 'hidden lg:flex' : 'flex'
            }`}>
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
                <FormattedText
                  content={initialTask.description}
                  placeholder="No description provided for this task deliverable."
                />
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

            {/* Subtasks & Deliverable Checklists */}
            {totalSubtasks > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ListTodo className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                    <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Checklist
                    </h4>
                    <span className={`px-2 py-0.5 rounded-full text-3xs font-semibold ${
                      isAllChecklistDone
                        ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                    }`}>
                      {completedSubtasks}/{totalSubtasks}
                    </span>
                  </div>
                  <span className={`text-2xs font-bold ${
                    isAllChecklistDone ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'
                  }`}>
                    {progressPercent}%
                  </span>
                </div>

                {/* Sleek Progress Bar */}
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 rounded-full ${
                      isAllChecklistDone ? 'bg-emerald-500' : 'bg-gradient-to-r from-blue-500 to-indigo-500'
                    }`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                {/* Checklist Items */}
                <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800/80 bg-slate-50/40 dark:bg-slate-900/40 overflow-hidden shadow-2xs">
                  {subtasks.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-2.5 px-3 py-2 hover:bg-white dark:hover:bg-slate-800/60 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={item.completed}
                        onChange={() => handleToggleSubtask(item.id, item.completed)}
                        className="w-4 h-4 text-blue-600 rounded border-slate-300 dark:border-slate-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <span className={`text-xs truncate ${
                        item.completed
                          ? 'line-through text-slate-400 dark:text-slate-500'
                          : 'text-slate-700 dark:text-slate-200'
                      }`}>
                        {item.title}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyTask}
                className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold transition-all cursor-pointer border rounded-lg shadow-2xs ${
                  copied
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700/60 text-emerald-700 dark:text-emerald-300'
                    : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
                title="Copy task details to clipboard"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                    <span>Copy Task</span>
                  </>
                )}
              </button>
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

        {/* Right Column: Discussion & Activity Timeline */}
        {renderDiscussionPanel()}
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
        className="w-full max-w-5xl bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="px-6 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/60 shrink-0">
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
                {(initialTask ? attachmentCount : stagedFiles.length) > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-3xs bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-bold">
                    {initialTask ? attachmentCount : stagedFiles.length}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveMobileTab('discussion');
                  setActiveRightTab('discussion');
                }}
                className={`px-2.5 py-1 rounded-md font-medium cursor-pointer transition-colors inline-flex items-center gap-1.5 ${
                  activeMobileTab === 'discussion'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-2xs font-semibold'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Discussion</span>
                {commentsCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-3xs bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold">
                    {commentsCount}
                  </span>
                )}
              </button>
            </div>
            {initialTask && (
              <button
                id="share-task-link-btn"
                type="button"
                onClick={handleShareTaskLink}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                  copiedLink
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700/60 text-emerald-700 dark:text-emerald-300'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 shadow-2xs'
                }`}
                title="Copy direct shareable link to this task"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Link Copied!</span>
                  </>
                ) : (
                  <>
                    <LinkIcon className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span>Share Link</span>
                  </>
                )}
              </button>
            )}

            <button
              id="close-task-modal-btn"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Main Split Content */}
        <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
          {/* Left Column: Task Form */}
          <div className={`flex-1 flex flex-col min-h-0 overflow-hidden ${
            activeMobileTab !== 'details' ? 'hidden lg:flex' : 'flex'
          }`}>
            <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {/* Project Selector */}
          {safeProjects.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Project <span className="text-rose-500">*</span>
              </label>
              <CustomSelect
                id="task-project-select"
                value={selectedProjectId}
                onChange={setSelectedProjectId}
                fullWidth
                size="md"
                options={safeProjects.map((p) => ({
                  value: p.id,
                  label: p.name,
                  sublabel: p.client ? `Client: ${p.client}` : undefined,
                  color: p.color || '#2563eb',
                }))}
              />
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
            <RichTextEditor
              id="task-description-input"
              value={description}
              onChange={setDescription}
              placeholder="Deliverables, scope, notes..."
            />
          </div>

          {/* Status & Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Status
              </label>
              <StatusDropdown
                id="task-status-select"
                status={status}
                onChange={setStatus}
                size="md"
                fullWidth
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Priority
              </label>
              <CustomSelect
                id="task-priority-select"
                value={priority}
                onChange={(v) => setPriority(v as PriorityType)}
                fullWidth
                size="md"
                options={[
                  { value: 'Urgent', label: 'Urgent', color: '#f43f5e' },
                  { value: 'High', label: 'High', color: '#f97316' },
                  { value: 'Medium', label: 'Medium', color: '#f59e0b' },
                  { value: 'Low', label: 'Low', color: '#64748b' },
                ]}
              />
            </div>
          </div>

          {/* Assignee Selection */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Assigned Team Member <span className="text-rose-500">*</span>
              </label>
              {!isStaff && (
                <div className="flex items-center gap-2">
                  <span className="text-2xs text-slate-400">
                    {selectedMemberObj ? selectedMemberObj.name : 'Select an assignee'}
                  </span>
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
              )}
            </div>

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
              <div
                id="task-assignee-grid"
                className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50/50 dark:bg-slate-800/50"
              >
                {sortedMembers.map((member) => {
                  const isSelected = (assigneeId || selectedMemberObj?.id) === member.id;
                  const isInProject = currentProject?.memberIds?.includes(member.id);

                  return (
                    <div
                      key={member.id}
                      id={`task-assignee-card-${member.id}`}
                      onClick={() => setAssigneeId(member.id)}
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
                          <div className="flex items-center gap-1.5 truncate">
                            <p className="truncate font-medium">{member.name}</p>
                            {isInProject && (
                              <span
                                className="text-4xs font-semibold px-1 py-0.2 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 shrink-0"
                                title="Member of this project"
                              >
                                Project
                              </span>
                            )}
                          </div>
                          <p className="text-2xs text-slate-500 dark:text-slate-400 truncate">{member.role}</p>
                        </div>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 ml-1" />}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Timeline Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Start Date
              </label>
              <DatePicker
                id="task-start-date-input"
                value={startDate}
                onChange={setStartDate}
                placeholder="Select start date"
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
              <DatePicker
                id="task-due-date-input"
                required
                value={dueDate}
                onChange={setDueDate}
                placeholder="Select due date"
                isDueToday={Boolean(dueDate && isDueToday(dueDate))}
              />
            </div>
          </div>

          {/* Subtasks & Deliverable Checklists */}
          <div id="task-subtasks-checklist-section" className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ListTodo className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Checklist
                </h4>
                {totalSubtasks > 0 && (
                  <span className={`px-2 py-0.5 rounded-full text-3xs font-semibold ${
                    isAllChecklistDone
                      ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                  }`}>
                    {completedSubtasks}/{totalSubtasks}
                  </span>
                )}
              </div>

              {totalSubtasks > 0 && (
                <span className={`text-2xs font-bold ${
                  isAllChecklistDone ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'
                }`}>
                  {progressPercent}%
                </span>
              )}
            </div>

            {/* Sleek Progress Bar */}
            {totalSubtasks > 0 && (
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 rounded-full ${
                    isAllChecklistDone ? 'bg-emerald-500' : 'bg-gradient-to-r from-blue-500 to-indigo-500'
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            )}

            {/* Unified Checklist Card Container */}
            <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800/80 bg-slate-50/40 dark:bg-slate-900/40 overflow-hidden shadow-2xs">
              {subtasks.map((item) => (
                <div
                  key={item.id}
                  className="group flex items-center justify-between gap-2.5 px-3 py-2 hover:bg-white dark:hover:bg-slate-800/60 transition-colors"
                >
                  <label className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={item.completed}
                      onChange={() => handleToggleSubtask(item.id, item.completed)}
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 dark:border-slate-600 focus:ring-blue-500 cursor-pointer transition-colors"
                    />
                    <span className={`text-xs transition-all truncate ${
                      item.completed
                        ? 'line-through text-slate-400 dark:text-slate-500'
                        : 'text-slate-700 dark:text-slate-200 font-medium'
                    }`}>
                      {item.title}
                    </span>
                  </label>

                  <button
                    type="button"
                    onClick={() => handleDeleteSubtask(item.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    title="Delete checkpoint"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              {/* Inline Add Checkpoint Input Row */}
              <div className="flex items-center gap-2.5 px-3 py-2 bg-white dark:bg-slate-900/80 focus-within:bg-blue-50/20 dark:focus-within:bg-blue-950/20 transition-colors">
                <Plus className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
                <input
                  id="new-subtask-input"
                  type="text"
                  value={newSubtaskTitle}
                  onChange={(e) => setNewSubtaskTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddSubtask();
                    }
                  }}
                  placeholder="Add a checklist item... (press Enter)"
                  className="flex-1 text-xs bg-transparent border-none text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none"
                  disabled={isAddingSubtask}
                />
                {newSubtaskTitle.trim() && (
                  <button
                    id="add-subtask-btn"
                    type="button"
                    onClick={handleAddSubtask}
                    disabled={isAddingSubtask}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-2xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-2xs transition-colors cursor-pointer shrink-0"
                  >
                    Add
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

              {/* Pinned Left Footer */}
              <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2">
                  {initialTask && onDelete && canDeleteTask && (
                    <button
                      id="delete-task-modal-btn"
                      type="button"
                      onClick={() => {
                        onClose();
                        onDelete(initialTask);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800/80 rounded-lg transition-colors cursor-pointer"
                      title="Move task to Recycle Bin (kept for 7 days)"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Task</span>
                    </button>
                  )}
                  <button
                    id="copy-task-footer-btn"
                    type="button"
                    onClick={handleCopyTask}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-all cursor-pointer border rounded-lg ${
                      copied
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700/60 text-emerald-700 dark:text-emerald-300'
                        : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                    title="Copy task formatted as text for communication apps"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                        <span>Copy Task as Text</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="flex items-center gap-3">
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
              </div>
            </form>
          </div>

          {/* Right Column: Documents & Discussion Timeline (Documents First!) */}
          {renderDiscussionPanel()}
        </div>
      </div>
    </div>
  );
};
