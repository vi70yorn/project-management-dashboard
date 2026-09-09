import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Loader2 } from 'lucide-react';
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
  excludeStatuses?: StatusType[];
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
  'Draft': {
    label: 'Draft',
    dotColor: 'bg-slate-400 dark:bg-slate-500',
    badgeBg: 'bg-slate-100 dark:bg-slate-500/10',
    badgeText: 'text-slate-700 dark:text-slate-300/90',
    badgeBorder: 'border-slate-300/80 dark:border-slate-500/25',
    hoverBg: 'hover:bg-slate-100 dark:hover:bg-slate-500/15',
  },
  'In Progress': {
    label: 'In Progress',
    dotColor: 'bg-blue-500 dark:bg-blue-400',
    badgeBg: 'bg-blue-50 dark:bg-blue-500/10',
    badgeText: 'text-blue-700 dark:text-blue-300/90',
    badgeBorder: 'border-blue-200/90 dark:border-blue-500/25',
    hoverBg: 'hover:bg-blue-50 dark:hover:bg-blue-500/15',
  },
  'Ready Review': {
    label: 'Ready Review',
    dotColor: 'bg-amber-500 dark:bg-amber-400',
    badgeBg: 'bg-amber-50 dark:bg-amber-500/10',
    badgeText: 'text-amber-700 dark:text-amber-300/90',
    badgeBorder: 'border-amber-200/90 dark:border-amber-500/25',
    hoverBg: 'hover:bg-amber-50 dark:hover:bg-amber-500/15',
  },
  'Blocked': {
    label: 'Blocked',
    dotColor: 'bg-rose-500 dark:bg-rose-400',
    badgeBg: 'bg-rose-50 dark:bg-rose-500/10',
    badgeText: 'text-rose-700 dark:text-rose-300/90',
    badgeBorder: 'border-rose-200/90 dark:border-rose-500/25',
    hoverBg: 'hover:bg-rose-50 dark:hover:bg-rose-500/15',
  },
  'Completed': {
    label: 'Completed',
    dotColor: 'bg-emerald-500 dark:bg-emerald-400',
    badgeBg: 'bg-emerald-50 dark:bg-emerald-500/10',
    badgeText: 'text-emerald-700 dark:text-emerald-300/90',
    badgeBorder: 'border-emerald-200/90 dark:border-emerald-500/25',
    hoverBg: 'hover:bg-emerald-50 dark:hover:bg-emerald-500/15',
  },
};

const ALL_STATUSES: StatusType[] = ['Draft', 'In Progress', 'Ready Review', 'Blocked', 'Completed'];

export const StatusDropdown: React.FC<StatusDropdownProps> = ({
  status,
  onChange,
  size = 'sm',
  fullWidth = false,
  disabled = false,
  align = 'left',
  className = '',
  id,
  excludeStatuses,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuCoords, setMenuCoords] = useState<{
    top?: number;
    bottom?: number;
    left?: number;
    width?: number;
  }>({});

  // Fallback for legacy 'Pending' or undefined
  const currentKey: StatusType = status === 'Pending' ? 'Ready Review' : (status as StatusType) || 'In Progress';
  const currentConfig = STATUS_CONFIGS[currentKey] || STATUS_CONFIGS['In Progress'];

  // Recalculate fixed position based on container bounding client rect
  const updatePosition = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();

    // If container scrolled completely off-screen, close menu
    if (rect.bottom < 0 || rect.top > window.innerHeight) {
      setIsOpen(false);
      return;
    }

    const estimatedHeight = 165; // Height of 4 items + padding
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    // Only open upward if space below is too cramped AND space above has more room
    const openUpward = spaceBelow < estimatedHeight && spaceAbove > spaceBelow;

    let top: number | undefined;
    let bottom: number | undefined;

    if (openUpward) {
      bottom = window.innerHeight - rect.top + 4;
    } else {
      top = rect.bottom + 4;
    }

    const menuWidth = fullWidth ? rect.width : Math.max(160, rect.width);
    let left = align === 'right' ? rect.right - menuWidth : rect.left;

    // Boundary clamping to ensure it stays fully inside the viewport
    if (left + menuWidth > window.innerWidth - 8) {
      left = window.innerWidth - menuWidth - 8;
    }
    if (left < 8) {
      left = 8;
    }

    setMenuCoords({
      top,
      bottom,
      left,
      width: fullWidth ? rect.width : undefined,
    });
  }, [align, fullWidth]);

  // Position tracking on scroll and resize
  useEffect(() => {
    if (!isOpen) return;
    updatePosition();

    const handleScrollOrResize = () => {
      updatePosition();
    };

    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen, updatePosition]);

  // Handle outside click & escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
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

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;

    if (!isOpen) {
      updatePosition();
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
        className={`inline-flex items-center justify-between font-semibold border transition-all cursor-pointer shadow-2xs select-none whitespace-nowrap ${
          sizeClasses[size]
        } ${currentConfig.badgeBg} ${currentConfig.badgeText} ${currentConfig.badgeBorder} ${
          fullWidth ? 'w-full' : ''
        } ${
          isOpen ? 'ring-2 ring-blue-500/20 border-blue-400 dark:border-blue-500' : 'hover:opacity-90'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <div className="inline-flex items-center gap-1.5 min-w-0">
          {currentKey === 'In Progress' ? (
            <span className={`relative flex items-center justify-center shrink-0 ${size === 'xs' ? 'w-2 h-2' : 'w-2.5 h-2.5'}`}>
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400/70 dark:bg-blue-300/60" />
              <Loader2 className={`relative text-blue-600 dark:text-blue-400 animate-spin shrink-0 ${size === 'xs' ? 'w-2 h-2' : 'w-2.5 h-2.5'}`} />
            </span>
          ) : (
            <span
              className={`rounded-full shrink-0 ${dotSizes[size]} ${currentConfig.dotColor}`}
            />
          )}
          <span className="truncate whitespace-nowrap">{currentConfig.label}</span>
        </div>

        <ChevronDown
          className={`shrink-0 transition-transform duration-200 text-current opacity-70 ml-1.5 ${
            chevronSizes[size]
          } ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Modern Popover Menu rendered via Portal to escape all overflow and stacking contexts */}
      {isOpen &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: 'fixed',
              top: menuCoords.top !== undefined ? `${menuCoords.top}px` : undefined,
              bottom: menuCoords.bottom !== undefined ? `${menuCoords.bottom}px` : undefined,
              left: menuCoords.left !== undefined ? `${menuCoords.left}px` : undefined,
              width: menuCoords.width !== undefined ? `${menuCoords.width}px` : undefined,
              zIndex: 99999,
            }}
            className="min-w-[160px] p-1.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-xl border border-slate-200/90 dark:border-slate-700/80 shadow-2xl shadow-slate-900/20 dark:shadow-black/70 animate-in fade-in zoom-in-95 duration-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-0.5">
              {(excludeStatuses && excludeStatuses.length > 0
                ? ALL_STATUSES.filter((st) => !excludeStatuses.includes(st))
                : ALL_STATUSES
              ).map((st) => {
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
                      {st === 'In Progress' ? (
                        <span className="relative flex items-center justify-center shrink-0 w-2.5 h-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400/70 dark:bg-blue-300/60" />
                          <Loader2 className="relative w-2.5 h-2.5 text-blue-600 dark:text-blue-400 animate-spin shrink-0" />
                        </span>
                      ) : (
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${cfg.dotColor}`}
                        />
                      )}
                      <span className="truncate">{cfg.label}</span>
                    </div>

                    {isSelected && (
                      <Check className="w-3.5 h-3.5 shrink-0 ml-2" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

