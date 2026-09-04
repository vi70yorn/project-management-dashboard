/**
 * Utility functions for date manipulation and due date status checking.
 */

export function getTodayString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isDueToday(dateStr?: string): boolean {
  if (!dateStr) return false;
  return dateStr.slice(0, 10) === getTodayString();
}

export function isOverdue(dateStr?: string): boolean {
  if (!dateStr) return false;
  return dateStr.slice(0, 10) < getTodayString();
}

export interface DueDateStatus {
  isToday: boolean;
  isOverdue: boolean;
  diffDays: number;
  label: string;
  badgeClass: string;
}

export function getDueDateStatus(dateStr?: string): DueDateStatus {
  if (!dateStr) {
    return {
      isToday: false,
      isOverdue: false,
      diffDays: 0,
      label: 'No deadline',
      badgeClass: 'bg-slate-50 text-slate-600 border-slate-200',
    };
  }

  const cleanDate = dateStr.slice(0, 10);
  const todayStr = getTodayString();
  const isToday = cleanDate === todayStr;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const target = new Date(cleanDate + 'T00:00:00');
  const diffTime = target.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  const isOverdueFlag = diffDays < 0;

  if (isToday) {
    return {
      isToday: true,
      isOverdue: false,
      diffDays: 0,
      label: 'Due Today',
      badgeClass:
        'bg-rose-50 text-rose-700 border-rose-300 font-bold ring-1 ring-rose-300/80 shadow-2xs animate-pulse',
    };
  }

  if (isOverdueFlag) {
    return {
      isToday: false,
      isOverdue: true,
      diffDays,
      label: `Overdue (${Math.abs(diffDays)}d)`,
      badgeClass: 'bg-rose-100 text-rose-800 border-rose-300 font-semibold',
    };
  }

  if (diffDays === 1) {
    return {
      isToday: false,
      isOverdue: false,
      diffDays,
      label: 'Due Tomorrow',
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 font-medium',
    };
  }

  if (diffDays <= 3) {
    return {
      isToday: false,
      isOverdue: false,
      diffDays,
      label: `Due in ${diffDays}d`,
      badgeClass: 'bg-amber-50/70 text-amber-700 border-amber-200 font-medium',
    };
  }

  return {
    isToday: false,
    isOverdue: false,
    diffDays,
    label: cleanDate,
    badgeClass: 'bg-slate-50 text-slate-700 border-slate-200 font-medium',
  };
}
