import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Clock,
  AlertOctagon,
  Copy,
  Check,
  FileSpreadsheet,
  ArrowRight,
  Sparkles,
  Send,
  Table as TableIcon,
  LayoutGrid,
  Search,
  X,
  Printer,
  History,
  CheckSquare,
  FolderKanban,
  RotateCcw,
  User,
  ArrowUpDown,
  Filter,
} from 'lucide-react';
import { Project, Task, TeamMember, StatusType } from '../types';
import { StatusBadge, PriorityBadge, getStatusBadgeClass, getPriorityBadgeClass } from './Badges';
import { ModernDateRangePicker } from './ui/ModernDateRangePicker';

const TelegramSettingsModal = React.lazy(() =>
  import('./TelegramSettingsModal').then((m) => ({ default: m.TelegramSettingsModal }))
);

export interface EnrichedWeeklyTask extends Task {
  assigneeName: string;
  assigneeAvatar?: string;
  assigneeColor?: string;
  projectName: string;
  projectColor: string;
  completionDateStr: string | null;
  isThisWeek: boolean;
  isLastWeek: boolean;
}

interface ProjectWeeklyReportProps {
  projects: Project[];
  tasks: Task[];
  teamMembers: TeamMember[];
  onSelectProject: (projectId: string) => void;
  onOpenTaskModal?: (task: Task) => void;
  onShowToast?: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const ProjectWeeklyReport: React.FC<ProjectWeeklyReportProps> = ({
  projects,
  tasks,
  teamMembers,
  onSelectProject,
  onOpenTaskModal,
  onShowToast,
}) => {
  const [copied, setCopied] = useState<boolean>(false);
  const [isTelegramModalOpen, setIsTelegramModalOpen] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');
  const [expandedProjectIds, setExpandedProjectIds] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('All');

  // Main View: 'tasks' = Completed Task Listing, 'projects' = Projects Overview (persists on reload)
  const [mainView, setMainView] = useState<'tasks' | 'projects'>(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const tab = urlParams.get('tab');
      if (tab === 'projects' || tab === 'tasks') return tab;
      const saved = localStorage.getItem('weekly_summary_tab');
      if (saved === 'projects' || saved === 'tasks') return saved;
    } catch {}
    return 'tasks';
  });

  const handleSwitchMainView = (view: 'tasks' | 'projects') => {
    setMainView(view);
    try {
      localStorage.setItem('weekly_summary_tab', view);
      const url = new URL(window.location.href);
      url.searchParams.set('tab', view);
      window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    } catch {}
  };

  // Date Range Presets and Custom Dates for Task Listing
  type DateRangePreset = 'this-week' | 'last-week' | 'this-month' | 'last-month' | 'all' | 'custom';
  const [datePreset, setDatePreset] = useState<DateRangePreset>(() => {
    try {
      const saved = localStorage.getItem('weekly_summary_date_preset') as DateRangePreset | null;
      if (
        saved &&
        ['this-week', 'last-week', 'this-month', 'last-month', 'all', 'custom'].includes(saved)
      ) {
        return saved;
      }
    } catch {}
    return 'this-week';
  });
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Task Listing specific filters & sorting
  const [taskSearchQuery, setTaskSearchQuery] = useState<string>('');
  const [taskProjectFilter, setTaskProjectFilter] = useState<string>('all');
  const [taskAssigneeFilter, setTaskAssigneeFilter] = useState<string>('all');
  const [taskSortBy, setTaskSortBy] = useState<
    'project' | 'project-desc' | 'date-desc' | 'date-asc' | 'priority' | 'title' | 'assignee'
  >(() => {
    try {
      const saved = localStorage.getItem('weekly_summary_task_sort_by');
      if (saved) return saved as any;
    } catch {}
    return 'project'; // Default: Sort tasks by project
  });

  const handleSortChange = (
    newSort: 'project' | 'project-desc' | 'date-desc' | 'date-asc' | 'priority' | 'title' | 'assignee'
  ) => {
    setTaskSortBy(newSort);
    try {
      localStorage.setItem('weekly_summary_task_sort_by', newSort);
    } catch {}
  };
  const [taskViewMode, setTaskViewMode] = useState<'table' | 'card'>('table');

  // Helper: Format date to local YYYY-MM-DD
  const toLocalDateStr = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const date = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${date}`;
  };

  // Helper: Calculate week bounds (Monday to Friday for working days, Sunday for full week)
  const getWeekBounds = (offset: number) => {
    const now = new Date();
    const day = now.getDay();
    const isoDay = day === 0 ? 7 : day; // Treat Sunday as day 7

    // Monday of selected week
    const monday = new Date(now);
    monday.setDate(now.getDate() - (isoDay - 1) + offset * 7);
    monday.setHours(0, 0, 0, 0);

    // Friday of selected week (working week end)
    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);
    friday.setHours(23, 59, 59, 999);

    // Sunday of selected week (calendar week end)
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const formatShort = (d: Date) =>
      d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    return {
      monday,
      friday,
      sunday,
      label: `${formatShort(monday)} – ${formatShort(friday)}`,
      fullLabel: `${formatShort(monday)} – ${formatShort(sunday)}`,
      mondayStr: toLocalDateStr(monday),
      fridayStr: toLocalDateStr(friday),
      sundayStr: toLocalDateStr(sunday),
      isLastWeek: offset === -1,
      isThisWeek: offset === 0,
    };
  };

  // Helper: Month bounds
  const getMonthBounds = (offset: number = 0) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + offset;
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
    return {
      start,
      end,
      startStr: toLocalDateStr(start),
      endStr: toLocalDateStr(end),
      label: start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    };
  };

  // Dedicated bounds for This Week (offset 0) and Last Week (offset -1)
  const thisWeekBounds = useMemo(() => getWeekBounds(0), []);
  const lastWeekBounds = useMemo(() => getWeekBounds(-1), []);

  // Initialize default start/end date to This Week if not set
  React.useEffect(() => {
    if (!startDate && !endDate && datePreset === 'this-week') {
      setStartDate(thisWeekBounds.mondayStr);
      setEndDate(thisWeekBounds.sundayStr);
    }
  }, [thisWeekBounds, startDate, endDate, datePreset]);

  // Apply a Date Range preset
  const applyPreset = (preset: DateRangePreset) => {
    setDatePreset(preset);
    try {
      localStorage.setItem('weekly_summary_date_preset', preset);
    } catch {}
    if (preset === 'this-week') {
      setStartDate(thisWeekBounds.mondayStr);
      setEndDate(thisWeekBounds.sundayStr);
    } else if (preset === 'last-week') {
      setStartDate(lastWeekBounds.mondayStr);
      setEndDate(lastWeekBounds.sundayStr);
    } else if (preset === 'this-month') {
      const mb = getMonthBounds(0);
      setStartDate(mb.startStr);
      setEndDate(mb.endStr);
    } else if (preset === 'last-month') {
      const mb = getMonthBounds(-1);
      setStartDate(mb.startStr);
      setEndDate(mb.endStr);
    } else if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    }
  };

  const handleStartDateChange = (val: string) => {
    setStartDate(val);
    setDatePreset('custom');
  };

  const handleEndDateChange = (val: string) => {
    setEndDate(val);
    setDatePreset('custom');
  };


  // Human-readable date range label
  const formattedDateRangeText = useMemo(() => {
    if (!startDate && !endDate) return 'All Time (All Completed Tasks)';
    if (startDate && endDate) {
      try {
        const [sY, sM, sD] = startDate.split('-').map(Number);
        const [eY, eM, eD] = endDate.split('-').map(Number);
        const s = new Date(sY, sM - 1, sD);
        const e = new Date(eY, eM - 1, eD);
        const sFormatted = s.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const eFormatted = e.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        return `${sFormatted} – ${eFormatted}`;
      } catch {
        return `${startDate} to ${endDate}`;
      }
    }
    if (startDate) return `From ${startDate}`;
    return `Up to ${endDate}`;
  }, [startDate, endDate]);

  // Currently selected week for stepper navigation
  const weekRange = thisWeekBounds;

  // Extract task completion date string (YYYY-MM-DD)
  const getTaskCompletionDateStr = (t: Task): string | null => {
    if (t.status !== 'Completed') return null;
    const raw = t.updatedAt || t.dueDate || t.createdAt;
    if (!raw) return null;
    try {
      const d = new Date(raw);
      if (isNaN(d.getTime())) return null;
      return toLocalDateStr(d);
    } catch {
      return null;
    }
  };

  // Check if a task was completed inside a given Monday-Sunday range
  const isTaskInWeek = (t: Task, mondayStr: string, sundayStr: string): boolean => {
    const dStr = getTaskCompletionDateStr(t);
    if (!dStr) return false;
    return dStr >= mondayStr && dStr <= sundayStr;
  };

  // Friendly date label (e.g. "Oct 7")
  const formatTaskDate = (dateStr?: string | null): string => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // All enriched completed tasks across all projects
  const allCompletedTasksEnriched = useMemo<EnrichedWeeklyTask[]>(() => {
    return tasks
      .filter((t) => t.status === 'Completed')
      .map((t) => {
        const mem = teamMembers.find((m) => m.id === t.assigneeId);
        const proj = projects.find((p) => p.id === t.projectId);
        const compDateStr = getTaskCompletionDateStr(t);
        const isThisWeek = isTaskInWeek(t, thisWeekBounds.mondayStr, thisWeekBounds.sundayStr);
        const isLastWeek = isTaskInWeek(t, lastWeekBounds.mondayStr, lastWeekBounds.sundayStr);
        return {
          ...t,
          assigneeName: mem?.name || 'Unassigned',
          assigneeAvatar: mem?.avatar,
          assigneeColor: mem?.color,
          projectName: proj?.name || t.projectName || 'General',
          projectColor: proj?.color || '#2563eb',
          completionDateStr: compDateStr,
          isThisWeek,
          isLastWeek,
        };
      });
  }, [tasks, teamMembers, projects, thisWeekBounds, lastWeekBounds]);

  const thisWeekCompletedTasks = useMemo(() => {
    return allCompletedTasksEnriched.filter((t) => t.isThisWeek);
  }, [allCompletedTasksEnriched]);

  const lastWeekCompletedTasks = useMemo(() => {
    return allCompletedTasksEnriched.filter((t) => t.isLastWeek);
  }, [allCompletedTasksEnriched]);


  // Filter all completed tasks by selected date range
  const dateFilteredCompletedTasks = useMemo(() => {
    return allCompletedTasksEnriched.filter((t) => {
      if (startDate || endDate) {
        const compDate = t.completionDateStr;
        if (!compDate) return false;
        if (startDate && compDate < startDate) return false;
        if (endDate && compDate > endDate) return false;
      }
      return true;
    });
  }, [allCompletedTasksEnriched, startDate, endDate]);

  // Further filter & sort completed tasks for Task Listing view
  const finalFilteredTasks = useMemo(() => {
    let result = dateFilteredCompletedTasks;

    // Filter by project
    if (taskProjectFilter !== 'all') {
      result = result.filter((t) => t.projectId === taskProjectFilter);
    }

    // Filter by assignee
    if (taskAssigneeFilter !== 'all') {
      result = result.filter((t) => t.assigneeId === taskAssigneeFilter);
    }

    // Filter by search query
    const q = taskSearchQuery.toLowerCase().trim();
    if (q) {
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.description && t.description.toLowerCase().includes(q)) ||
          t.projectName.toLowerCase().includes(q) ||
          t.assigneeName.toLowerCase().includes(q)
      );
    }

    // Sort
    const priorityWeights: Record<string, number> = { Urgent: 4, High: 3, Medium: 2, Low: 1 };
    return [...result].sort((a, b) => {
      if (taskSortBy === 'project') {
        const pDiff = a.projectName.localeCompare(b.projectName);
        if (pDiff !== 0) return pDiff;
        // Secondary sort: newest completed first within project
        const da = a.completionDateStr || '';
        const db = b.completionDateStr || '';
        return db.localeCompare(da);
      }
      if (taskSortBy === 'project-desc') {
        const pDiff = b.projectName.localeCompare(a.projectName);
        if (pDiff !== 0) return pDiff;
        const da = a.completionDateStr || '';
        const db = b.completionDateStr || '';
        return db.localeCompare(da);
      }
      if (taskSortBy === 'date-desc') {
        const da = a.completionDateStr || '';
        const db = b.completionDateStr || '';
        if (da !== db) return db.localeCompare(da);
        return a.projectName.localeCompare(b.projectName);
      }
      if (taskSortBy === 'date-asc') {
        const da = a.completionDateStr || '';
        const db = b.completionDateStr || '';
        if (da !== db) return da.localeCompare(db);
        return a.projectName.localeCompare(b.projectName);
      }
      if (taskSortBy === 'priority') {
        const pDiff = (priorityWeights[b.priority] || 0) - (priorityWeights[a.priority] || 0);
        if (pDiff !== 0) return pDiff;
        return a.projectName.localeCompare(b.projectName);
      }
      if (taskSortBy === 'title') {
        return a.title.localeCompare(b.title);
      }
      if (taskSortBy === 'assignee') {
        return a.assigneeName.localeCompare(b.assigneeName);
      }
      return 0;
    });
  }, [dateFilteredCompletedTasks, taskProjectFilter, taskAssigneeFilter, taskSearchQuery, taskSortBy]);

  // Checkbox selection state for which tasks to include in the report
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(() => {
    return new Set(dateFilteredCompletedTasks.map((t) => t.id));
  });
  const prevDateRangeKeyRef = useRef<string | null>(null);

  // When date range or preset changes, automatically select all tasks in the new range
  const dateRangeKey = `${datePreset}_${startDate}_${endDate}`;
  useEffect(() => {
    if (prevDateRangeKeyRef.current !== dateRangeKey) {
      prevDateRangeKeyRef.current = dateRangeKey;
      setSelectedTaskIds(new Set(dateFilteredCompletedTasks.map((t) => t.id)));
    }
  }, [dateRangeKey, dateFilteredCompletedTasks]);

  // Tasks in current filtered view that are selected for report
  const selectedTasksInView = useMemo(() => {
    return finalFilteredTasks.filter((t) => selectedTaskIds.has(t.id));
  }, [finalFilteredTasks, selectedTaskIds]);

  const isAllSelected =
    finalFilteredTasks.length > 0 &&
    finalFilteredTasks.every((t) => selectedTaskIds.has(t.id));

  const isSomeSelected =
    !isAllSelected &&
    finalFilteredTasks.some((t) => selectedTaskIds.has(t.id));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedTaskIds((prev) => {
        const next = new Set(prev);
        finalFilteredTasks.forEach((t) => next.delete(t.id));
        return next;
      });
    } else {
      setSelectedTaskIds((prev) => {
        const next = new Set(prev);
        finalFilteredTasks.forEach((t) => next.add(t.id));
        return next;
      });
    }
  };

  const selectAllVisible = () => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      finalFilteredTasks.forEach((t) => next.add(t.id));
      return next;
    });
  };

  const deselectAllVisible = () => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      finalFilteredTasks.forEach((t) => next.delete(t.id));
      return next;
    });
  };

  const toggleTaskSelect = (taskId: string, e?: React.SyntheticEvent) => {
    if (e) {
      e.stopPropagation();
    }
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  // Aggregate project statistics
  const projectSummaries = useMemo(() => {
    return projects.map((project) => {
      const pTasks = tasks.filter((t) => t.projectId === project.id);
      const total = pTasks.length;
      const completed = pTasks.filter((t) => t.status === 'Completed');
      const draft = pTasks.filter((t) => t.status === 'Draft');
      const inProgress = pTasks.filter((t) => t.status === 'In Progress');
      const blocked = pTasks.filter((t) => t.status === 'Blocked');
      const readyReview = pTasks.filter((t) => t.status === 'Ready Review' || t.status === 'Pending');

      const percent = total > 0 ? Math.round((completed.length / total) * 100) : 0;

      // Completed deliverables enriched & categorized by week
      const completedList = allCompletedTasksEnriched.filter((t) => t.projectId === project.id);
      const thisWeekCompleted = completedList.filter((t) => t.isThisWeek);
      const lastWeekCompleted = completedList.filter((t) => t.isLastWeek);
      const earlierCompleted = completedList.filter((t) => !t.isThisWeek && !t.isLastWeek);

      // In progress / ongoing deliverables (including drafts)
      const ongoingList = [...draft, ...inProgress, ...blocked, ...readyReview].map((t) => {
        const mem = teamMembers.find((m) => m.id === t.assigneeId);
        return {
          ...t,
          assigneeName: mem?.name || 'Unassigned',
          assigneeAvatar: mem?.avatar,
          assigneeColor: mem?.color,
        };
      });

      const assignedMembers = teamMembers.filter((m) =>
        project.memberIds?.includes(m.id) || project.managerId === m.id
      );

      return {
        project,
        totalTasks: total,
        completedCount: completed.length,
        draftCount: draft.length,
        inProgressCount: inProgress.length,
        blockedCount: blocked.length,
        readyReviewCount: readyReview.length,
        pendingCount: readyReview.length,
        percent,
        completedList,
        thisWeekCompleted,
        lastWeekCompleted,
        earlierCompleted,
        ongoingList,
        assignedMembers,
      };
    });
  }, [projects, tasks, teamMembers, allCompletedTasksEnriched]);

  // Filtered summaries according to search & status filter
  const filteredProjectSummaries = useMemo(() => {
    return projectSummaries.filter((ps) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        ps.project.name.toLowerCase().includes(q) ||
        (ps.project.client && ps.project.client.toLowerCase().includes(q)) ||
        ps.assignedMembers.some((m) => m.name.toLowerCase().includes(q));

      const matchesStatus = statusFilter === 'All' || ps.project.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [projectSummaries, searchQuery, statusFilter]);

  const toggleProjectExpanded = (projectId: string) => {
    setExpandedProjectIds((prev) => ({
      ...prev,
      [projectId]: !prev[projectId],
    }));
  };

  const toggleExpandAll = () => {
    const allExpanded = filteredProjectSummaries.every((ps) => expandedProjectIds[ps.project.id]);
    if (allExpanded) {
      setExpandedProjectIds({});
    } else {
      const next: Record<string, boolean> = {};
      filteredProjectSummaries.forEach((ps) => {
        next[ps.project.id] = true;
      });
      setExpandedProjectIds(next);
    }
  };

  // Overall KPI metrics
  const overallMetrics = useMemo(() => {
    const totalProjects = projects.length;
    const draftProjects = projects.filter((p) => p.status === 'Draft').length;
    const completedProjects = projects.filter((p) => p.status === 'Completed').length;
    const inProgressProjects = projects.filter((p) => p.status === 'In Progress').length;
    const blockedProjects = projects.filter((p) => p.status === 'Blocked').length;

    const totalTasks = tasks.length;
    const totalDraft = tasks.filter((t) => t.status === 'Draft').length;
    const totalCompleted = tasks.filter((t) => t.status === 'Completed').length;
    const totalBlocked = tasks.filter((t) => t.status === 'Blocked').length;
    const overallRate = totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0;

    return {
      totalProjects,
      draftProjects,
      completedProjects,
      inProgressProjects,
      blockedProjects,
      totalTasks,
      totalDraft,
      totalCompleted,
      totalBlocked,
      overallRate,
    };
  }, [projects, tasks]);

  // Ultra-simple, easy-to-understand PM report text
  const generateSimplePMReport = (): string => {
    const lines = [
      `📊 WEEKLY PROJECT REPORT (${thisWeekBounds.label})`,
      `Executive Summary: ${overallMetrics.overallRate}% Complete | ${overallMetrics.totalCompleted}/${overallMetrics.totalTasks} Total Tasks Done | ${overallMetrics.totalBlocked} Blocked`,
      `Deliverable Pace: ✨ This Week: ${thisWeekCompletedTasks.length} Done | ⏮️ Last Week: ${lastWeekCompletedTasks.length} Done`,
      ``,
    ];

    if (thisWeekCompletedTasks.length > 0) {
      lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      lines.push(`✨ THIS WEEK COMPLETED DELIVERABLES (${thisWeekCompletedTasks.length}) [${thisWeekBounds.label}]:`);
      thisWeekCompletedTasks.forEach((t) => {
        const dateLabel = t.completionDateStr ? ` - Done ${formatTaskDate(t.completionDateStr)}` : '';
        lines.push(`   • [${t.projectName}] ${t.title} (${t.assigneeName})${dateLabel}`);
      });
      lines.push(``);
    }

    if (lastWeekCompletedTasks.length > 0) {
      lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      lines.push(`⏮️ LAST WEEK COMPLETED DELIVERABLES (${lastWeekCompletedTasks.length}) [${lastWeekBounds.label}]:`);
      lastWeekCompletedTasks.forEach((t) => {
        const dateLabel = t.completionDateStr ? ` - Done ${formatTaskDate(t.completionDateStr)}` : '';
        lines.push(`   • [${t.projectName}] ${t.title} (${t.assigneeName})${dateLabel}`);
      });
      lines.push(``);
    }

    lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    lines.push(`📁 PROJECT STATUS & BREAKDOWN:`);
    projectSummaries.forEach((ps, idx) => {
      const p = ps.project;
      lines.push(`---------------------------------`);
      lines.push(`${idx + 1}. ${p.name.toUpperCase()} (Client: ${p.client || 'Internal'})`);
      lines.push(`   • Status: ${p.status} | Completion: ${ps.percent}% (${ps.completedCount}/${ps.totalTasks} Tasks Completed)`);

      if (ps.assignedMembers.length > 0) {
        lines.push(`   • Team: ${ps.assignedMembers.map((m) => m.name).join(', ')}`);
      }

      if (ps.thisWeekCompleted.length > 0) {
        lines.push(`   • ✨ This Week Done (${ps.thisWeekCompleted.length}):`);
        ps.thisWeekCompleted.forEach((t) => {
          lines.push(`     ✓ ${t.title} (${t.assigneeName})`);
        });
      }

      if (ps.lastWeekCompleted.length > 0) {
        lines.push(`   • ⏮️ Last Week Done (${ps.lastWeekCompleted.length}):`);
        ps.lastWeekCompleted.forEach((t) => {
          lines.push(`     ✓ ${t.title} (${t.assigneeName})`);
        });
      }

      if (ps.earlierCompleted.length > 0) {
        lines.push(`   • 📁 Earlier Done (${ps.earlierCompleted.length}):`);
        ps.earlierCompleted.slice(0, 3).forEach((t) => {
          lines.push(`     ✓ ${t.title} (${t.assigneeName})`);
        });
        if (ps.earlierCompleted.length > 3) {
          lines.push(`     ... and ${ps.earlierCompleted.length - 3} more earlier deliverables`);
        }
      }

      if (ps.ongoingList.length > 0) {
        lines.push(`   • Ongoing & Pending:`);
        ps.ongoingList.forEach((t) => {
          const statusIcon = t.status === 'Blocked' ? '⚠️' : t.status === 'Draft' ? '📝' : '⏳';
          lines.push(`     ${statusIcon} ${t.title} [${t.status}] (${t.assigneeName})`);
        });
      }
    });

    lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    lines.push(`Report generated from Project Management Dashboard.`);

    return lines.join('\n');
  };

  const handleCopyReport = () => {
    if (mainView === 'tasks') {
      if (finalFilteredTasks.length === 0) {
        if (onShowToast) {
          onShowToast('info', 'No completed tasks recorded in this date range.');
        }
        return;
      }
      if (selectedTasksInView.length === 0) {
        if (onShowToast) {
          onShowToast('info', 'No tasks selected. Please check at least one task to put in the report.');
        }
        return;
      }

      const lines: string[] = [
        `📋 COMPLETED TASKS SUMMARY`,
        `Date Range: ${formattedDateRangeText}`,
        `Total Completed: ${selectedTasksInView.length} Deliverables`,
        `Generated On: ${new Date().toLocaleString()}`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ];
      selectedTasksInView.forEach((t) => {
        lines.push(`[${t.projectName}] ${t.title}`);
      });
      lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

      const text = lines.join('\n');
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      if (onShowToast) {
        onShowToast(
          'success',
          `Copied report with ${selectedTasksInView.length} selected deliverable${selectedTasksInView.length === 1 ? '' : 's'}!`
        );
      }
      return;
    }

    const text = generateSimplePMReport();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
    if (onShowToast) {
      onShowToast('success', 'Simple Report copied! Ready to send to your Project Manager.');
    }
  };

  const handleExportExcel = async () => {
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();

      // -------------------------------------------------------------
      // SHEET 1: Executive Project Summary (PM Overview)
      // -------------------------------------------------------------
      const summaryData: (string | number)[][] = [
        ['PROJECT MANAGEMENT DASHBOARD - WEEKLY SUMMARY REPORT'],
        [`Current Period: ${thisWeekBounds.label} (Monday – Friday)`],
        [`Generated On: ${new Date().toLocaleString()}`],
        [], // spacing
        ['EXECUTIVE KPI METRICS'],
        ['Metric', 'Value', 'Details'],
        ['This Week Completed Tasks', thisWeekCompletedTasks.length, `${thisWeekBounds.label} (Current Sprint)`],
        ['Last Week Completed Tasks', lastWeekCompletedTasks.length, `${lastWeekBounds.label} (Previous Sprint)`],
        ['Overall Completion Rate', `${overallMetrics.overallRate}%`, `${overallMetrics.totalCompleted} of ${overallMetrics.totalTasks} deliverables done`],
        ['Total Projects', overallMetrics.totalProjects, `${overallMetrics.completedProjects} Completed, ${overallMetrics.inProgressProjects} In Progress, ${overallMetrics.blockedProjects} Blocked`],
        ['Total Tasks Deliverables', overallMetrics.totalTasks, `${overallMetrics.totalCompleted} Finished, ${overallMetrics.totalBlocked} Blocked`],
        ['Roadblocks / Blocked Tasks', overallMetrics.totalBlocked, overallMetrics.totalBlocked > 0 ? 'Requires immediate PM escalation' : 'No blockers identified'],
        [], // spacing
        ['PROJECT STATUS & PROGRESS BREAKDOWN'],
        [
          'No.',
          'Project Name',
          'Client / Category',
          'Status',
          'Completion (%)',
          'This Week Done',
          'Last Week Done',
          'Total Completed',
          'Ongoing Tasks',
          'Blocked Tasks',
          'Total Tasks',
          'Target Deadline',
          'Assigned Team Members',
        ],
      ];

      projectSummaries.forEach((ps, idx) => {
        const p = ps.project;
        summaryData.push([
          idx + 1,
          p.name,
          p.client || 'Internal',
          p.status,
          `${ps.percent}%`,
          ps.thisWeekCompleted.length,
          ps.lastWeekCompleted.length,
          ps.completedCount,
          ps.inProgressCount + ps.pendingCount,
          ps.blockedCount,
          ps.totalTasks,
          p.targetDeadline || 'N/A',
          ps.assignedMembers.map((m) => m.name).join(', ') || 'Unassigned',
        ]);
      });

      const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);

      // Explicit, generous column widths for perfect readability
      wsSummary['!cols'] = [
        { wch: 6 },  // No.
        { wch: 28 }, // Project Name
        { wch: 20 }, // Client
        { wch: 15 }, // Status
        { wch: 16 }, // Completion (%)
        { wch: 16 }, // This Week Done
        { wch: 16 }, // Last Week Done
        { wch: 16 }, // Total Completed
        { wch: 15 }, // Ongoing Tasks
        { wch: 15 }, // Blocked Tasks
        { wch: 14 }, // Total Tasks
        { wch: 18 }, // Target Deadline
        { wch: 36 }, // Assigned Team Members
      ];

      XLSX.utils.book_append_sheet(wb, wsSummary, 'Project Summary');

      // -------------------------------------------------------------
      // SHEET 2: Weekly Completed Tasks (This Week vs Last Week)
      // -------------------------------------------------------------
      const weeklyCompletedData: (string | number)[][] = [
        ['WEEKLY COMPLETED DELIVERABLES COMPARISON'],
        [`Generated On: ${new Date().toLocaleString()}`],
        [],
        [
          'No.',
          'Sprint Week',
          'Project Name',
          'Task / Deliverable Title',
          'Priority',
          'Assignee',
          'Completed Date',
          'Due Date',
        ],
      ];

      let compIdx = 1;
      thisWeekCompletedTasks.forEach((t) => {
        weeklyCompletedData.push([
          compIdx++,
          `This Week (${thisWeekBounds.label})`,
          t.projectName,
          t.title,
          t.priority,
          t.assigneeName,
          t.completionDateStr ? formatTaskDate(t.completionDateStr) : 'This Week',
          t.dueDate || '-',
        ]);
      });

      lastWeekCompletedTasks.forEach((t) => {
        weeklyCompletedData.push([
          compIdx++,
          `Last Week (${lastWeekBounds.label})`,
          t.projectName,
          t.title,
          t.priority,
          t.assigneeName,
          t.completionDateStr ? formatTaskDate(t.completionDateStr) : 'Last Week',
          t.dueDate || '-',
        ]);
      });

      const wsWeekly = XLSX.utils.aoa_to_sheet(weeklyCompletedData);
      wsWeekly['!cols'] = [
        { wch: 6 },
        { wch: 28 },
        { wch: 26 },
        { wch: 34 },
        { wch: 12 },
        { wch: 22 },
        { wch: 18 },
        { wch: 14 },
      ];
      XLSX.utils.book_append_sheet(wb, wsWeekly, 'Weekly Completed Tasks');

      // -------------------------------------------------------------
      // SHEET 3: Deliverables & Tasks Breakdown (Detailed)
      // -------------------------------------------------------------
      const taskData: (string | number)[][] = [
        ['DELIVERABLES & TASKS BREAKDOWN'],
        [`Working Week Period: ${weekRange.label}`],
        [],
        [
          'No.',
          'Project Name',
          'Task / Deliverable Title',
          'Status',
          'Priority',
          'Assignee',
          'Start Date',
          'Due Date',
          'Description',
        ],
      ];

      let taskIndex = 1;
      projects.forEach((proj) => {
        const projTasks = tasks.filter((t) => t.projectId === proj.id);
        projTasks.forEach((t) => {
          const assignee = teamMembers.find((m) => m.id === t.assigneeId)?.name || 'Unassigned';
          taskData.push([
            taskIndex++,
            proj.name,
            t.title,
            t.status,
            t.priority,
            assignee,
            t.startDate || '-',
            t.dueDate || '-',
            t.description || '',
          ]);
        });
      });

      const wsTasks = XLSX.utils.aoa_to_sheet(taskData);

      wsTasks['!cols'] = [
        { wch: 6 },  // No.
        { wch: 26 }, // Project Name
        { wch: 32 }, // Task Title
        { wch: 15 }, // Status
        { wch: 12 }, // Priority
        { wch: 22 }, // Assignee
        { wch: 14 }, // Start Date
        { wch: 14 }, // Due Date
        { wch: 45 }, // Description
      ];

      XLSX.utils.book_append_sheet(wb, wsTasks, 'All Deliverables');

      // File download
      const fileName = `Weekly_Project_Summary_${thisWeekBounds.mondayStr}_to_${thisWeekBounds.fridayStr}.xlsx`;
      XLSX.writeFile(wb, fileName);

      if (onShowToast) {
        onShowToast('success', `Excel report "${fileName}" downloaded successfully!`);
      }
    } catch (err: any) {
      console.error('Export Excel failed:', err);
      if (onShowToast) {
        onShowToast('error', 'Failed to export Excel report.');
      }
    }
  };

  const getStatusBadge = (status: StatusType) => getStatusBadgeClass(status, 'sm');

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* Top Header & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-panel p-5 rounded-2xl shadow-2xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                Project Weekly Summary
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Simple executive overview of project statuses & complete percentages (Mon – Fri)
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Export Excel Button */}
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 dark:bg-emerald-950/50 border border-emerald-300/60 dark:border-emerald-700/60 hover:bg-emerald-500/20 backdrop-blur-xs transition-colors cursor-pointer shadow-2xs"
            title="Export Weekly Report to Excel (.xlsx)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Export Excel</span>
          </button>

          {/* Print / Save as PDF Button */}
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-500/10 dark:bg-blue-950/50 border border-blue-300/60 dark:border-blue-700/60 hover:bg-blue-500/20 backdrop-blur-xs transition-colors cursor-pointer shadow-2xs"
            title="Print or Save Weekly Summary as PDF"
          >
            <Printer className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Print / PDF</span>
          </button>

          {/* Telegram Auto-Report Button */}
          <button
            onClick={() => setIsTelegramModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-sky-700 dark:text-sky-300 bg-sky-500/10 dark:bg-sky-950/50 border border-sky-300/60 dark:border-sky-700/60 hover:bg-sky-500/20 backdrop-blur-xs transition-colors cursor-pointer shadow-2xs"
            title="Configure Telegram Weekly Auto-Report"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Telegram Auto-Report</span>
          </button>

          {/* Copy Report to PM Button */}
          <button
            onClick={handleCopyReport}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer ${
              copied
                ? 'bg-emerald-600 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" />
                Report Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                {mainView === 'tasks' ? `Copy Report (${selectedTasksInView.length})` : 'Copy Report'}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main View Switcher: Projects Overview vs Task Listing */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2.5 glass-panel rounded-2xl shadow-2xs">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 dark:bg-slate-800/80 rounded-xl">
          {/* Main Tab 1: Task Listing (Completed) */}
          <button
            onClick={() => handleSwitchMainView('tasks')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              mainView === 'tasks'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            <span>Task Listing (Completed)</span>
            <span
              className={`px-1.5 py-0.2 rounded-md text-3xs font-extrabold ${
                mainView === 'tasks'
                  ? 'bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300'
                  : 'bg-slate-200/80 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
              }`}
            >
              {dateFilteredCompletedTasks.length}
            </span>
          </button>

          {/* Main Tab 2: Projects Overview */}
          <button
            onClick={() => handleSwitchMainView('projects')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              mainView === 'projects'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <FolderKanban className="w-4 h-4" />
            <span>Projects Overview</span>
            <span
              className={`px-1.5 py-0.2 rounded-md text-3xs font-extrabold ${
                mainView === 'projects'
                  ? 'bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300'
                  : 'bg-slate-200/80 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
              }`}
            >
              {projects.length}
            </span>
          </button>
        </div>

        {/* Quick status text */}
        <div className="flex items-center gap-2 text-2xs text-slate-500 dark:text-slate-400 px-2">
          {mainView === 'tasks' ? (
            <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-medium">
              <Calendar className="w-3.5 h-3.5" />
              <span>Range: {formattedDateRangeText}</span>
            </span>
          ) : (
            <span>Tracking {overallMetrics.totalTasks} deliverables across {projects.length} projects</span>
          )}
        </div>
      </div>

      {/* VIEW A: PROJECTS OVERVIEW */}
      {mainView === 'projects' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Header & Controls Toolbar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Projects Overview ({filteredProjectSummaries.length})
                </h3>
                {filteredProjectSummaries.length !== projectSummaries.length && (
                  <span className="text-3xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                    Filtered from {projectSummaries.length}
                  </span>
                )}
              </div>
              <p className="text-2xs text-slate-500 dark:text-slate-400 mt-0.5">
                Working Week: {weekRange.label} (Monday – Friday)
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
              {/* Search Projects */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search projects..."
                  className="pl-8 pr-7 py-1.5 rounded-xl text-xs bg-white/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 focus:outline-hidden focus:border-blue-500 text-slate-800 dark:text-slate-200 shadow-2xs placeholder-slate-400 w-36 sm:w-44"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Status Filters */}
              <div className="flex items-center glass-card-subtle p-1 rounded-xl text-xs">
                {(['All', 'Draft', 'In Progress', 'Completed', 'Blocked'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      statusFilter === st
                        ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-2xs font-bold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>

              {/* Expand / Collapse All (in Table view) */}
              {viewMode === 'table' && (
                <button
                  onClick={toggleExpandAll}
                  className="px-2.5 py-1.5 text-xs font-semibold rounded-xl text-slate-700 dark:text-slate-300 glass-panel hover:bg-white/90 dark:hover:bg-slate-800 transition-all cursor-pointer shadow-2xs"
                  title="Expand or collapse deliverable details"
                >
                  {filteredProjectSummaries.length > 0 &&
                  filteredProjectSummaries.every((ps) => expandedProjectIds[ps.project.id])
                    ? 'Collapse All'
                    : 'Expand All'}
                </button>
              )}

              {/* View Mode Toggle: Table (default) vs Cards */}
              <div className="flex items-center glass-card-subtle p-1 rounded-xl">
                <button
                  onClick={() => setViewMode('table')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    viewMode === 'table'
                      ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="Table View (Compact Overview)"
                >
                  <TableIcon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Table</span>
                </button>
                <button
                  onClick={() => setViewMode('card')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    viewMode === 'card'
                      ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="Card View"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Cards</span>
                </button>
              </div>
            </div>
          </div>

          {/* Content Section */}
          {filteredProjectSummaries.length === 0 ? (
            <div className="p-12 text-center glass-panel rounded-2xl shadow-2xs text-slate-500 text-xs">
              <p className="font-semibold text-sm text-slate-700 dark:text-slate-300">
                No matching projects found
              </p>
              <p className="text-slate-400 text-xs mt-1">
                Try adjusting your search query or status filter.
              </p>
            </div>
          ) : viewMode === 'table' ? (
            /* Table View */
            <div className="glass-panel rounded-2xl shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200/80 dark:border-slate-800/80 bg-white/40 dark:bg-slate-800/50 backdrop-blur-xs text-2xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                      <th className="py-3 px-3 text-center w-12">#</th>
                      <th className="py-3 px-4 min-w-[210px]">Project</th>
                      <th className="py-3 px-4 min-w-[135px] whitespace-nowrap">Status</th>
                      <th className="py-3 px-4 min-w-[140px]">Progress</th>
                      <th className="py-3 px-4 min-w-[240px]">Deliverables</th>
                      <th className="py-3 px-4 min-w-[120px]">Deadline</th>
                      <th className="py-3 px-4 min-w-[100px]">Team</th>
                      <th className="py-3 px-4 text-right min-w-[70px]">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                    {filteredProjectSummaries.map(
                      (
                        {
                          project,
                          totalTasks,
                          completedCount,
                          inProgressCount,
                          blockedCount,
                          pendingCount,
                          percent,
                          completedList,
                          thisWeekCompleted,
                          lastWeekCompleted,
                          earlierCompleted,
                          ongoingList,
                          assignedMembers,
                        },
                        idx
                      ) => {
                        const isExpanded = !!expandedProjectIds[project.id];
                        return (
                          <React.Fragment key={project.id}>
                            <tr
                              onClick={() => toggleProjectExpanded(project.id)}
                              className={`group cursor-pointer transition-colors ${
                                isExpanded
                                  ? 'bg-blue-500/10 dark:bg-blue-950/30'
                                  : 'hover:bg-white/60 dark:hover:bg-slate-800/50'
                              }`}
                            >
                              {/* # and Expand icon */}
                              <td className="py-3.5 px-3 text-center">
                                <div className="flex items-center justify-center gap-1 text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                  <span className="text-3xs font-bold text-slate-500 dark:text-slate-400">
                                    {idx + 1}
                                  </span>
                                  {isExpanded ? (
                                    <ChevronUp className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                                  ) : (
                                    <ChevronDown className="w-3.5 h-3.5" />
                                  )}
                                </div>
                              </td>

                              {/* Project Name & Client */}
                              <td className="py-3.5 px-4">
                                <div className="flex items-center gap-2.5">
                                  <span
                                    className="w-3.5 h-3.5 rounded-full shrink-0 shadow-2xs ring-2 ring-white/80 dark:ring-slate-800/80"
                                    style={{ backgroundColor: project.color || '#2563eb' }}
                                  />
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                        {project.name}
                                      </span>
                                      {project.client && (
                                        <span className="px-1.5 py-0.5 rounded text-3xs font-semibold bg-white/60 dark:bg-slate-800/60 backdrop-blur-xs border border-slate-200/60 dark:border-slate-700/60 text-slate-600 dark:text-slate-300">
                                          {project.client}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* Status */}
                              <td className="py-3.5 px-4 whitespace-nowrap">
                                <StatusBadge status={project.status} size="sm" />
                              </td>

                              {/* Progress */}
                              <td className="py-3.5 px-4">
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between text-2xs">
                                    <span className="font-black text-slate-800 dark:text-slate-200">
                                      {percent}%
                                    </span>
                                    <span className="text-3xs text-slate-400 dark:text-slate-500 font-medium">
                                      {completedCount}/{totalTasks}
                                    </span>
                                  </div>
                                  <div className="w-24 bg-slate-200/60 dark:bg-slate-800/80 h-1.5 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition-all duration-300 ${
                                        percent === 100
                                          ? 'bg-emerald-500'
                                          : percent >= 50
                                          ? 'bg-blue-600'
                                          : 'bg-amber-500'
                                      }`}
                                      style={{ width: `${percent}%` }}
                                    />
                                  </div>
                                </div>
                              </td>

                              {/* Deliverables Overview */}
                              <td className="py-3.5 px-4">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {thisWeekCompleted.length > 0 && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-3xs font-bold bg-emerald-500/20 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300/80 dark:border-emerald-700/80 backdrop-blur-xs">
                                        <Sparkles className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                        {thisWeekCompleted.length} This Week
                                      </span>
                                    )}
                                    {lastWeekCompleted.length > 0 && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-3xs font-bold bg-sky-500/20 text-sky-700 dark:bg-sky-950/70 dark:text-sky-300 border border-sky-300/80 dark:border-sky-700/80 backdrop-blur-xs">
                                        <History className="w-3 h-3 text-sky-600 dark:text-sky-400" />
                                        {lastWeekCompleted.length} Last Week
                                      </span>
                                    )}
                                    {earlierCompleted.length > 0 && thisWeekCompleted.length === 0 && lastWeekCompleted.length === 0 && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-3xs font-semibold bg-emerald-500/15 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-700/60 backdrop-blur-xs">
                                        <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                        {completedCount} Done
                                      </span>
                                    )}
                                    {inProgressCount + pendingCount > 0 && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-3xs font-semibold bg-blue-500/15 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-300/60 dark:border-blue-700/60 backdrop-blur-xs">
                                        <Clock className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                                        {inProgressCount + pendingCount} Ongoing
                                      </span>
                                    )}
                                    {blockedCount > 0 && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-3xs font-semibold bg-rose-500/15 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300/60 dark:border-rose-700/60 backdrop-blur-xs">
                                        <AlertOctagon className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                                        {blockedCount} Blocked
                                      </span>
                                    )}
                                    {totalTasks === 0 && (
                                      <span className="text-3xs text-slate-400 italic">No tasks</span>
                                    )}
                                  </div>

                                  <div className="text-3xs text-slate-500 dark:text-slate-400 truncate max-w-xs">
                                    {completedList.length > 0 && (
                                      <span className="text-emerald-700 dark:text-emerald-400">
                                        ✓ {completedList[0].title}
                                      </span>
                                    )}
                                    {completedList.length > 0 && ongoingList.length > 0 && (
                                      <span> • </span>
                                    )}
                                    {ongoingList.length > 0 && (
                                      <span>⏳ {ongoingList[0].title}</span>
                                    )}
                                  </div>
                                </div>
                              </td>

                              {/* Deadline */}
                              <td className="py-3.5 px-4">
                                <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                  <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  <span>{project.targetDeadline || 'No deadline'}</span>
                                </div>
                              </td>

                              {/* Team */}
                              <td className="py-3.5 px-4">
                                {assignedMembers.length > 0 ? (
                                  <div className="flex items-center gap-2">
                                    <div className="flex items-center -space-x-1.5 shrink-0">
                                      {assignedMembers.slice(0, 3).map((m) =>
                                        m.avatar ? (
                                          <img
                                            key={m.id}
                                            src={m.avatar}
                                            alt={m.name}
                                            title={`${m.name} (${m.role})`}
                                            className="w-5.5 h-5.5 rounded-full ring-2 ring-white dark:ring-slate-900 object-cover shrink-0 shadow-2xs"
                                          />
                                        ) : (
                                          <div
                                            key={m.id}
                                            title={`${m.name} (${m.role})`}
                                            style={{ backgroundColor: m.color || '#2563eb' }}
                                            className="w-5.5 h-5.5 rounded-full text-white text-3xs font-bold flex items-center justify-center ring-2 ring-white dark:ring-slate-900 shadow-2xs shrink-0"
                                          >
                                            {m.name.charAt(0).toUpperCase()}
                                          </div>
                                        )
                                      )}
                                      {assignedMembers.length > 3 && (
                                        <span
                                          className="w-5.5 h-5.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-3xs font-bold flex items-center justify-center ring-2 ring-white dark:ring-slate-900 shrink-0 shadow-2xs"
                                          title={assignedMembers.slice(3).map((m) => m.name).join(', ')}
                                        >
                                          +{assignedMembers.length - 3}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-xs text-slate-400 italic">Unassigned</span>
                                )}
                              </td>

                              {/* Action */}
                              <td className="py-3.5 px-4 text-right">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onSelectProject(project.id);
                                  }}
                                  className="inline-flex items-center justify-center p-1.5 rounded-lg text-blue-600 dark:text-blue-400 bg-blue-500/10 dark:bg-blue-950/60 hover:bg-blue-500/20 dark:hover:bg-blue-900/60 border border-blue-300/60 dark:border-blue-800/50 backdrop-blur-xs transition-colors cursor-pointer shadow-2xs"
                                  title={`Open ${project.name} Kanban Board`}
                                  aria-label={`Open ${project.name} Kanban Board`}
                                >
                                  <ArrowRight className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>

                            {/* Expandable Task Detail Drawer */}
                            {isExpanded && (
                              <tr className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-xs border-b border-slate-200/80 dark:border-slate-800/80">
                                <td colSpan={8} className="py-4 px-6">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Completed Deliverables Bucket */}
                                    <div className="p-3.5 bg-emerald-50/50 dark:bg-emerald-950/30 backdrop-blur-xs rounded-xl border border-emerald-200/60 dark:border-emerald-800/50 shadow-2xs">
                                      <div className="flex items-center justify-between text-2xs font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider mb-2.5">
                                        <div className="flex items-center gap-1.5">
                                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                          <span>Completed Tasks ({completedList.length})</span>
                                        </div>
                                        {onOpenTaskModal && (
                                          <span className="text-3xs font-normal text-emerald-700 dark:text-emerald-300 lowercase">
                                            (click task to inspect)
                                          </span>
                                        )}
                                      </div>

                                      {completedList.length === 0 ? (
                                        <p className="text-3xs text-slate-400 italic">
                                          No tasks completed yet.
                                        </p>
                                      ) : (
                                        <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                                          {/* Sub-group 1: This Week Completed */}
                                          {thisWeekCompleted.length > 0 && (
                                            <div>
                                              <div className="flex items-center gap-1 text-3xs font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider mb-1">
                                                <Sparkles className="w-3 h-3 text-emerald-600" />
                                                <span>This Week ({thisWeekCompleted.length})</span>
                                              </div>
                                              <ul className="space-y-1">
                                                {thisWeekCompleted.map((t) => (
                                                  <li
                                                    key={t.id}
                                                    onClick={() => onOpenTaskModal && onOpenTaskModal(t)}
                                                    className={`flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-white/85 dark:bg-slate-800/70 backdrop-blur-xs border border-emerald-300/60 dark:border-emerald-800/50 shadow-2xs gap-2 transition-all ${
                                                      onOpenTaskModal ? 'cursor-pointer hover:border-emerald-500 group' : ''
                                                    }`}
                                                  >
                                                    <span className="font-semibold text-slate-800 dark:text-slate-200 group-hover:text-emerald-600 truncate transition-colors">
                                                      ✓ {t.title}
                                                    </span>
                                                    <div className="flex items-center gap-1.5 shrink-0 text-3xs text-slate-500 dark:text-slate-400 font-medium bg-white/60 dark:bg-slate-900/60 backdrop-blur-xs border border-slate-200/50 dark:border-slate-700/50 px-1.5 py-0.5 rounded">
                                                      <span>{t.assigneeName}</span>
                                                      <span className="text-emerald-600 font-bold">
                                                        {t.completionDateStr ? formatTaskDate(t.completionDateStr) : 'This Week'}
                                                      </span>
                                                    </div>
                                                  </li>
                                                ))}
                                              </ul>
                                            </div>
                                          )}

                                          {/* Sub-group 2: Last Week Completed */}
                                          {lastWeekCompleted.length > 0 && (
                                            <div>
                                              <div className="flex items-center gap-1 text-3xs font-bold text-sky-700 dark:text-sky-300 uppercase tracking-wider mb-1">
                                                <History className="w-3 h-3 text-sky-600" />
                                                <span>Last Week ({lastWeekCompleted.length})</span>
                                              </div>
                                              <ul className="space-y-1">
                                                {lastWeekCompleted.map((t) => (
                                                  <li
                                                    key={t.id}
                                                    onClick={() => onOpenTaskModal && onOpenTaskModal(t)}
                                                    className={`flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-white/85 dark:bg-slate-800/70 backdrop-blur-xs border border-sky-300/60 dark:border-sky-800/50 shadow-2xs gap-2 transition-all ${
                                                      onOpenTaskModal ? 'cursor-pointer hover:border-sky-500 group' : ''
                                                    }`}
                                                  >
                                                    <span className="font-semibold text-slate-800 dark:text-slate-200 group-hover:text-sky-600 truncate transition-colors">
                                                      ✓ {t.title}
                                                    </span>
                                                    <div className="flex items-center gap-1.5 shrink-0 text-3xs text-slate-500 dark:text-slate-400 font-medium bg-white/60 dark:bg-slate-900/60 backdrop-blur-xs border border-slate-200/50 dark:border-slate-700/50 px-1.5 py-0.5 rounded">
                                                      <span>{t.assigneeName}</span>
                                                      <span className="text-sky-600 font-bold">
                                                        {t.completionDateStr ? formatTaskDate(t.completionDateStr) : 'Last Week'}
                                                      </span>
                                                    </div>
                                                  </li>
                                                ))}
                                              </ul>
                                            </div>
                                          )}

                                          {/* Sub-group 3: Earlier Completed */}
                                          {earlierCompleted.length > 0 && (
                                            <div>
                                              <div className="flex items-center gap-1 text-3xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                                                <CheckCircle2 className="w-3 h-3 text-slate-400" />
                                                <span>Earlier Completed ({earlierCompleted.length})</span>
                                              </div>
                                              <ul className="space-y-1">
                                                {earlierCompleted.map((t) => (
                                                  <li
                                                    key={t.id}
                                                    onClick={() => onOpenTaskModal && onOpenTaskModal(t)}
                                                    className={`flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-white/85 dark:bg-slate-800/70 backdrop-blur-xs border border-slate-200/60 dark:border-slate-700/60 shadow-2xs gap-2 transition-all ${
                                                      onOpenTaskModal ? 'cursor-pointer hover:border-blue-400 group' : ''
                                                    }`}
                                                  >
                                                    <span className="font-medium text-slate-800 dark:text-slate-200 group-hover:text-blue-600 truncate transition-colors">
                                                      ✓ {t.title}
                                                    </span>
                                                    <div className="flex items-center gap-1.5 shrink-0 text-3xs text-slate-500 dark:text-slate-400 font-medium bg-white/60 dark:bg-slate-900/60 backdrop-blur-xs border border-slate-200/50 dark:border-slate-700/50 px-1.5 py-0.5 rounded">
                                                      <span>{t.assigneeName}</span>
                                                      {t.completionDateStr && (
                                                        <span>{formatTaskDate(t.completionDateStr)}</span>
                                                      )}
                                                    </div>
                                                  </li>
                                                ))}
                                              </ul>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>

                                    {/* Ongoing & Blocked Deliverables List */}
                                    <div className="p-3.5 glass-card-subtle rounded-xl border border-slate-200/80 dark:border-slate-700/60 shadow-2xs">
                                      <div className="flex items-center justify-between text-2xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2.5">
                                        <div className="flex items-center gap-1.5">
                                          <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                                          <span>Ongoing & Blocked Tasks ({ongoingList.length})</span>
                                        </div>
                                      </div>
                                      {ongoingList.length === 0 ? (
                                        <p className="text-3xs text-emerald-600 dark:text-emerald-400 font-medium">
                                          All tasks in this project are completed! 🎉
                                        </p>
                                      ) : (
                                        <ul className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                                          {ongoingList.map((t) => (
                                            <li
                                              key={t.id}
                                              onClick={() => onOpenTaskModal && onOpenTaskModal(t)}
                                              className={`flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-white/85 dark:bg-slate-800/70 backdrop-blur-xs border border-slate-200/80 dark:border-slate-700/60 shadow-2xs gap-2 transition-all ${
                                                onOpenTaskModal ? 'cursor-pointer hover:border-blue-400 group' : ''
                                              }`}
                                            >
                                              <span className="font-medium text-slate-800 dark:text-slate-200 group-hover:text-blue-600 truncate transition-colors">
                                                {t.title}
                                              </span>
                                              <div className="flex items-center gap-1.5 shrink-0">
                                                <StatusBadge status={t.status} size="xs" />
                                                <div className="flex items-center gap-1 text-3xs text-slate-500 dark:text-slate-400 font-medium bg-white/60 dark:bg-slate-900/60 backdrop-blur-xs border border-slate-200/50 dark:border-slate-700/50 px-1.5 py-0.5 rounded">
                                                  <span>{t.assigneeName}</span>
                                                </div>
                                              </div>
                                            </li>
                                          ))}
                                        </ul>
                                      )}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      }
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Card View */
            filteredProjectSummaries.map(
              ({
                project,
                totalTasks,
                completedCount,
                percent,
                completedList,
                thisWeekCompleted,
                lastWeekCompleted,
                earlierCompleted,
                ongoingList,
                assignedMembers,
              }) => (
                <div
                  key={project.id}
                  className="glass-panel-interactive p-5 sm:p-6 rounded-2xl shadow-2xs hover:shadow-xs transition-all"
                >
                  {/* Project Title, Client, Status & Completion Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200/60 dark:border-slate-800/60">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded-full ring-2 ring-white/80 dark:ring-slate-800/80 shadow-xs shrink-0"
                        style={{ backgroundColor: project.color || '#2563eb' }}
                      />
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                            {project.name}
                          </h4>
                          {project.client && (
                            <span className="px-2 py-0.5 rounded-md text-2xs font-semibold bg-white/60 dark:bg-slate-800/60 backdrop-blur-xs border border-slate-200/50 dark:border-slate-700/50 text-slate-700 dark:text-slate-300">
                              {project.client}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-2xs text-slate-500 dark:text-slate-400">
                            Deadline: {project.targetDeadline || 'No deadline'}
                          </span>
                          {assignedMembers.length > 0 ? (
                            <>
                              <span className="text-slate-300 dark:text-slate-700">•</span>
                              <div className="flex items-center gap-1.5">
                                <div className="flex items-center -space-x-1.5 shrink-0">
                                  {assignedMembers.slice(0, 4).map((m) =>
                                    m.avatar ? (
                                      <img
                                        key={m.id}
                                        src={m.avatar}
                                        alt={m.name}
                                        title={`${m.name} (${m.role})`}
                                        className="w-5 h-5 rounded-full ring-2 ring-white dark:ring-slate-900 object-cover shrink-0 shadow-2xs"
                                      />
                                    ) : (
                                      <div
                                        key={m.id}
                                        title={`${m.name} (${m.role})`}
                                        style={{ backgroundColor: m.color || '#2563eb' }}
                                        className="w-5 h-5 rounded-full text-white text-3xs font-bold flex items-center justify-center ring-2 ring-white dark:ring-slate-900 shadow-2xs shrink-0"
                                      >
                                        {m.name.charAt(0).toUpperCase()}
                                      </div>
                                    )
                                  )}
                                  {assignedMembers.length > 4 && (
                                    <span
                                      className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-3xs font-bold flex items-center justify-center ring-2 ring-white dark:ring-slate-900 shrink-0 shadow-2xs"
                                      title={assignedMembers.slice(4).map((m) => m.name).join(', ')}
                                    >
                                      +{assignedMembers.length - 4}
                                    </span>
                                  )}
                                </div>
                                <span
                                  className="text-2xs text-slate-700 dark:text-slate-300 font-medium truncate max-w-[180px]"
                                  title={assignedMembers.map((m) => m.name).join(', ')}
                                >
                                  {assignedMembers.map((m) => m.name).join(', ')}
                                </span>
                              </div>
                            </>
                          ) : (
                            <>
                              <span className="text-slate-300 dark:text-slate-700">•</span>
                              <span className="text-2xs text-slate-400 italic">Unassigned</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-start sm:self-center">
                      <StatusBadge status={project.status} size="sm" />
                      <div className="text-right">
                        <span className="text-base font-black text-slate-900 dark:text-white">
                          {percent}%
                        </span>
                        <p className="text-3xs text-slate-400 dark:text-slate-500">
                          {completedCount}/{totalTasks} Tasks
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-4">
                    <div className="w-full bg-slate-200/60 dark:bg-slate-800/80 h-2.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          percent === 100
                            ? 'bg-emerald-500'
                            : percent >= 50
                            ? 'bg-blue-600'
                            : 'bg-amber-500'
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>

                  {/* Simple 2-Column Task Breakdown: Completed vs Ongoing */}
                  <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {/* Completed Tasks */}
                    <div className="p-3.5 bg-emerald-50/50 dark:bg-emerald-950/30 backdrop-blur-xs rounded-xl border border-emerald-200/60 dark:border-emerald-800/50 shadow-2xs">
                      <div className="flex items-center justify-between text-2xs font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider mb-2.5">
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          <span>Completed Tasks ({completedList.length})</span>
                        </div>
                      </div>
                      {completedList.length === 0 ? (
                        <p className="text-3xs text-slate-400 italic">No tasks completed yet.</p>
                      ) : (
                        <div className="space-y-2.5">
                          {thisWeekCompleted.length > 0 && (
                            <div>
                              <span className="text-4xs font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 block mb-1">
                                ✨ This Week ({thisWeekCompleted.length})
                              </span>
                              <ul className="space-y-1">
                                {thisWeekCompleted.map((t) => (
                                  <li
                                    key={t.id}
                                    onClick={() => onOpenTaskModal && onOpenTaskModal(t)}
                                    className={`flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-white/85 dark:bg-slate-800/70 border border-emerald-300/50 dark:border-emerald-800/40 gap-2 ${
                                      onOpenTaskModal ? 'cursor-pointer hover:border-emerald-500 group' : ''
                                    }`}
                                  >
                                    <span className="font-semibold text-slate-800 dark:text-slate-200 group-hover:text-emerald-600 truncate">
                                      ✓ {t.title}
                                    </span>
                                    <span className="text-3xs text-emerald-600 shrink-0 font-bold">
                                      {t.completionDateStr ? formatTaskDate(t.completionDateStr) : 'This Week'}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {lastWeekCompleted.length > 0 && (
                            <div>
                              <span className="text-4xs font-extrabold uppercase tracking-wider text-sky-700 dark:text-sky-300 block mb-1">
                                ⏮️ Last Week ({lastWeekCompleted.length})
                              </span>
                              <ul className="space-y-1">
                                {lastWeekCompleted.map((t) => (
                                  <li
                                    key={t.id}
                                    onClick={() => onOpenTaskModal && onOpenTaskModal(t)}
                                    className={`flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-white/85 dark:bg-slate-800/70 border border-sky-300/50 dark:border-sky-800/40 gap-2 ${
                                      onOpenTaskModal ? 'cursor-pointer hover:border-sky-500 group' : ''
                                    }`}
                                  >
                                    <span className="font-semibold text-slate-800 dark:text-slate-200 group-hover:text-sky-600 truncate">
                                      ✓ {t.title}
                                    </span>
                                    <span className="text-3xs text-sky-600 shrink-0 font-bold">
                                      {t.completionDateStr ? formatTaskDate(t.completionDateStr) : 'Last Week'}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {earlierCompleted.length > 0 && (
                            <div>
                              <span className="text-4xs font-extrabold uppercase tracking-wider text-slate-500 block mb-1">
                                📁 Earlier ({earlierCompleted.length})
                              </span>
                              <ul className="space-y-1">
                                {earlierCompleted.map((t) => (
                                  <li
                                    key={t.id}
                                    onClick={() => onOpenTaskModal && onOpenTaskModal(t)}
                                    className={`flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-white/85 dark:bg-slate-800/70 border border-slate-200/60 dark:border-slate-700/60 gap-2 ${
                                      onOpenTaskModal ? 'cursor-pointer hover:border-blue-400 group' : ''
                                    }`}
                                  >
                                    <span className="font-medium text-slate-800 dark:text-slate-200 group-hover:text-blue-600 truncate">
                                      ✓ {t.title}
                                    </span>
                                    <span className="text-3xs text-slate-400 shrink-0">
                                      {t.completionDateStr ? formatTaskDate(t.completionDateStr) : 'Earlier'}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Ongoing Tasks */}
                    <div className="p-3.5 glass-card-subtle rounded-xl border border-slate-200/80 dark:border-slate-700/60 shadow-2xs">
                      <div className="flex items-center justify-between text-2xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2.5">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          <span>Ongoing Tasks ({ongoingList.length})</span>
                        </div>
                      </div>
                      {ongoingList.length === 0 ? (
                        <p className="text-3xs text-emerald-600 dark:text-emerald-400 font-medium">
                          All tasks in this project are completed! 🎉
                        </p>
                      ) : (
                        <ul className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                          {ongoingList.map((t) => (
                            <li
                              key={t.id}
                              onClick={() => onOpenTaskModal && onOpenTaskModal(t)}
                              className={`flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-white/85 dark:bg-slate-800/70 backdrop-blur-xs border border-slate-200/80 dark:border-slate-700/60 shadow-2xs gap-2 transition-all ${
                                onOpenTaskModal ? 'cursor-pointer hover:border-blue-400 group' : ''
                              }`}
                            >
                              <span className="font-semibold text-slate-800 dark:text-slate-200 group-hover:text-blue-600 truncate transition-colors">
                                {t.title}
                              </span>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <StatusBadge status={t.status} size="xs" />
                                <div className="flex items-center gap-1 text-3xs text-slate-500 dark:text-slate-400 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xs border border-slate-200/50 dark:border-slate-700/50 px-1.5 py-0.5 rounded">
                                  <span>{t.assigneeName}</span>
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  {/* Bottom Quick Jump Link */}
                  <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-end">
                    <button
                      onClick={() => onSelectProject(project.id)}
                      className="inline-flex items-center gap-1 text-2xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                    >
                      <span>Open Kanban Board</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )
            )
          )}
        </div>
      )}

      {/* VIEW B: TASK LISTING (COMPLETED TASKS WITH DATE RANGE FILTER) */}
      {mainView === 'tasks' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Date Range Selector Toolbar */}
          <div className="glass-panel p-4 rounded-2xl shadow-2xs space-y-3">
            {/* Row 1: Modern Date Range Picker & Presets */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-2xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>Period:</span>
                </span>

                {/* Modern Custom Date Range Picker (No native browser popup!) */}
                <ModernDateRangePicker
                  startDate={startDate}
                  endDate={endDate}
                  onChange={(start, end, preset) => {
                    setStartDate(start);
                    setEndDate(end);
                    if (preset) setDatePreset(preset as DateRangePreset);
                    else setDatePreset('custom');
                  }}
                />

                {/* Quick Presets Pills */}
                <div className="flex items-center gap-1 bg-slate-100/80 dark:bg-slate-800/80 p-0.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60 shadow-2xs">
                  {[
                    { id: 'this-week', label: 'This Week' },
                    { id: 'last-week', label: 'Last Week' },
                    { id: 'this-month', label: 'This Month' },
                    { id: 'all', label: 'All Time' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      onClick={() => applyPreset(p.id as DateRangePreset)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        datePreset === p.id
                          ? 'bg-blue-600 text-white shadow-2xs font-bold'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Right: Reset Button */}
              {(startDate || endDate) && datePreset !== 'this-week' && (
                <button
                  onClick={() => applyPreset('this-week')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 glass-card-subtle rounded-xl text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
                  title="Reset to current week"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset to This Week</span>
                </button>
              )}
            </div>

            {/* Row 2: Search, Filters, Sorting & View Toggle */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2.5 border-t border-slate-100 dark:border-slate-800/80">
              <div className="flex flex-wrap items-center gap-2 flex-1">
                {/* Search */}
                <div className="relative min-w-[210px] flex-1 max-w-sm">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={taskSearchQuery}
                    onChange={(e) => setTaskSearchQuery(e.target.value)}
                    placeholder="Search task title, description, assignee..."
                    className="w-full pl-8 pr-7 py-1.5 rounded-xl text-xs bg-white/85 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 focus:outline-hidden focus:border-blue-500 text-slate-800 dark:text-slate-200 shadow-2xs placeholder-slate-400"
                  />
                  {taskSearchQuery && (
                    <button
                      onClick={() => setTaskSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Project Filter */}
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/85 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 text-xs shadow-2xs">
                  <FolderKanban className="w-3.5 h-3.5 text-blue-500" />
                  <select
                    value={taskProjectFilter}
                    onChange={(e) => setTaskProjectFilter(e.target.value)}
                    className="bg-transparent text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-hidden cursor-pointer"
                  >
                    <option value="all">All Projects ({projects.length})</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Assignee Filter */}
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/85 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 text-xs shadow-2xs">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <select
                    value={taskAssigneeFilter}
                    onChange={(e) => setTaskAssigneeFilter(e.target.value)}
                    className="bg-transparent text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-hidden cursor-pointer"
                  >
                    <option value="all">All Assignees</option>
                    {teamMembers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Sort By */}
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/85 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 text-xs shadow-2xs">
                  <ArrowUpDown className="w-3.5 h-3.5 text-blue-500" />
                  <select
                    value={taskSortBy}
                    onChange={(e) => handleSortChange(e.target.value as any)}
                    className="bg-transparent text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-hidden cursor-pointer"
                  >
                    <option value="project">Sort by Project (A–Z)</option>
                    <option value="project-desc">Sort by Project (Z–A)</option>
                    <option value="date-desc">Newest Completed First</option>
                    <option value="date-asc">Oldest Completed First</option>
                    <option value="priority">Priority (High to Low)</option>
                    <option value="title">Task Title (A–Z)</option>
                    <option value="assignee">Assignee Name (A–Z)</option>
                  </select>
                </div>
              </div>

              {/* View Mode Toggle: Table vs Cards */}
              <div className="flex items-center glass-card-subtle p-1 rounded-xl shadow-2xs">
                <button
                  onClick={() => setTaskViewMode('table')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    taskViewMode === 'table'
                      ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-2xs font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="Table View (Detailed Rows)"
                >
                  <TableIcon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Table</span>
                </button>
                <button
                  onClick={() => setTaskViewMode('card')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    taskViewMode === 'card'
                      ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-2xs font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="Card View (Visual Deliverables)"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Cards</span>
                </button>
              </div>
            </div>
          </div>

          {/* Subheader Status Line */}
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1 flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span>
                Showing <strong className="text-slate-900 dark:text-white font-extrabold">{finalFilteredTasks.length}</strong> completed tasks
              </span>
              <span className="text-slate-300 dark:text-slate-600">•</span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-2xs font-bold bg-blue-100/80 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/70 dark:border-blue-800/70">
                <CheckSquare className="w-3 h-3" />
                <span>{selectedTasksInView.length} selected for report</span>
              </span>
              {finalFilteredTasks.length > 0 && (
                <div className="flex items-center gap-1.5 text-2xs font-semibold ml-1">
                  <button
                    onClick={selectAllVisible}
                    className="hover:underline text-blue-600 dark:text-blue-400 cursor-pointer"
                  >
                    Select All
                  </button>
                  <span className="text-slate-300 dark:text-slate-600">/</span>
                  <button
                    onClick={deselectAllVisible}
                    className="hover:underline text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer"
                  >
                    Deselect All
                  </button>
                </div>
              )}
              <span className="text-slate-300 dark:text-slate-600">•</span>
              <span className="font-semibold text-blue-700 dark:text-blue-400">
                Period: {formattedDateRangeText}
              </span>
              {dateFilteredCompletedTasks.length !== finalFilteredTasks.length && (
                <span className="text-3xs px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold">
                  Filtered from {dateFilteredCompletedTasks.length} in range
                </span>
              )}
            </div>

            {finalFilteredTasks.length > 0 && (
              <span className="text-3xs text-slate-400 hidden sm:inline">
                Click any task to view or edit details
              </span>
            )}
          </div>

          {/* Tasks Display */}
          {finalFilteredTasks.length === 0 ? (
            <div className="p-12 text-center glass-panel rounded-2xl shadow-2xs space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-100/70 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  No completed tasks found for this date range
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                  {formattedDateRangeText} has no recorded deliverables matching your filters.
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  onClick={() => applyPreset('this-week')}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-950/60 hover:bg-blue-200 transition-colors cursor-pointer"
                >
                  View This Week ({thisWeekCompletedTasks.length})
                </button>
                <button
                  onClick={() => applyPreset('last-week')}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-sky-700 dark:text-sky-300 bg-sky-100 dark:bg-sky-950/60 hover:bg-sky-200 transition-colors cursor-pointer"
                >
                  View Last Week ({lastWeekCompletedTasks.length})
                </button>
                <button
                  onClick={() => applyPreset('all')}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 glass-card hover:bg-white/90 transition-colors cursor-pointer"
                >
                  Show All Time ({allCompletedTasksEnriched.length})
                </button>
              </div>
            </div>
          ) : taskViewMode === 'table' ? (
            /* Table View */
            <div className="glass-panel rounded-2xl shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200/80 dark:border-slate-800/80 bg-white/40 dark:bg-slate-800/50 backdrop-blur-xs text-2xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                      <th className="py-3 px-3 text-center w-14">
                        <div className="flex items-center justify-center">
                          <input
                            type="checkbox"
                            checked={isAllSelected}
                            ref={(el) => {
                              if (el) el.indeterminate = isSomeSelected;
                            }}
                            onChange={toggleSelectAll}
                            className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                            title={isAllSelected ? 'Deselect all visible tasks' : 'Select all visible tasks for report'}
                            aria-label="Select or deselect all tasks"
                          />
                        </div>
                      </th>
                      <th
                        onClick={() => handleSortChange(taskSortBy === 'title' ? 'date-desc' : 'title')}
                        className="py-3 px-4 min-w-[240px] cursor-pointer hover:bg-slate-100/60 dark:hover:bg-slate-800/60 transition-colors select-none group"
                        title="Sort by Deliverable Title"
                      >
                        <div className="flex items-center gap-1.5">
                          <span>Deliverable Title</span>
                          {taskSortBy === 'title' ? (
                            <ChevronUp className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-slate-300 dark:text-slate-600 group-hover:text-slate-500" />
                          )}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSortChange(taskSortBy === 'project' ? 'project-desc' : 'project')}
                        className={`py-3 px-4 min-w-[170px] cursor-pointer hover:bg-slate-100/60 dark:hover:bg-slate-800/60 transition-colors select-none group ${
                          taskSortBy === 'project' || taskSortBy === 'project-desc'
                            ? 'text-blue-600 dark:text-blue-400 font-extrabold'
                            : ''
                        }`}
                        title="Sort by Project"
                      >
                        <div className="flex items-center gap-1.5">
                          <span>Project</span>
                          {taskSortBy === 'project' ? (
                            <ChevronUp className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                          ) : taskSortBy === 'project-desc' ? (
                            <ChevronDown className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-slate-300 dark:text-slate-600 group-hover:text-slate-500" />
                          )}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSortChange(taskSortBy === 'assignee' ? 'date-desc' : 'assignee')}
                        className="py-3 px-4 min-w-[160px] cursor-pointer hover:bg-slate-100/60 dark:hover:bg-slate-800/60 transition-colors select-none group"
                        title="Sort by Assignee"
                      >
                        <div className="flex items-center gap-1.5">
                          <span>Assignee</span>
                          {taskSortBy === 'assignee' ? (
                            <ChevronUp className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-slate-300 dark:text-slate-600 group-hover:text-slate-500" />
                          )}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSortChange(taskSortBy === 'date-desc' ? 'date-asc' : 'date-desc')}
                        className={`py-3 px-4 min-w-[150px] cursor-pointer hover:bg-slate-100/60 dark:hover:bg-slate-800/60 transition-colors select-none group ${
                          taskSortBy === 'date-desc' || taskSortBy === 'date-asc'
                            ? 'text-blue-600 dark:text-blue-400 font-extrabold'
                            : ''
                        }`}
                        title="Sort by Completed Date"
                      >
                        <div className="flex items-center gap-1.5">
                          <span>Completed Date</span>
                          {taskSortBy === 'date-desc' ? (
                            <ChevronDown className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                          ) : taskSortBy === 'date-asc' ? (
                            <ChevronUp className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-slate-300 dark:text-slate-600 group-hover:text-slate-500" />
                          )}
                        </div>
                      </th>
                      <th className="py-3 px-4 min-w-[120px]">Due Date</th>
                      <th
                        onClick={() => handleSortChange(taskSortBy === 'priority' ? 'date-desc' : 'priority')}
                        className="py-3 px-4 min-w-[110px] cursor-pointer hover:bg-slate-100/60 dark:hover:bg-slate-800/60 transition-colors select-none group"
                        title="Sort by Priority"
                      >
                        <div className="flex items-center gap-1.5">
                          <span>Priority</span>
                          {taskSortBy === 'priority' ? (
                            <ChevronDown className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-slate-300 dark:text-slate-600 group-hover:text-slate-500" />
                          )}
                        </div>
                      </th>
                      <th className="py-3 px-4 text-right min-w-[70px]">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                    {finalFilteredTasks.map((t, idx) => {
                      const isSelected = selectedTaskIds.has(t.id);
                      return (
                        <tr
                          key={t.id}
                          onClick={() => onOpenTaskModal && onOpenTaskModal(t)}
                          className={`transition-colors cursor-pointer group ${
                            isSelected
                              ? 'hover:bg-slate-50/90 dark:hover:bg-slate-800/60 bg-blue-50/15 dark:bg-blue-950/15'
                              : 'opacity-60 hover:opacity-90 hover:bg-slate-50/60 dark:hover:bg-slate-800/30'
                          }`}
                        >
                          <td
                            className="py-3 px-3 text-center"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-center gap-1.5">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => toggleTaskSelect(t.id, e)}
                                className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                                aria-label={`Select ${t.title} for report`}
                              />
                              <span className="text-slate-400 font-mono text-3xs w-4 text-right">
                                {idx + 1}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <CheckCircle2
                                className={`w-4 h-4 shrink-0 ${
                                  isSelected
                                    ? 'text-blue-600 dark:text-blue-400'
                                    : 'text-slate-400 dark:text-slate-500'
                                }`}
                              />
                              <div className="min-w-0">
                                <span className="font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate block max-w-[320px]">
                                  {t.title}
                                </span>
                                {t.description && (
                                  <span className="text-3xs text-slate-500 dark:text-slate-400 truncate block max-w-[320px]">
                                    {t.description}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-2xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/70 border border-slate-200/60 dark:border-slate-700/60 max-w-[160px] truncate">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: t.projectColor }}
                            />
                            <span className="truncate">{t.projectName}</span>
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {t.assigneeAvatar ? (
                              <img
                                src={t.assigneeAvatar}
                                alt={t.assigneeName}
                                className="w-5 h-5 rounded-full object-cover shrink-0"
                              />
                            ) : (
                              <div
                                style={{ backgroundColor: t.assigneeColor || '#2563eb' }}
                                className="w-5 h-5 rounded-full text-white text-4xs font-bold flex items-center justify-center shrink-0"
                              >
                                {t.assigneeName.charAt(0)}
                              </div>
                            )}
                            <span className="text-xs text-slate-700 dark:text-slate-300 truncate max-w-[120px]">
                              {t.assigneeName}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1 text-2xs font-semibold text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/50 border border-blue-200/60 dark:border-blue-800/60">
                            <Check className="w-3 h-3 text-blue-600" />
                            <span>{t.completionDateStr ? formatTaskDate(t.completionDateStr) : 'Completed'}</span>
                          </span>
                        </td>
                        <td className="py-3 px-4 text-2xs text-slate-500 dark:text-slate-400">
                          {t.dueDate ? formatTaskDate(t.dueDate) : '-'}
                        </td>
                        <td className="py-3 px-4">
                          <PriorityBadge priority={t.priority} size="xs" />
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenTaskModal && onOpenTaskModal(t);
                            }}
                            className="p-1 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-700 transition-colors"
                            title="View task details"
                          >
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Card View */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {finalFilteredTasks.map((t) => {
                const isSelected = selectedTaskIds.has(t.id);
                return (
                  <div
                    key={t.id}
                    onClick={() => onOpenTaskModal && onOpenTaskModal(t)}
                    className={`p-4 rounded-xl backdrop-blur-xs border shadow-2xs hover:shadow-sm transition-all cursor-pointer group ${
                      isSelected
                        ? 'bg-white/85 dark:bg-slate-800/80 border-slate-200/80 dark:border-slate-700/60 hover:border-blue-400 dark:hover:border-blue-600'
                        : 'bg-white/50 dark:bg-slate-800/40 border-slate-200/40 dark:border-slate-700/30 opacity-60 hover:opacity-90'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                          {/* Checkbox for report */}
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center mr-0.5"
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => toggleTaskSelect(t.id, e)}
                              className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                              title={isSelected ? 'Included in report' : 'Excluded from report'}
                              aria-label={`Select ${t.title} for report`}
                            />
                          </div>
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-3xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-700/60">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: t.projectColor }}
                            />
                            <span className="truncate max-w-[130px]">{t.projectName}</span>
                          </span>
                          <PriorityBadge priority={t.priority} size="xs" />
                        </div>

                      <h5 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        ✓ {t.title}
                      </h5>

                      {t.description && (
                        <p className="text-3xs sm:text-2xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-1">
                          {t.description}
                        </p>
                      )}
                    </div>

                    <div className="shrink-0 p-1.5 rounded-lg text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:bg-blue-50 dark:group-hover:bg-blue-950/50 transition-all">
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-3xs sm:text-2xs text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-1.5">
                      {t.assigneeAvatar ? (
                        <img
                          src={t.assigneeAvatar}
                          alt={t.assigneeName}
                          className="w-4 h-4 rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <div
                          style={{ backgroundColor: t.assigneeColor || '#2563eb' }}
                          className="w-4 h-4 rounded-full text-white text-4xs font-bold flex items-center justify-center shrink-0"
                        >
                          {t.assigneeName.charAt(0)}
                        </div>
                      )}
                      <span className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-[120px]">
                        {t.assigneeName}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>{t.completionDateStr ? formatTaskDate(t.completionDateStr) : 'Completed'}</span>
                    </div>
                  </div>
                </div>
              );
            })}
            </div>
          )}
        </div>
      )}

      {/* Telegram Automation Settings Modal */}
      <React.Suspense fallback={null}>
        <TelegramSettingsModal
          isOpen={isTelegramModalOpen}
          onClose={() => setIsTelegramModalOpen(false)}
          onShowToast={onShowToast}
        />
      </React.Suspense>
    </div>
  );
};

