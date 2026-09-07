import React from 'react';
import { StatusType, PriorityType } from '../types';

/**
 * Returns consistent filter-style classes for project and task statuses.
 * Sleek rounded rectangular border, subtle shadow, and proportional padding.
 */
export const getStatusBadgeClass = (
  status: StatusType | string,
  size: 'xs' | 'sm' | 'md' | string = 'sm'
): string => {
  const sizeMap: Record<string, string> = {
    xs: 'text-xs px-1.5 py-0.5 rounded-md',
    sm: 'text-xs px-2 py-0.5 rounded-md',
    md: 'text-xs px-2.5 py-1 rounded-lg',
  };

  const sizeCls = sizeMap[size] || sizeMap.sm;
  const base = `inline-flex items-center font-semibold border shadow-2xs transition-colors ${sizeCls}`;

  switch (status) {
    case 'In Progress':
      return `${base} bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800`;
    case 'Ready Review':
    case 'Pending':
      return `${base} bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800`;
    case 'Blocked':
      return `${base} bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800`;
    case 'Completed':
      return `${base} bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800`;
    default:
      return `${base} bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700`;
  }
};

/**
 * Returns consistent filter-style classes for task priorities.
 * Smaller and matching the filter style with rounded-md and crisp borders.
 */
export const getPriorityBadgeClass = (
  priority: PriorityType | string,
  size: 'xs' | 'sm' | 'md' | string = 'sm'
): string => {
  const sizeMap: Record<string, string> = {
    xs: 'text-xs px-1.5 py-0.5 rounded-md',
    sm: 'text-xs px-2 py-0.5 rounded-md',
    md: 'text-xs px-2.5 py-1 rounded-lg',
  };

  const sizeCls = sizeMap[size] || sizeMap.sm;
  const base = `inline-flex items-center font-semibold border shadow-2xs transition-colors ${sizeCls}`;

  switch (priority) {
    case 'Urgent':
      return `${base} bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800`;
    case 'High':
      return `${base} bg-orange-50 dark:bg-orange-950/50 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800`;
    case 'Medium':
      return `${base} bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800`;
    case 'Low':
      return `${base} bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700`;
    default:
      return `${base} bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700`;
  }
};

export interface StatusBadgeProps {
  status: StatusType | string;
  size?: 'xs' | 'sm' | 'md';
  prefix?: string;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'sm',
  prefix,
  className = '',
}) => {
  return (
    <span className={`${getStatusBadgeClass(status, size)} ${className}`}>
      {prefix && <span className="opacity-80 font-normal mr-1">{prefix}</span>}
      {status}
    </span>
  );
};

export interface PriorityBadgeProps {
  priority: PriorityType | string;
  size?: 'xs' | 'sm' | 'md';
  prefix?: string;
  className?: string;
}

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({
  priority,
  size = 'sm',
  prefix,
  className = '',
}) => {
  return (
    <span className={`${getPriorityBadgeClass(priority, size)} ${className}`}>
      {prefix && <span className="opacity-80 font-normal mr-1">{prefix}</span>}
      {priority}
    </span>
  );
};
