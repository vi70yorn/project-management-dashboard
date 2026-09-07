import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { StatusType } from '../../types';

export interface StatusDropdownProps {
  status: StatusType | string;
  onChange: (status: StatusType) => void;
  size?: 'xs' | 'sm' | 'md';
  fullWidth?: boolean;
  disabled?: boolean;
  align?: 'left' | 'right';
  className?: string;
  id?: string;
}

interface StatusConfig {
  label: StatusType;
  dotColor: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  hoverBg: string;
}

const STATUS_CONFIGS: Record<StatusType, StatusConfig> = {
  'In Progress': {
    label: 'In Progress',
    dotColor: 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]',
    badgeBg: 'bg-blue-50 dark:bg-blue-950/60',
    badgeText: 'text-blue-700 dark:text-blue-300',
    badgeBorder: 'border-blue-200/90 dark:border-blue-800/80',
    hoverBg: 'hover:bg-blue-50 dark:hover:bg-blue-950/50',
  },
  'Ready Review': {
    label: 'Ready Review',
    dotColor: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]',
    badgeBg: 'bg-amber-50 dark:bg-amber-950/60',
    badgeText: 'text-amber-700 dark:text-amber-300',
    badgeBorder: 'border-amber-200/90 dark:border-amber-800/80',
    hoverBg: 'hover:bg-amber-50 dark:hover:bg-amber-950/50',
  },
  'Blocked': {
    label: 'Blocked',
    dotColor: 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]',
    badgeBg: 'bg-rose-50 dark:bg-rose-950/60',
    badgeText: 'text-rose-700 dark:text-rose-300',
    badgeBorder: 'border-rose-200/90 dark:border-rose-800/80',
    hoverBg: 'hover:bg-rose-50 dark:hover:bg-rose-950/50',
  },
  'Completed': {
    label: 'Completed',
    dotColor: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]',
    badgeBg: 'bg-emerald-50 dark:bg-emerald-950/60',
    badgeText: 'text-emerald-700 dark:text-emerald-300',
    badgeBorder: 'border-emerald-200/90 dark:border-emerald-800/80',
    hoverBg: 'hover:bg-emerald-50 dark:hover:bg-emerald-950/50',
  },
};

const ALL_STATUSES: StatusType[] = ['In Progress', 'Ready Review', 'Blocked', 'Completed'];

export const StatusDropdown: React.FC<StatusDropdownProps> = ({
  status,
  onChange,
  size = 'sm',
  fullWidth = false,
  disabled = false,
  align = 'left',
  className = '',
  id,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fallback for legacy 'Pending' or undefined
  const currentKey: StatusType = status === 'Pending' ? 'Ready Review' : (status as StatusType) || 'In Progress';
  const currentConfig = STATUS_CONFIGS[currentKey] || STATUS_CONFIGS['In Progress'];

  // Handle outside click & escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Determine whether to open upward if close to bottom of viewport
  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;

    if (!isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      // If less than 200px below, open upward
      setOpenUpward(spaceBelow < 200 && rect.top > 200);
    }

    setIsOpen((prev) => !prev);
  };

  const handleSelect = (selectedStatus: StatusType, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selectedStatus);
    setIsOpen(false);
  };

  // Size styling
  const sizeClasses = {
    xs: 'text-3xs py-0.5 px-2 gap-1 rounded-md',
    sm: 'text-2xs py-1 px-2.5 gap-1.5 rounded-lg',
    md: 'text-xs py-2 px-3 gap-2 rounded-lg',
  };

  const dotSizes = {
    xs: 'w-1.5 h-1.5',
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
  };

  const chevronSizes = {
    xs: 'w-2.5 h-2.5',
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
  };

  return (
    <div
      ref={containerRef}
      id={id}
      className={`relative inline-block ${fullWidth ? 'w-full' : ''} ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Trigger Button */}
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        className={`inline-flex items-center justify-between font-semibold border transition-all cursor-pointer shadow-2xs select-none ${
          sizeClasses[size]
        } ${currentConfig.badgeBg} ${currentConfig.badgeText} ${currentConfig.badgeBorder} ${
          fullWidth ? 'w-full' : ''
        } ${
          isOpen ? 'ring-2 ring-blue-500/20 border-blue-400 dark:border-blue-500' : 'hover:opacity-90'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <div className="inline-flex items-center gap-1.5 min-w-0">
          <span
            className={`rounded-full shrink-0 ${dotSizes[size]} ${currentConfig.dotColor}`}
          />
          <span className="truncate">{currentConfig.label}</span>
        </div>

        <ChevronDown
          className={`shrink-0 transition-transform duration-200 text-current opacity-70 ml-1.5 ${
            chevronSizes[size]
          } ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Modern Popover Menu */}
      {isOpen && (
        <div
          className={`absolute z-50 min-w-[160px] p-1.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-xl border border-slate-200/90 dark:border-slate-700/80 shadow-xl shadow-slate-900/10 dark:shadow-black/50 animate-in fade-in zoom-in-95 duration-150 ${
            align === 'right' ? 'right-0' : 'left-0'
          } ${openUpward ? 'bottom-full mb-1.5' : 'top-full mt-1.5'}`}
        >
          <div className="space-y-0.5">
            {ALL_STATUSES.map((st) => {
              const cfg = STATUS_CONFIGS[st];
              const isSelected = currentKey === st;

              return (
                <button
                  key={st}
                  type="button"
                  onClick={(e) => handleSelect(st, e)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer text-left ${
                    isSelected
                      ? `${cfg.badgeBg} ${cfg.badgeText} font-bold`
                      : `text-slate-700 dark:text-slate-200 ${cfg.hoverBg}`
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${cfg.dotColor}`}
                    />
                    <span className="truncate">{cfg.label}</span>
                  </div>

                  {isSelected && (
                    <Check className="w-3.5 h-3.5 shrink-0 ml-2" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

