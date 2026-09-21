import React from 'react';
import { Smartphone, Monitor } from 'lucide-react';
import { StatusType, PriorityType, ProjectScopeType } from '../types';

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
  const base = `inline-flex items-center font-semibold border shadow-2xs transition-colors whitespace-nowrap select-none ${sizeCls}`;

  switch (status) {
    case 'Draft':
      return `${base} bg-slate-100 dark:bg-slate-500/10 text-slate-700 dark:text-slate-300/90 border-slate-300/80 dark:border-slate-500/25`;
    case 'In Progress':
      return `${base} bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300/90 border-blue-200 dark:border-blue-500/25`;
    case 'Ready Review':
    case 'Pending':
      return `${base} bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300/90 border-amber-200 dark:border-amber-500/25`;
    case 'Blocked':
      return `${base} bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300/90 border-rose-200 dark:border-rose-500/25`;
    case 'Completed':
      return `${base} bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300/90 border-emerald-200 dark:border-emerald-500/25`;
    default:
      return `${base} bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300/90 border-slate-200 dark:border-slate-700/50`;
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
      return `${base} bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300/90 border-rose-200 dark:border-rose-500/25`;
    case 'High':
      return `${base} bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-300/90 border-orange-200 dark:border-orange-500/25`;
    case 'Medium':
      return `${base} bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300/90 border-amber-200 dark:border-amber-500/25`;
    case 'Low':
      return `${base} bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700/50`;
    default:
      return `${base} bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700/50`;
  }
};

export interface StatusBadgeProps {
  status: StatusType | string;
  size?: 'xs' | 'sm' | 'md';
  prefix?: string;
  className?: string;
  stageColor?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'sm',
  prefix,
  className = '',
  stageColor,
}) => {
  const sizeMap: Record<string, string> = {
    xs: 'text-xs px-1.5 py-0.5 rounded-md',
    sm: 'text-xs px-2 py-0.5 rounded-md',
    md: 'text-xs px-2.5 py-1 rounded-lg',
  };
  const sizeCls = sizeMap[size] || sizeMap.sm;

  if (stageColor) {
    return (
      <span
        style={{
          backgroundColor: `${stageColor}18`,
          color: stageColor,
          borderColor: `${stageColor}40`,
        }}
        className={`inline-flex items-center font-semibold border shadow-2xs transition-colors whitespace-nowrap select-none ${sizeCls} ${className} shrink-0`}
      >
        {prefix && <span className="opacity-80 font-normal mr-1">{prefix}</span>}
        <span className="whitespace-nowrap">{status}</span>
      </span>
    );
  }

  return (
    <span className={`${getStatusBadgeClass(status, size)} ${className} whitespace-nowrap shrink-0`}>
      {prefix && <span className="opacity-80 font-normal mr-1">{prefix}</span>}
      <span className="whitespace-nowrap">{status}</span>
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

export interface ScopeBadgeProps {
  scope: ProjectScopeType | string;
  size?: 'xs' | 'sm' | 'md';
  showIcon?: boolean;
  className?: string;
}

export const ScopeBadge: React.FC<ScopeBadgeProps> = ({
  scope,
  size = 'xs',
  showIcon = true,
  className = '',
}) => {
  const isMobile = scope.toLowerCase().includes('mobile');
  const sizeCls = size === 'xs' ? 'text-3xs px-1.5 py-0.5 rounded-md gap-1' : 'text-xs px-2 py-0.5 rounded-md gap-1.5';
  const iconCls = size === 'xs' ? 'w-2.5 h-2.5 shrink-0' : 'w-3 h-3 shrink-0';

  if (isMobile) {
    return (
      <span
        title="Mobile App UI Deliverable"
        className={`inline-flex items-center font-semibold border shadow-2xs whitespace-nowrap select-none bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/80 ${sizeCls} ${className}`}
      >
        {showIcon && <Smartphone className={iconCls} />}
        <span>{scope}</span>
      </span>
    );
  }

  return (
    <span
      title="Web UI Deliverable"
      className={`inline-flex items-center font-semibold border shadow-2xs whitespace-nowrap select-none bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800/80 ${sizeCls} ${className}`}
    >
      {showIcon && <Monitor className={iconCls} />}
      <span>{scope}</span>
    </span>
  );
};
