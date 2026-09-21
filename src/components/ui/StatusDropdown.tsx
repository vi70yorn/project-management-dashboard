import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Lock } from 'lucide-react';
import { StatusType, ProjectStage, DEFAULT_PROJECT_STAGES } from '../../types';

export interface StatusDropdownProps {
  status: StatusType | string;
  onChange: (status: StatusType) => void;
  size?: 'xs' | 'sm' | 'md';
  fullWidth?: boolean;
  disabled?: boolean;
  align?: 'left' | 'right';
  className?: string;
  id?: string;
  excludeStatuses?: (StatusType | string)[];
  stages?: ProjectStage[];
  role?: string;
}

interface StatusConfig {
  label: string;
  dotColor: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  hoverBg: string;
}

const DEFAULT_STATUS_CONFIGS: Record<string, StatusConfig> = {
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
  stages,
  role,
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

  const effectiveStages = stages && stages.length > 0 ? stages : DEFAULT_PROJECT_STAGES;

  // Fallback for legacy 'Pending' or undefined
  const normalizedStatus = status === 'Pending' ? 'Ready Review' : status || 'In Progress';
  const matchedStage = effectiveStages.find(
    (s) => s.name.trim().toLowerCase() === normalizedStatus.trim().toLowerCase()
  );

  const displayLabel = matchedStage ? matchedStage.name : normalizedStatus;
  const isCustomStage = !DEFAULT_STATUS_CONFIGS[displayLabel];
  const currentConfig = DEFAULT_STATUS_CONFIGS[displayLabel] || DEFAULT_STATUS_CONFIGS['In Progress'];
  const stageColor = matchedStage?.color;

  const isStaff = (role || '').toLowerCase() === 'staff';
  const isCurrentDone = matchedStage
    ? matchedStage.category === 'done'
    : displayLabel.toLowerCase() === 'completed';

  // If current task is already in a done stage and user is staff, lock status changes
  const isLockedForStaff = isStaff && isCurrentDone;
  const effectiveDisabled = disabled || isLockedForStaff;

  // Filter available options for the dropdown
  const availableStages = effectiveStages.filter((stage) => {
    // Staff cannot select done stages
    if (isStaff && stage.category === 'done') return false;
    // Check excludeStatuses
    if (excludeStatuses && (excludeStatuses.includes(stage.name) || excludeStatuses.includes(stage.id))) {
      return false;
    }
    return true;
  });

  // Recalculate fixed position based on container bounding client rect
  const updatePosition = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();

    if (rect.bottom < 0 || rect.top > window.innerHeight) {
      setIsOpen(false);
      return;
    }

    const estimatedHeight = Math.min(220, availableStages.length * 40 + 20);
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    const openUpward = spaceBelow < estimatedHeight && spaceAbove > spaceBelow;

    let top: number | undefined;
    let bottom: number | undefined;

    if (openUpward) {
      bottom = window.innerHeight - rect.top + 4;
    } else {
      top = rect.bottom + 4;
    }

    const menuWidth = fullWidth ? rect.width : Math.max(170, rect.width);
    let left = align === 'right' ? rect.right - menuWidth : rect.left;

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
  }, [align, fullWidth, availableStages.length]);

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
    if (effectiveDisabled) return;

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

  // Style attributes for trigger button when using custom colors
  const triggerCustomStyle = isCustomStage && stageColor ? {
    backgroundColor: `${stageColor}15`,
    color: stageColor,
    borderColor: `${stageColor}40`,
  } : undefined;

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
        disabled={effectiveDisabled}
        title={isLockedForStaff ? 'Completed / Done tasks can only be changed by Administrators.' : undefined}
        style={triggerCustomStyle}
        className={`inline-flex items-center justify-between font-semibold border transition-all cursor-pointer shadow-2xs select-none whitespace-nowrap ${
          sizeClasses[size]
        } ${
          !isCustomStage
            ? `${currentConfig.badgeBg} ${currentConfig.badgeText} ${currentConfig.badgeBorder}`
            : ''
        } ${fullWidth ? 'w-full' : ''} ${
          isOpen ? 'ring-2 ring-blue-500/20 border-blue-400 dark:border-blue-500' : 'hover:opacity-90'
        } ${effectiveDisabled ? 'opacity-70 cursor-not-allowed' : ''}`}
      >
        <div className="inline-flex items-center gap-1.5 min-w-0">
          <span
            style={stageColor ? { backgroundColor: stageColor } : undefined}
            className={`rounded-full shrink-0 ${dotSizes[size]} ${!stageColor ? currentConfig.dotColor : ''}`}
          />
          <span className="truncate whitespace-nowrap">{displayLabel}</span>
        </div>

        {isLockedForStaff ? (
          <Lock className={`shrink-0 opacity-60 ml-1.5 ${chevronSizes[size]}`} />
        ) : (
          <ChevronDown
            className={`shrink-0 transition-transform duration-200 text-current opacity-70 ml-1.5 ${
              chevronSizes[size]
            } ${isOpen ? 'rotate-180' : ''}`}
          />
        )}
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
            className="min-w-[170px] max-h-[280px] overflow-y-auto custom-scrollbar p-1.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-xl border border-slate-200/90 dark:border-slate-700/80 shadow-2xl shadow-slate-900/20 dark:shadow-black/70 animate-in fade-in zoom-in-95 duration-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-0.5">
              {availableStages.map((st) => {
                const isSelected = displayLabel.trim().toLowerCase() === st.name.trim().toLowerCase();
                const defaultCfg = DEFAULT_STATUS_CONFIGS[st.name];

                return (
                  <button
                    key={st.id || st.name}
                    type="button"
                    onClick={(e) => handleSelect(st.name, e)}
                    style={
                      isSelected
                        ? {
                            backgroundColor: `${st.color}15`,
                            color: st.color,
                          }
                        : undefined
                    }
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer text-left ${
                      isSelected
                        ? 'font-bold'
                        : defaultCfg
                        ? `text-slate-700 dark:text-slate-200 ${defaultCfg.hoverBg}`
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        style={{ backgroundColor: st.color }}
                        className="w-2 h-2 rounded-full shrink-0 shadow-xs"
                      />
                      <span className="truncate">{st.name}</span>
                      {st.category === 'done' && (
                        <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.2 bg-emerald-100/70 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 rounded text-3xs shrink-0">
                          Done
                        </span>
                      )}
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
