import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  PlusCircle,
  Calendar,
  Users,
  UserCheck,
  FileSpreadsheet,
  Trash2,
  Sun,
  Moon,
  Activity,
  ArrowRight,
  CornerDownLeft,
  X,
  Layers,
  FolderPlus,
  CheckSquare,
} from 'lucide-react';
import { Project, Task, TeamMember, AuthUser, ViewType } from '../types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  tasks: Task[];
  teamMembers: TeamMember[];
  currentUser?: AuthUser | null;
  currentView: ViewType;
  activeProjectId?: string;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
  onSelectProject: (projectId: string) => void;
  onOpenTask: (task: Task) => void;
  onOpenCreateTask: (projectId?: string) => void;
  onOpenCreateProject?: () => void;
  onNavigate: (view: ViewType) => void;
  onViewMyTasks: () => void;
  onOpenTeamActivities?: () => void;
}

interface PaletteItem {
  id: string;
  category: 'Actions' | 'Projects' | 'Tasks' | 'Team';
  title: string;
  subtitle?: string;
  badge?: string;
  badgeColor?: string;
  icon: React.ReactNode;
  tags?: string[];
  onSelect: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  projects = [],
  tasks = [],
  teamMembers = [],
  currentUser,
  currentView,
  activeProjectId,
  theme = 'light',
  onToggleTheme,
  onSelectProject,
  onOpenTask,
  onOpenCreateTask,
  onOpenCreateProject,
  onNavigate,
  onViewMyTasks,
  onOpenTeamActivities,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const isAdmin = currentUser?.role === 'admin';

