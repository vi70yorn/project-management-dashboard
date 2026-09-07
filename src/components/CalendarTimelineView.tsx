import React, { useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Folder,
  CheckSquare,
  Search,
  Filter,
  X,
  User,
  ArrowLeft,
  LayoutGrid,
  Layers,
  Flag,
  Sparkles,
  SlidersHorizontal,
  Target,
  ArrowRight,
} from 'lucide-react';
import { Project, Task, TeamMember, StatusType, PriorityType } from '../types';
import { getStatusBadgeClass, getPriorityBadgeClass } from './Badges';
import { CustomSelect, CustomSelectOption } from './ui/CustomSelect';

interface CalendarTimelineViewProps {
  projects: Project[];
  tasks: Task[];
  teamMembers: TeamMember[];
  onSelectProject: (projectId: string) => void;
  onOpenTaskModal: (task?: Task | null, defaultStatus?: StatusType) => void;
  onBackToDashboard: () => void;
}

export interface TaskScheduleItem {
  task: Task;
  isStart: boolean;
  isEnd: boolean;
  isSingleDay: boolean;
  isOngoing: boolean;
  startDate: string;
  dueDate: string;
}

// Format local date YYYY-MM-DD without UTC timezone skew
export const formatLocalDate = (year: number, monthIndex: number, day: number): string => {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

// Format short date e.g. "Sep 8"
export const formatShortDate = (dateStr?: string): string => {
  if (!dateStr) return '';
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length < 3) return dateStr;
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const mIndex = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  return `${monthNames[mIndex] || ''} ${day}`;
};

// Get standardized task start and due dates
export const getTaskScheduleRange = (task: Task): { startDate: string; dueDate: string } | null => {
  const due = task.dueDate ? task.dueDate.split('T')[0] : '';
  const start = task.startDate ? task.startDate.split('T')[0] : due;
  if (!due && !start) return null;
  if (start && due && start > due) {
    return { startDate: due, dueDate: due };
  }
  return { startDate: start || due, dueDate: due || start };
};

export const CalendarTimelineView: React.FC<CalendarTimelineViewProps> = ({
  projects = [],
  tasks = [],
  teamMembers = [],
  onSelectProject,
  onOpenTaskModal,
  onBackToDashboard,
}) => {
  // Navigation: Year & Month
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [viewMode, setViewMode] = useState<'calendar' | 'timeline'>('calendar');

  // Filters
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Day expanded popover state for calendar
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  const activeYear = currentDate.getFullYear();
  const activeMonth = currentDate.getMonth(); // 0 - 11

  // Navigation handlers
  const handlePrevMonth = () => {
    setCurrentDate(new Date(activeYear, activeMonth - 1, 1));
    setExpandedDay(null);
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(activeYear, activeMonth + 1, 1));
    setExpandedDay(null);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
    setExpandedDay(null);
  };

  const monthName = currentDate.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  // Filtered tasks and projects
  const filteredProjects = useMemo(() => {
    let list = projects.filter((p) => !p.deletedAt);
    if (selectedProjectId !== 'all') {
      list = list.filter((p) => p.id === selectedProjectId);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.client && p.client.toLowerCase().includes(q))
      );
    }
    return list;
  }, [projects, selectedProjectId, searchQuery]);

  const filteredTasks = useMemo(() => {
    let list = tasks.filter((t) => !t.deletedAt);

    if (selectedProjectId !== 'all') {
      list = list.filter((t) => t.projectId === selectedProjectId);
    }
    if (selectedStatus !== 'all') {
      list = list.filter((t) => t.status === selectedStatus);
    }
    if (selectedPriority !== 'all') {
      list = list.filter((t) => t.priority === selectedPriority);
    }
    if (selectedAssigneeId !== 'all') {
      list = list.filter((t) => t.assigneeId === selectedAssigneeId);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.projectName && t.projectName.toLowerCase().includes(q)) ||
          (t.description && t.description.toLowerCase().includes(q))
      );
    }
    return list;
  }, [tasks, selectedProjectId, selectedStatus, selectedPriority, selectedAssigneeId, searchQuery]);

  // Quick stats for the current view
  const stats = useMemo(() => {
    const total = filteredTasks.length;
    const completed = filteredTasks.filter((t) => t.status === 'Completed').length;
    const inProgress = filteredTasks.filter((t) => t.status === 'In Progress').length;
    const blocked = filteredTasks.filter((t) => t.status === 'Blocked').length;
    return { total, completed, inProgress, blocked };
  }, [filteredTasks]);

  // Member map for quick lookup
  const memberMap = useMemo(() => {
    const map = new Map<string, TeamMember>();
    teamMembers.forEach((m) => map.set(m.id, m));
    return map;
  }, [teamMembers]);

  // Project map for quick lookup
  const projectMap = useMemo(() => {
    const map = new Map<string, Project>();
    projects.forEach((p) => map.set(p.id, p));
    return map;
  }, [projects]);

  // Helper for priority color dot
  const getPriorityDot = (priority: PriorityType) => {
    switch (priority) {
      case 'Urgent':
        return 'bg-rose-500';
      case 'High':
        return 'bg-amber-500';
      case 'Medium':
        return 'bg-blue-500';
      case 'Low':
        return 'bg-emerald-500';
      default:
        return 'bg-slate-400';
    }
  };

  // Helper for status background pill
  const getStatusPillClass = (status: StatusType | string) => {
    switch (status) {
      case 'Completed':
        return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800';
      case 'In Progress':
        return 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-800';
      case 'Ready Review':
      case 'Pending':
        return 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800';
      case 'Blocked':
        return 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800';
      default:
        return 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-800';
    }
  };

  // Helper for Gantt bar color
  const getGanttTaskColor = (status: StatusType | string) => {
    switch (status) {
      case 'Completed':
        return 'bg-emerald-500 hover:bg-emerald-600 text-white';
      case 'In Progress':
        return 'bg-blue-600 hover:bg-blue-700 text-white';
      case 'Ready Review':
      case 'Pending':
        return 'bg-amber-500 hover:bg-amber-600 text-white';
      case 'Blocked':
        return 'bg-rose-600 hover:bg-rose-700 text-white';
      default:
        return 'bg-slate-500 hover:bg-slate-600 text-white';
    }
  };

  // -------------------------------------------------------------
  // Mode 1: Month Calendar Grid Logic
  // -------------------------------------------------------------
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(activeYear, activeMonth, 1);
    const lastDayOfMonth = new Date(activeYear, activeMonth + 1, 0);

    // Days in current month
    const totalDaysInMonth = lastDayOfMonth.getDate();

    // Day of week for first day (0 is Sunday, 1 is Monday ... 6 is Saturday)
    // We want Monday as day 0
    let startDayOfWeek = firstDayOfMonth.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6; // Sunday becomes 6

    // Days from previous month to fill row
    const prevMonthLastDay = new Date(activeYear, activeMonth, 0).getDate();
    const days: Array<{
      date: Date;
      dateStr: string;
      dayNum: number;
      isCurrentMonth: boolean;
    }> = [];

    // Leading days from previous month
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const dayNum = prevMonthLastDay - i;
      const date = new Date(activeYear, activeMonth - 1, dayNum);
      const dateStr = formatLocalDate(date.getFullYear(), date.getMonth(), date.getDate());
      days.push({
        date,
        dateStr,
        dayNum,
        isCurrentMonth: false,
      });
    }

    // Days in current month
    for (let dayNum = 1; dayNum <= totalDaysInMonth; dayNum++) {
      const date = new Date(activeYear, activeMonth, dayNum);
      const dateStr = formatLocalDate(activeYear, activeMonth, dayNum);
      days.push({
        date,
        dateStr,
        dayNum,
        isCurrentMonth: true,
      });
    }

    // Trailing days to round up to full week (multiple of 7)
    const remainingDays = 7 - (days.length % 7);
    if (remainingDays < 7) {
      for (let dayNum = 1; dayNum <= remainingDays; dayNum++) {
        const date = new Date(activeYear, activeMonth + 1, dayNum);
        const dateStr = formatLocalDate(date.getFullYear(), date.getMonth(), date.getDate());
        days.push({
          date,
          dateStr,
          dayNum,
          isCurrentMonth: false,
        });
      }
    }

    return days;
  }, [activeYear, activeMonth]);

  // Group tasks across their full active range [startDate, dueDate]
  const tasksByDay = useMemo(() => {
    const map = new Map<string, TaskScheduleItem[]>();

    calendarDays.forEach((d) => {
      map.set(d.dateStr, []);
    });

    // Sort tasks consistently by startDate, dueDate, title so multi-day items align
    const sortedTasks = [...filteredTasks].sort((a, b) => {
      const rangeA = getTaskScheduleRange(a);
      const rangeB = getTaskScheduleRange(b);
      const startA = rangeA?.startDate || '';
      const startB = rangeB?.startDate || '';
      if (startA !== startB) return startA.localeCompare(startB);
      const dueA = rangeA?.dueDate || '';
      const dueB = rangeB?.dueDate || '';
      if (dueA !== dueB) return dueA.localeCompare(dueB);
      return a.title.localeCompare(b.title);
    });

    sortedTasks.forEach((task) => {
      const range = getTaskScheduleRange(task);
      if (!range) return;
      const { startDate, dueDate } = range;

      calendarDays.forEach((d) => {
        const dayStr = d.dateStr;
        if (startDate <= dayStr && dayStr <= dueDate) {
          const isStart = dayStr === startDate;
          const isEnd = dayStr === dueDate;
          const isSingleDay = startDate === dueDate;
          const isOngoing = !isStart && !isEnd;

          if (!map.has(dayStr)) map.set(dayStr, []);
          map.get(dayStr)!.push({
            task,
            isStart,
            isEnd,
            isSingleDay,
            isOngoing,
            startDate,
            dueDate,
          });
        }
      });
    });

    return map;
  }, [filteredTasks, calendarDays]);

  // Group project deadlines and kickoffs
  const projectMilestonesByDay = useMemo(() => {
    const map = new Map<string, Array<{ project: Project; type: 'kickoff' | 'deadline' }>>();

    filteredProjects.forEach((proj) => {
      if (proj.targetDeadline) {
        const d = proj.targetDeadline.split('T')[0];
        if (!map.has(d)) map.set(d, []);
        map.get(d)!.push({ project: proj, type: 'deadline' });
      }
      if (proj.startDate) {
        const d = proj.startDate.split('T')[0];
        if (!map.has(d)) map.set(d, []);
        map.get(d)!.push({ project: proj, type: 'kickoff' });
      }
    });

    return map;
  }, [filteredProjects]);

  const todayStr = useMemo(() => {
    const now = new Date();
    return formatLocalDate(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);

  // -------------------------------------------------------------
  // Mode 2: Project Timeline (Gantt) Grid Logic
  // -------------------------------------------------------------
  const daysInMonthCount = new Date(activeYear, activeMonth + 1, 0).getDate();
  const timelineDays = useMemo(() => {
    return Array.from({ length: daysInMonthCount }, (_, i) => {
      const dayNum = i + 1;
      const d = new Date(activeYear, activeMonth, dayNum);
      const dayStr = formatLocalDate(activeYear, activeMonth, dayNum);
      const dayOfWeekShort = d.toLocaleDateString('en-US', { weekday: 'narrow' });
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      const isToday = dayStr === todayStr;
      return { dayNum, dayStr, dayOfWeekShort, isWeekend, isToday };
    });
  }, [activeYear, activeMonth, daysInMonthCount, todayStr]);

  // Calculate left% and width% for a date range within current month (pure local midnight)
  const getTimelinePosition = (startStr?: string, endStr?: string) => {
    if (!startStr && !endStr) return null;

    const monthStart = new Date(activeYear, activeMonth, 1, 0, 0, 0).getTime();
    const monthEnd = new Date(activeYear, activeMonth, daysInMonthCount, 23, 59, 59, 999).getTime();

    const parseToLocalStart = (s: string) => {
      const parts = s.split('T')[0].split('-').map(Number);
      if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
        return new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0).getTime();
      }
      return new Date(s).getTime();
    };

    const parseToLocalEnd = (s: string) => {
      const parts = s.split('T')[0].split('-').map(Number);
      if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
        return new Date(parts[0], parts[1] - 1, parts[2], 23, 59, 59, 999).getTime();
      }
      return new Date(s).getTime();
    };

    const startDate = startStr ? parseToLocalStart(startStr) : (endStr ? parseToLocalStart(endStr) : monthStart);
    const endDate = endStr ? parseToLocalEnd(endStr) : startDate;

    // Check if range overlaps with this month
    if (endDate < monthStart || startDate > monthEnd) {
      return null;
    }

    const clampedStart = Math.max(startDate, monthStart);
    const clampedEnd = Math.min(endDate, monthEnd);

    const totalDuration = monthEnd - monthStart;
    const offset = clampedStart - monthStart;
    const duration = Math.max(clampedEnd - clampedStart, 86400000); // at least 1 day width

    const leftPercent = Math.max(0, Math.min(100, (offset / totalDuration) * 100));
    const widthPercent = Math.max(1.5, Math.min(100 - leftPercent, (duration / totalDuration) * 100));

    return { leftPercent, widthPercent };
  };

  const isCurrentMonthView = useMemo(() => {
    const now = new Date();
    return activeYear === now.getFullYear() && activeMonth === now.getMonth();
  }, [activeYear, activeMonth]);

  return (
    <div id="calendar-timeline-view" className="space-y-5 animate-in fade-in duration-200">
      {/* Top Header & View Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
        <div>
         {/*  <button
            onClick={onBackToDashboard}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition-colors mb-2 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Dashboard
          </button> */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                Calendar & Timeline
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Track project schedules and task deliverables spanning from Start Date to Target Due Date.
              </p>
            </div>
          </div>
        </div>

        {/* View Switcher & Month Navigation Controls */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Mode Switcher: Calendar vs Timeline */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'calendar'
                  ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              <span>Calendar</span>
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'timeline'
                  ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Timeline</span>
            </button>
          </div>

          {/* Stepper navigator */}
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/80 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200">
            <button
              onClick={handlePrevMonth}
              className="p-1 text-slate-400 hover:text-slate-800 dark:hover:text-white rounded hover:bg-slate-200/60 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              title="Previous Month"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <div className="flex items-center gap-1.5 px-1">
              <CalendarIcon className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>{monthName}</span>
            </div>
            <button
              onClick={handleNextMonth}
              className="p-1 text-slate-400 hover:text-slate-800 dark:hover:text-white rounded hover:bg-slate-200/60 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              title="Next Month"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleToday}
              className="ml-1 px-2 py-0.5 text-3xs font-bold uppercase tracking-wider bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 rounded-md shadow-2xs hover:bg-blue-50 dark:hover:bg-slate-600 transition-colors cursor-pointer border border-slate-200/60 dark:border-slate-600/60"
              title="Jump to Current Month"
            >
              Today
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-2xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Deliverables
            </p>
            <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-0.5">
              {stats.total}
            </p>
          </div>
          <div className="p-2 bg-blue-50 dark:bg-blue-950/50 rounded-lg text-blue-600 dark:text-blue-400">
            <CheckSquare className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-2xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              In Progress
            </p>
            <p className="text-xl sm:text-2xl font-black text-blue-600 dark:text-blue-400 mt-0.5">
              {stats.inProgress}
            </p>
          </div>
          <div className="p-2 bg-blue-50 dark:bg-blue-950/50 rounded-lg text-blue-600 dark:text-blue-400">
            <Clock className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-2xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Completed
            </p>
            <p className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
              {stats.completed}
            </p>
          </div>
          <div className="p-2 bg-emerald-50 dark:bg-emerald-950/50 rounded-lg text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-2xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Blocked / Critical
            </p>
            <p className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400 mt-0.5">
              {stats.blocked}
            </p>
          </div>
          <div className="p-2 bg-rose-50 dark:bg-rose-950/50 rounded-lg text-rose-600 dark:text-rose-400">
            <AlertCircle className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Interactive Filters Bar */}
      <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Project Filter */}
          <CustomSelect
            value={selectedProjectId}
            onChange={setSelectedProjectId}
            size="sm"
            icon={<Folder className="w-3.5 h-3.5" />}
            options={[
              { value: 'all', label: `All Projects (${projects.length})` },
              ...projects.map((p) => ({
                value: p.id,
                label: p.name,
                color: p.color,
              })),
            ]}
          />

          {/* Status Filter */}
          <CustomSelect
            value={selectedStatus}
            onChange={setSelectedStatus}
            size="sm"
            icon={<CheckCircle2 className="w-3.5 h-3.5" />}
            options={[
              { value: 'all', label: 'All Statuses' },
              { value: 'In Progress', label: 'In Progress', color: '#3b82f6' },
              { value: 'Ready Review', label: 'Ready Review', color: '#f59e0b' },
              { value: 'Blocked', label: 'Blocked', color: '#f43f5e' },
              { value: 'Completed', label: 'Completed', color: '#10b981' },
            ]}
          />

          {/* Priority Filter */}
          <CustomSelect
            value={selectedPriority}
            onChange={setSelectedPriority}
            size="sm"
            icon={<Flag className="w-3.5 h-3.5" />}
            options={[
              { value: 'all', label: 'All Priorities' },
              { value: 'Urgent', label: 'Urgent', color: '#f43f5e' },
              { value: 'High', label: 'High', color: '#f97316' },
              { value: 'Medium', label: 'Medium', color: '#f59e0b' },
              { value: 'Low', label: 'Low', color: '#64748b' },
            ]}
          />

          {/* Assignee Filter */}
          <CustomSelect
            value={selectedAssigneeId}
            onChange={setSelectedAssigneeId}
            size="sm"
            icon={<User className="w-3.5 h-3.5" />}
            options={[
              { value: 'all', label: `All Assignees (${teamMembers.length})` },
              ...teamMembers.map((m) => ({
                value: m.id,
                label: m.name,
                sublabel: m.role,
                color: m.color,
              })),
            ]}
          />

          {(selectedProjectId !== 'all' ||
            selectedStatus !== 'all' ||
            selectedPriority !== 'all' ||
            selectedAssigneeId !== 'all' ||
            searchQuery) && (
            <button
              onClick={() => {
                setSelectedProjectId('all');
                setSelectedStatus('all');
                setSelectedPriority('all');
                setSelectedAssigneeId('all');
                setSearchQuery('');
              }}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline px-2 py-1 font-semibold cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search deliverables..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ============================================================= */}
      {/* MODE 1: MONTHLY CALENDAR GRID                                  */}
      {/* ============================================================= */}
      {viewMode === 'calendar' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
          {/* Day of Week Headers */}
          <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 text-center text-xs font-bold text-slate-600 dark:text-slate-400 py-3">
            <div>Mon</div>
            <div>Tue</div>
            <div>Wed</div>
            <div>Thu</div>
            <div>Fri</div>
            <div className="text-blue-600 dark:text-blue-400">Sat</div>
            <div className="text-rose-600 dark:text-rose-400">Sun</div>
          </div>

          {/* Calendar Day Cells */}
          <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-200 dark:divide-slate-800">
            {calendarDays.map((day) => {
              const dayTasks = tasksByDay.get(day.dateStr) || [];
              const dayMilestones = projectMilestonesByDay.get(day.dateStr) || [];
              const isToday = day.dateStr === todayStr;

              return (
                <div
                  key={day.dateStr}
                  className={`min-h-[110px] sm:min-h-[135px] p-2 flex flex-col justify-between transition-colors ${
                    !day.isCurrentMonth
                      ? 'bg-slate-50/40 dark:bg-slate-900/30 text-slate-400 dark:text-slate-600'
                      : 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white hover:bg-slate-50/60 dark:hover:bg-slate-800/30'
                  }`}
                >
                  {/* Day Header: Number + Milestone indicators */}
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${
                        isToday
                          ? 'bg-blue-600 text-white shadow-2xs ring-2 ring-blue-400/30'
                          : day.isCurrentMonth
                          ? 'text-slate-800 dark:text-slate-200'
                          : 'text-slate-400 dark:text-slate-600'
                      }`}
                    >
                      {day.dayNum}
                    </span>

                    {/* Project Milestone Badges (Kickoff / Deadline) */}
                    {dayMilestones.length > 0 && (
                      <div className="flex items-center gap-1">
                        {dayMilestones.slice(0, 1).map((m, idx) => (
                          <span
                            key={idx}
                            className={`inline-flex items-center gap-1 text-3xs font-extrabold px-1.5 py-0.5 rounded-md cursor-pointer ${
                              m.type === 'deadline'
                                ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800/80'
                                : 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800/80'
                            }`}
                            title={`Project ${m.type === 'deadline' ? 'Deadline' : 'Kickoff'}: ${m.project.name}`}
                            onClick={() => onSelectProject(m.project.id)}
                          >
                            {m.type === 'deadline' ? (
                              <Flag className="w-2.5 h-2.5" />
                            ) : (
                              <Sparkles className="w-2.5 h-2.5" />
                            )}
                            <span className="hidden sm:inline">
                              {m.type === 'deadline' ? 'Deadline' : 'Kickoff'}
                            </span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Tasks Container (Showing Multi-day Spans from startDate to dueDate) */}
                  <div className="space-y-1.5 flex-1 overflow-hidden">
                    {dayTasks.slice(0, 2).map((item) => {
                      const { task, isStart, isEnd, isSingleDay, isOngoing, startDate, dueDate } = item;
                      const assignee = memberMap.get(task.assigneeId);
                      const project = projectMap.get(task.projectId);

                      // Determine card border and styling based on role in schedule
                      const cardStyle = isSingleDay
                        ? getStatusPillClass(task.status)
                        : isEnd
                        ? 'bg-rose-500/10 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border-rose-300 dark:border-rose-800 ring-1 ring-rose-400/40'
                        : isStart
                        ? 'bg-blue-500/10 dark:bg-blue-950/40 text-blue-800 dark:text-blue-200 border-blue-300 dark:border-blue-800 border-l-4 border-l-blue-600 dark:border-l-blue-400'
                        : 'bg-slate-500/10 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 border-l-2 border-l-blue-400/60 dark:border-l-blue-500/60';

                      return (
                        <div
                          key={`${task.id}-${day.dateStr}`}
                          onClick={() => onOpenTaskModal(task)}
                          className={`group p-1.5 rounded-lg border text-2xs transition-all cursor-pointer hover:shadow-2xs hover:scale-[1.01] ${cardStyle}`}
                          title={`${task.title} (${task.status} • Priority: ${task.priority})\nSchedule: ${startDate} → ${dueDate} (${
                            isSingleDay ? '1 Day' : isStart ? 'Start Date' : isEnd ? 'Target Due Date' : 'Ongoing'
                          })`}
                        >
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`w-1.5 h-1.5 rounded-full shrink-0 ${getPriorityDot(
                                task.priority
                              )}`}
                            />
                            <p className="font-semibold truncate flex-1 leading-tight">
                              {task.title}
                            </p>
                            {assignee?.avatar ? (
                              <img
                                src={assignee.avatar}
                                alt={assignee.name}
                                className="w-3.5 h-3.5 rounded-full object-cover shrink-0 ring-1 ring-white/50"
                              />
                            ) : assignee ? (
                              <span className="w-3.5 h-3.5 rounded-full bg-slate-300 dark:bg-slate-700 text-3xs font-bold flex items-center justify-center shrink-0">
                                {assignee.name.charAt(0)}
                              </span>
                            ) : null}
                          </div>

                          <div className="flex items-center justify-between gap-1 mt-0.5">
                            {project ? (
                              <p className="text-3xs text-slate-500 dark:text-slate-400 truncate flex-1">
                                {project.name}
                              </p>
                            ) : (
                              <span />
                            )}

                            {/* Schedule Span Tag */}
                            {isSingleDay ? null : isEnd ? (
                              <span className="inline-flex items-center gap-0.5 text-3xs font-bold text-rose-600 dark:text-rose-400 bg-rose-100/80 dark:bg-rose-900/60 px-1 py-0.2 rounded shrink-0">
                                <Flag className="w-2 h-2" />
                                Due
                              </span>
                            ) : isStart ? (
                              <span className="text-3xs font-bold text-blue-600 dark:text-blue-400 bg-blue-100/80 dark:bg-blue-900/60 px-1 py-0.2 rounded shrink-0">
                                Start
                              </span>
                            ) : (
                              <span className="text-3xs text-slate-400 dark:text-slate-500 font-medium shrink-0">
                                ⇄ Due {formatShortDate(dueDate)}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {dayTasks.length > 2 && (
                      <button
                        onClick={() => setExpandedDay(day.dateStr)}
                        className="w-full text-center text-3xs font-bold text-blue-600 dark:text-blue-400 hover:underline py-0.5 cursor-pointer"
                      >
                        +{dayTasks.length - 2} more
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Popover Modal for Expanded Day Tasks */}
      {expandedDay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-blue-600" />
                  Deliverables on {formatShortDate(expandedDay)} ({expandedDay})
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {(tasksByDay.get(expandedDay) || []).length} active deliverable(s)
                </p>
              </div>
              <button
                onClick={() => setExpandedDay(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto space-y-2.5 pr-1">
              {(tasksByDay.get(expandedDay) || []).map((item) => {
                const { task, isStart, isEnd, isSingleDay, isOngoing, startDate, dueDate } = item;
                const assignee = memberMap.get(task.assigneeId);
                const project = projectMap.get(task.projectId);

                return (
                  <div
                    key={task.id}
                    onClick={() => {
                      setExpandedDay(null);
                      onOpenTaskModal(task);
                    }}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 hover:border-blue-300 dark:hover:border-blue-700 transition-all cursor-pointer shadow-2xs flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${getPriorityDot(task.priority)}`} />
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {task.title}
                        </h4>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {project && <span>{project.name}</span>}
                        <span>•</span>
                        <span className={getStatusBadgeClass(task.status, 'xs')}>
                          {task.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 text-3xs text-slate-500 dark:text-slate-400">
                        <span className="font-semibold">Schedule:</span>
                        <span>
                          {startDate} → {dueDate}
                        </span>
                        {isEnd && (
                          <span className="font-bold text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-950/60 px-1 py-0.2 rounded">
                            Target Due Date
                          </span>
                        )}
                        {isStart && !isEnd && (
                          <span className="font-bold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-950/60 px-1 py-0.2 rounded">
                            Start Date
                          </span>
                        )}
                        {isOngoing && (
                          <span className="font-medium text-slate-600 dark:text-slate-400">
                            Ongoing
                          </span>
                        )}
                      </div>
                    </div>
                    {assignee && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        {assignee.avatar ? (
                          <img
                            src={assignee.avatar}
                            alt={assignee.name}
                            className="w-6 h-6 rounded-full object-cover"
                          />
                        ) : (
                          <span className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 text-xs font-bold flex items-center justify-center">
                            {assignee.name.charAt(0)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* MODE 2: PROJECT & TASK TIMELINE (GANTT)                        */}
      {/* ============================================================= */}
      {viewMode === 'timeline' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
          {/* Timeline Table with Left Fixed Column & Right Horizontal Scroll */}
          <div className="overflow-x-auto">
            <div className="min-w-[950px]">
              {/* Timeline Header Row (Days of Month) */}
              <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50">
                {/* Left Header: Entity Labels */}
                <div className="w-72 p-3 font-bold text-xs text-slate-700 dark:text-slate-300 shrink-0 border-r border-slate-200 dark:border-slate-800">
                  Projects & Deliverables
                </div>

                {/* Right Header: Days */}
                <div className="flex-1 flex">
                  {timelineDays.map((d) => (
                    <div
                      key={d.dayNum}
                      className={`flex-1 min-w-[28px] text-center py-2 border-r border-slate-100 dark:border-slate-800/80 ${
                        d.isToday
                          ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 font-extrabold'
                          : d.isWeekend
                          ? 'bg-slate-100/60 dark:bg-slate-800/30 text-slate-400'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <div className="text-3xs uppercase font-medium">{d.dayOfWeekShort}</div>
                      <div className={`text-2xs font-bold mt-0.5 ${d.isToday ? 'text-blue-600' : ''}`}>
                        {d.dayNum}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Timeline Body Rows (Grouped by Project) */}
              {filteredProjects.length === 0 ? (
                <div className="p-12 text-center text-slate-500 dark:text-slate-400">
                  No projects match your current filters.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {filteredProjects.map((project) => {
                    const projectTasks = filteredTasks.filter((t) => t.projectId === project.id);
                    const manager = memberMap.get(project.managerId);
                    const projectPos = getTimelinePosition(project.startDate, project.targetDeadline);

                    return (
                      <div key={project.id} className="group">
                        {/* Project Header Bar Row */}
                        <div className="flex items-center hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors bg-slate-50/30 dark:bg-slate-900/40">
                          {/* Project Info Column */}
                          <div
                            onClick={() => onSelectProject(project.id)}
                            className="w-72 p-3 border-r border-slate-200 dark:border-slate-800 shrink-0 flex items-center gap-2.5 cursor-pointer"
                          >
                            <div
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0 shadow-2xs"
                              style={{ backgroundColor: project.color || '#2563eb' }}
                            >
                              <Folder className="w-3.5 h-3.5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                {project.name}
                              </h4>
                              <p className="text-3xs text-slate-500 dark:text-slate-400 truncate">
                                {project.client || 'Internal Project'} • {projectTasks.length} task(s)
                              </p>
                            </div>
                          </div>

                          {/* Project Timeline Gantt Span */}
                          <div className="flex-1 relative h-12 flex items-center px-1">
                            {/* Today vertical line marker */}
                            {isCurrentMonthView && (
                              <div
                                className="absolute top-0 bottom-0 z-10 w-0.5 bg-rose-500/60 pointer-events-none"
                                style={{
                                  left: `${
                                    ((new Date().getDate() - 0.5) / daysInMonthCount) * 100
                                  }%`,
                                }}
                              />
                            )}

                            {/* Project Span Bar */}
                            {projectPos ? (
                              <div
                                onClick={() => onSelectProject(project.id)}
                                className="absolute h-6 rounded-lg text-2xs font-semibold px-2.5 flex items-center shadow-2xs text-white truncate cursor-pointer transition-all hover:scale-[1.01] hover:brightness-110"
                                style={{
                                  left: `${projectPos.leftPercent}%`,
                                  width: `${projectPos.widthPercent}%`,
                                  backgroundColor: project.color || '#2563eb',
                                }}
                                title={`${project.name} (${project.startDate || 'Start'} to ${
                                  project.targetDeadline || 'Deadline'
                                })`}
                              >
                                <span className="truncate">{project.name}</span>
                              </div>
                            ) : (
                              <span className="text-3xs text-slate-400 italic px-2">
                                (Outside current month window)
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Nested Task Rows */}
                        {projectTasks.map((task) => {
                          const assignee = memberMap.get(task.assigneeId);
                          const taskPos = getTimelinePosition(
                            task.startDate || project.startDate,
                            task.dueDate
                          );

                          return (
                            <div
                              key={task.id}
                              className="flex items-center hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors"
                            >
                              {/* Task Info Column */}
                              <div
                                onClick={() => onOpenTaskModal(task)}
                                className="w-72 py-2 pl-9 pr-3 border-r border-slate-200 dark:border-slate-800 shrink-0 flex items-center justify-between gap-2 cursor-pointer"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${getPriorityDot(
                                      task.priority
                                    )}`}
                                  />
                                  <span className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                                    {task.title}
                                  </span>
                                </div>
                                {assignee && (
                                  <span
                                    className="text-3xs text-slate-500 font-semibold shrink-0 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded"
                                    title={`Assignee: ${assignee.name}`}
                                  >
                                    {assignee.name.split(' ')[0]}
                                  </span>
                                )}
                              </div>

                              {/* Task Gantt Bar */}
                              <div className="flex-1 relative h-9 flex items-center px-1">
                                {/* Today vertical line marker */}
                                {isCurrentMonthView && (
                                  <div
                                    className="absolute top-0 bottom-0 z-10 w-0.5 bg-rose-500/30 pointer-events-none"
                                    style={{
                                      left: `${
                                        ((new Date().getDate() - 0.5) / daysInMonthCount) * 100
                                      }%`,
                                    }}
                                  />
                                )}

                                {taskPos && (
                                  <div
                                    onClick={() => onOpenTaskModal(task)}
                                    className={`absolute h-5 rounded-md text-3xs font-medium px-2 flex items-center shadow-2xs truncate cursor-pointer transition-all hover:scale-[1.02] ${getGanttTaskColor(
                                      task.status
                                    )}`}
                                    style={{
                                      left: `${taskPos.leftPercent}%`,
                                      width: `${taskPos.widthPercent}%`,
                                    }}
                                    title={`${task.title} (${task.status} • Schedule: ${
                                      task.startDate || 'Start'
                                    } → ${task.dueDate})`}
                                  >
                                    <span className="truncate">{task.title}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