  // Reset query and auto-focus input when palette opens
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Build searchable items list
  const allItems = useMemo<PaletteItem[]>(() => {
    const items: PaletteItem[] = [];

    // 1. Quick Actions
    items.push({
      id: 'action-create-task',
      category: 'Actions',
      title: 'Create New Task',
      subtitle: activeProjectId
        ? `In current project: ${projects.find((p) => p.id === activeProjectId)?.name || 'Active Project'}`
        : 'Open task creation modal',
      badge: 'Action',
      badgeColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400',
      icon: <PlusCircle className="w-4 h-4 text-emerald-500" />,
      tags: ['new task', 'add task', 'todo', 'create'],
      onSelect: () => {
        onClose();
        onOpenCreateTask(activeProjectId || projects[0]?.id);
      },
    });

    if (isAdmin && onOpenCreateProject) {
      items.push({
        id: 'action-create-project',
        category: 'Actions',
        title: 'Create New Project',
        subtitle: 'Start a new project workspace (Admin)',
        badge: 'Admin',
        badgeColor: 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-400',
        icon: <FolderPlus className="w-4 h-4 text-purple-500" />,
        tags: ['new project', 'add project', 'create project'],
        onSelect: () => {
          onClose();
          onOpenCreateProject();
        },
      });
    }

    if (currentUser?.memberId) {
      const myTasksCount = tasks.filter((t) => t.assigneeId === currentUser.memberId).length;
      items.push({
        id: 'action-my-tasks',
        category: 'Actions',
        title: 'View My Tasks',
        subtitle: `Filter to tasks assigned to you (${myTasksCount} task${myTasksCount === 1 ? '' : 's'})`,
        badge: `${myTasksCount} tasks`,
        badgeColor: 'bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-400',
        icon: <UserCheck className="w-4 h-4 text-sky-500" />,
        tags: ['my tasks', 'mine', 'assigned to me', 'personal'],
        onSelect: () => {
          onClose();
          onViewMyTasks();
        },
      });
    }

    items.push({
      id: 'action-nav-dashboard',
      category: 'Actions',
      title: 'Go to Dashboard',
      subtitle: 'Overview, analytics & upcoming team deadlines',
      badge: currentView === 'dashboard' ? 'Current' : undefined,
      icon: <Layers className="w-4 h-4 text-blue-500" />,
      tags: ['dashboard', 'home', 'overview', 'summary'],
      onSelect: () => {
        onClose();
        onNavigate('dashboard');
      },
    });

    items.push({
      id: 'action-nav-calendar',
      category: 'Actions',
      title: 'Go to Calendar & Timeline',
      subtitle: 'Gantt timeline & monthly schedule view',
      badge: currentView === 'calendar' ? 'Current' : undefined,
      icon: <Calendar className="w-4 h-4 text-amber-500" />,
      tags: ['calendar', 'timeline', 'gantt', 'schedule', 'dates'],
      onSelect: () => {
        onClose();
        onNavigate('calendar');
      },
    });

    items.push({
      id: 'action-nav-team',
      category: 'Actions',
      title: 'Go to Team Management',
      subtitle: `View roster & member workloads (${teamMembers.length} members)`,
      badge: currentView === 'team' ? 'Current' : undefined,
      icon: <Users className="w-4 h-4 text-indigo-500" />,
      tags: ['team', 'members', 'roster', 'users', 'workload'],
      onSelect: () => {
        onClose();
        onNavigate('team');
      },
    });

    if (isAdmin) {
      items.push({
        id: 'action-nav-summary',
        category: 'Actions',
        title: 'Go to Project Weekly Summary',
        subtitle: 'Auto-report generation & Telegram status (Admin)',
        badge: currentView === 'summary' ? 'Current' : undefined,
        icon: <FileSpreadsheet className="w-4 h-4 text-teal-500" />,
        tags: ['weekly summary', 'report', 'telegram', 'export', 'admin report'],
        onSelect: () => {
          onClose();
          onNavigate('summary');
        },
      });
    }

    items.push({
      id: 'action-nav-recycle-bin',
      category: 'Actions',
      title: 'Go to Recycle Bin',
      subtitle: 'View, restore, or permanently purge deleted items',
      badge: currentView === 'recycle-bin' ? 'Current' : undefined,
      icon: <Trash2 className="w-4 h-4 text-rose-500" />,
      tags: ['recycle bin', 'trash', 'deleted', 'restore'],
      onSelect: () => {
        onClose();
        onNavigate('recycle-bin');
      },
    });

    if (onOpenTeamActivities) {
      items.push({
        id: 'action-team-activities',
        category: 'Actions',
        title: 'Open Team Activity Drawer',
        subtitle: 'Recent project and task change audit log',
        icon: <Activity className="w-4 h-4 text-orange-500" />,
        tags: ['activity', 'audit', 'logs', 'history', 'changes', 'timeline'],
        onSelect: () => {
          onClose();
          onOpenTeamActivities();
        },
      });
    }

    if (onToggleTheme) {
      items.push({
        id: 'action-toggle-theme',
        category: 'Actions',
        title: theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode',
        subtitle: `Currently using ${theme} theme`,
        icon: theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-500" />,
        tags: ['theme', 'dark mode', 'light mode', 'toggle theme', 'appearance'],
        onSelect: () => {
          onClose();
          onToggleTheme();
        },
      });
    }

    // 2. Projects (Switch to any project)
    projects.forEach((project) => {
      const pTasks = tasks.filter((t) => t.projectId === project.id);
      const isCurrent = currentView === 'project' && activeProjectId === project.id;
      items.push({
        id: `project-${project.id}`,
        category: 'Projects',
        title: `Switch to ${project.name}`,
        subtitle: project.client ? `Client: ${project.client} • ${pTasks.length} tasks` : `${pTasks.length} tasks`,
        badge: isCurrent ? 'Active Project' : project.status,
        badgeColor:
          project.status === 'Completed'
            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
            : project.status === 'Blocked'
            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
            : project.status === 'Draft'
            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
            : 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400',
        icon: (
          <div
            className="w-4 h-4 rounded flex items-center justify-center text-white text-3xs font-bold shrink-0"
            style={{ backgroundColor: project.color || '#2563eb' }}
          >
            {project.name.charAt(0).toUpperCase()}
          </div>
        ),
        tags: [project.name, project.client || '', project.status, 'project', 'workspace'],
        onSelect: () => {
          onClose();
          onSelectProject(project.id);
        },
      });
    });

    // 3. Tasks (Search all tasks)
    tasks.forEach((task) => {
      const proj = projects.find((p) => p.id === task.projectId);
      const assignee = teamMembers.find((m) => m.id === task.assigneeId);
      const isMine = currentUser?.memberId && task.assigneeId === currentUser.memberId;

      items.push({
        id: `task-${task.id}`,
        category: 'Tasks',
        title: task.title,
        subtitle: `${proj?.name || 'Project'} • Assigned: ${assignee?.name || 'Unassigned'} • Due: ${task.dueDate || 'No date'}`,
        badge: isMine ? `Mine • ${task.status}` : task.status,
        badgeColor:
          task.status === 'Completed'
            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
            : task.status === 'Blocked'
            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
            : task.status === 'Draft'
            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
            : 'bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-400',
        icon: (
          <CheckSquare
            className={`w-4 h-4 shrink-0 ${
              task.status === 'Completed'
                ? 'text-emerald-500'
                : task.status === 'Blocked'
                ? 'text-rose-500'
                : 'text-sky-500'
            }`}
          />
        ),
        tags: [
          task.title,
          task.description || '',
          task.status,
          task.priority,
          proj?.name || '',
          assignee?.name || '',
          isMine ? 'my task mine' : '',
        ],
        onSelect: () => {
          onClose();
          onOpenTask(task);
        },
      });
    });

    // 4. Team Members
    teamMembers.forEach((member) => {
      const memberTasks = tasks.filter((t) => t.assigneeId === member.id);
      items.push({
        id: `member-${member.id}`,
        category: 'Team',
        title: member.name,
        subtitle: `${member.role || 'Member'} • ${member.email} • ${memberTasks.length} active task${memberTasks.length === 1 ? '' : 's'}`,
        badge: member.role,
        badgeColor: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400',
        icon: (
          <div className="w-5 h-5 rounded-full overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700">
            {member.avatar ? (
              <img src={member.avatar} alt={member.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-indigo-500 text-white flex items-center justify-center text-3xs font-bold">
                {member.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        ),
        tags: [member.name, member.email, member.role, 'member', 'user', 'team'],
        onSelect: () => {
          onClose();
          onNavigate('team');
        },
      });
    });

    return items;
  }, [
    projects,
    tasks,
    teamMembers,
    currentUser,
    currentView,
    activeProjectId,
    theme,
    isAdmin,
    onClose,
    onOpenCreateTask,
    onOpenCreateProject,
    onViewMyTasks,
    onNavigate,
    onToggleTheme,
    onOpenTeamActivities,
    onSelectProject,
    onOpenTask,
  ]);

  // Filter items based on user search query
  const filteredItems = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();
    if (!cleanQuery) {
      return allItems;
    }

    const queryWords = cleanQuery.split(/\s+/).filter(Boolean);

    return allItems.filter((item) => {
      const targetText = [
        item.title,
        item.subtitle || '',
        item.category,
        item.badge || '',
        ...(item.tags || []),
      ]
        .join(' ')
        .toLowerCase();

      return queryWords.every((word) => targetText.includes(word));
    });
  }, [allItems, query]);

  // Reset selection index when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Handle keyboard navigation inside the palette
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (filteredItems.length > 0 ? (prev + 1) % filteredItems.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          filteredItems.length > 0 ? (prev - 1 + filteredItems.length) % filteredItems.length : 0
        );
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          filteredItems[selectedIndex].onSelect();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredItems, selectedIndex, onClose]);

  // Auto-scroll the active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const activeEl = listRef.current.querySelector<HTMLElement>(`[data-index="${selectedIndex}"]`);
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  // Group filtered items by category
  const categories: Array<'Actions' | 'Projects' | 'Tasks' | 'Team'> = ['Actions', 'Projects', 'Tasks', 'Team'];
  let runningIndex = 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] sm:pt-[12vh] p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[80vh] sm:max-h-[75vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Header */}
        <div className="px-4 sm:px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3 bg-slate-50/70 dark:bg-slate-800/50">
          <div className="w-8 h-8 rounded-lg bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 flex items-center justify-center text-sky-600 dark:text-sky-400 shrink-0">
            <Search className="w-4 h-4" />
          </div>

          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search projects, tasks, team... (↑↓ to navigate)"
            className="flex-1 bg-transparent border-0 text-sm sm:text-base font-medium text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-0"
          />

          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              title="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-3xs font-mono font-bold text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md shadow-2xs">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div ref={listRef} className="flex-1 overflow-y-auto p-2 sm:p-3 space-y-4">
          {filteredItems.length === 0 ? (
            <div className="py-12 px-4 text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500">
                <Search className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                No matching results for &ldquo;{query}&rdquo;
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-sm mx-auto">
                Try searching for a project like <span className="text-sky-600 dark:text-sky-400 font-medium">&ldquo;Merchant&rdquo;</span>, an action like <span className="text-sky-600 dark:text-sky-400 font-medium">&ldquo;New Task&rdquo;</span>, or a team member.
              </p>
            </div>
          ) : (
            categories.map((category) => {
              const categoryItems = filteredItems.filter((i) => i.category === category);
              if (categoryItems.length === 0) return null;

              return (
                <div key={category} className="space-y-1">
                  <div className="px-3 py-1 text-3xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center justify-between">
                    <span>{category}</span>
                    <span className="text-2xs opacity-70 font-normal">{categoryItems.length}</span>
                  </div>

                  <div className="space-y-0.5">
                    {categoryItems.map((item) => {
                      const itemIndex = runningIndex++;
                      const isSelected = itemIndex === selectedIndex;

                      return (
                        <div
                          key={item.id}
                          data-index={itemIndex}
                          onClick={() => item.onSelect()}
                          onMouseEnter={() => setSelectedIndex(itemIndex)}
                          className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-sky-50 dark:bg-sky-950/50 text-sky-950 dark:text-sky-100 border-l-3 border-sky-500 pl-2.5'
                              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="shrink-0">{item.icon}</div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs sm:text-sm font-semibold truncate text-slate-900 dark:text-white">
                                  {item.title}
                                </span>
                                {item.badge && (
                                  <span
                                    className={`px-1.5 py-0.2 rounded-md text-3xs font-bold shrink-0 ${
                                      item.badgeColor ||
                                      'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                    }`}
                                  >
                                    {item.badge}
                                  </span>
                                )}
                              </div>
                              {item.subtitle && (
                                <p className="text-2xs text-slate-400 dark:text-slate-500 truncate mt-0.5">
                                  {item.subtitle}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {isSelected ? (
                              <span className="inline-flex items-center gap-1 text-3xs font-semibold text-sky-600 dark:text-sky-400 bg-sky-100/70 dark:bg-sky-900/60 px-1.5 py-0.5 rounded">
                                <span>Select</span>
                                <CornerDownLeft className="w-3 h-3" />
                              </span>
                            ) : (
                              <ArrowRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer with Shortcut Helpers */}
        <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60 flex items-center justify-between text-3xs text-slate-400 dark:text-slate-500">
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded font-mono font-bold shadow-2xs">
                ↑
              </kbd>
              <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded font-mono font-bold shadow-2xs">
                ↓
              </kbd>
              <span className="ml-0.5">Navigate</span>
            </span>

            <span className="inline-flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded font-mono font-bold shadow-2xs">
                ↵
              </kbd>
              <span className="ml-0.5">Execute</span>
            </span>

            <span className="hidden sm:inline-flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded font-mono font-bold shadow-2xs">
                esc
              </kbd>
              <span className="ml-0.5">Close</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-500 dark:text-slate-400">
              {filteredItems.length} {filteredItems.length === 1 ? 'result' : 'results'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

