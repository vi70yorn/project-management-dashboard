import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import { FORM_STYLES } from '../../utils/formStyles';

export interface DatePickerProps {
  id?: string;
  value?: string; // Format: 'YYYY-MM-DD'
  onChange: (dateStr: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  isDueToday?: boolean;
  min?: string;
  max?: string;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const DAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

// Pad with leading zero
const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);

// Format Date object to YYYY-MM-DD
const formatDateToISO = (d: Date): string => {
  const year = d.getFullYear();
  const month = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${year}-${month}-${day}`;
};

// Parse 'YYYY-MM-DD' into local Date (avoiding UTC timezone shifting)
const parseISODate = (str?: string): Date | null => {
  if (!str || typeof str !== 'string') return null;
  const parts = str.trim().split('-');
  if (parts.length !== 3) return null;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
  return new Date(y, m, d);
};

// Display label: e.g. "Oct 6, 2026" or "2026-10-06"
const formatDisplayDate = (str?: string): string => {
  const parsed = parseISODate(str);
  if (!parsed) return '';
  const monthShort = MONTH_NAMES[parsed.getMonth()].slice(0, 3);
  return `${monthShort} ${parsed.getDate()}, ${parsed.getFullYear()}`;
};

export const DatePicker: React.FC<DatePickerProps> = ({
  id,
  value,
  onChange,
  placeholder = 'Select date...',
  required = false,
  disabled = false,
  className = '',
  isDueToday = false,
  min,
  max,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Active view month & year (defaults to selected value or current month/year)
  const initialDate = parseISODate(value) || new Date();
  const [viewYear, setViewYear] = useState<number>(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(initialDate.getMonth());

  // Mode: 'calendar' | 'year-select'
  const [viewMode, setViewMode] = useState<'calendar' | 'year-select'>('calendar');

  // When opening, reset view to selected date or today
  useEffect(() => {
    if (isOpen) {
      const d = parseISODate(value) || new Date();
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
      setViewMode('calendar');
    }
  }, [isOpen, value]);

  // Position coordinates for portal menu
  const [menuCoords, setMenuCoords] = useState<{
    top?: number;
    bottom?: number;
    left?: number;
  }>({});

  const updatePosition = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();

    if (rect.bottom < 0 || rect.top > window.innerHeight) {
      setIsOpen(false);
      return;
    }

    const estimatedHeight = 330;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openUpward = spaceBelow < estimatedHeight && spaceAbove > spaceBelow;

    let top: number | undefined;
    let bottom: number | undefined;

    if (openUpward) {
      bottom = window.innerHeight - rect.top + 6;
    } else {
      top = rect.bottom + 6;
    }

    const menuWidth = 280;
    let left = rect.left;

    // Viewport clamp
    if (left + menuWidth > window.innerWidth - 12) {
      left = window.innerWidth - menuWidth - 12;
    }
    if (left < 12) {
      left = 12;
    }

    setMenuCoords({ top, bottom, left });
  }, []);

  // Track position on scroll/resize
  useEffect(() => {
    if (!isOpen) return;
    updatePosition();

    const handleScrollOrResize = () => updatePosition();
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen, updatePosition]);

  // Handle outside click & Escape
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

  // Navigation handlers
  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleSelectDay = (day: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const selected = new Date(viewYear, viewMonth, day);
    const iso = formatDateToISO(selected);
    onChange(iso);
    setIsOpen(false);
  };

  const handleSelectToday = (e: React.MouseEvent) => {
    e.stopPropagation();
    const today = new Date();
    const iso = formatDateToISO(today);
    onChange(iso);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setIsOpen(false);
  };

  // Build days grid for the current viewMonth & viewYear
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay(); // 0 = Sunday
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const cells: Array<{
      day: number;
      isCurrentMonth: boolean;
      iso: string;
      isToday: boolean;
      isSelected: boolean;
      isDisabled: boolean;
    }> = [];

    const todayISO = formatDateToISO(new Date());

    // Previous month padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const prevMonthDate = new Date(viewYear, viewMonth - 1, d);
      const iso = formatDateToISO(prevMonthDate);
      cells.push({
        day: d,
        isCurrentMonth: false,
        iso,
        isToday: iso === todayISO,
        isSelected: iso === value,
        isDisabled: Boolean((min && iso < min) || (max && iso > max)),
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const currentDate = new Date(viewYear, viewMonth, d);
      const iso = formatDateToISO(currentDate);
      cells.push({
        day: d,
        isCurrentMonth: true,
        iso,
        isToday: iso === todayISO,
        isSelected: iso === value,
        isDisabled: Boolean((min && iso < min) || (max && iso > max)),
      });
    }

    // Next month padding to fill out 35 or 42 grid cells
    const remaining = (7 - (cells.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      const nextMonthDate = new Date(viewYear, viewMonth + 1, d);
      const iso = formatDateToISO(nextMonthDate);
      cells.push({
        day: d,
        isCurrentMonth: false,
        iso,
        isToday: iso === todayISO,
        isSelected: iso === value,
        isDisabled: Boolean((min && iso < min) || (max && iso > max)),
      });
    }

    return cells;
  }, [viewYear, viewMonth, value, min, max]);

  // Generate a list of years for quick selection (current year - 10 to current year + 10)
  const yearsList = useMemo(() => {
    const list: number[] = [];
    const baseYear = new Date().getFullYear();
    for (let y = baseYear - 10; y <= baseYear + 10; y++) {
      list.push(y);
    }
    return list;
  }, []);

  const displayString = formatDisplayDate(value);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        id={id}
        onClick={() => {
          if (disabled) return;
          if (!isOpen) updatePosition();
          setIsOpen((prev) => !prev);
        }}
        disabled={disabled}
        className={`w-full flex items-center justify-between px-3 py-2 border rounded-lg text-xs font-medium shadow-2xs transition-all cursor-pointer select-none text-left ${
          isDueToday
            ? 'border-rose-400 dark:border-rose-700 bg-rose-50/60 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 font-bold focus:ring-2 focus:ring-rose-500/20'
            : isOpen
            ? 'border-blue-500 ring-2 ring-blue-500/20 bg-white dark:bg-slate-900 text-slate-900 dark:text-white'
            : FORM_STYLES.input
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <CalendarIcon
            className={`w-3.5 h-3.5 shrink-0 transition-colors ${
              isDueToday
                ? 'text-rose-600 dark:text-rose-400'
                : isOpen
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-slate-400 dark:text-slate-500'
            }`}
          />
          <span
            className={`truncate ${
              value
                ? 'text-slate-900 dark:text-slate-100 font-medium'
                : 'text-slate-400 dark:text-slate-500 font-normal'
            }`}
          >
            {displayString || placeholder}
          </span>
        </div>

        {/* Clear icon or subtle indicator */}
        <div className="flex items-center gap-1 shrink-0 ml-1.5">
          {value && !required && !disabled && (
            <span
              role="button"
              title="Clear date"
              onClick={handleClear}
              className="p-0.5 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-3 h-3" />
            </span>
          )}
        </div>
      </button>

      {/* Modern Popover Calendar Modal via Portal */}
      {isOpen &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: 'fixed',
              top: menuCoords.top !== undefined ? `${menuCoords.top}px` : undefined,
              bottom: menuCoords.bottom !== undefined ? `${menuCoords.bottom}px` : undefined,
              left: menuCoords.left !== undefined ? `${menuCoords.left}px` : undefined,
              width: '280px',
              zIndex: 9999,
            }}
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl dark:shadow-2xl border border-slate-200/90 dark:border-slate-800 p-3.5 animate-in fade-in zoom-in-95 duration-150 select-none"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header: Month / Year / Navigators */}
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() =>
                  setViewMode((prev) => (prev === 'calendar' ? 'year-select' : 'calendar'))
                }
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-bold text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <span>
                  {MONTH_NAMES[viewMonth]} {viewYear}
                </span>
                <span className="text-3xs text-slate-400 dark:text-slate-500 font-normal">
                  {viewMode === 'year-select' ? '▴' : '▾'}
                </span>
              </button>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  title="Previous Month"
                  className="p-1 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  title="Next Month"
                  className="p-1 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Quick Year Selector Grid */}
            {viewMode === 'year-select' ? (
              <div className="grid grid-cols-3 gap-1.5 max-h-[210px] overflow-y-auto p-1 custom-scrollbar">
                {yearsList.map((y) => (
                  <button
                    key={y}
                    type="button"
                    onClick={() => {
                      setViewYear(y);
                      setViewMode('calendar');
                    }}
                    className={`py-2 px-1 rounded-lg text-xs font-medium transition-colors cursor-pointer text-center ${
                      y === viewYear
                        ? 'bg-blue-600 dark:bg-blue-500 text-white font-bold shadow-2xs'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {y}
                  </button>
                ))}
              </div>
            ) : (
              <>
                {/* Day-of-week header row */}
                <div className="grid grid-cols-7 mb-1 text-center">
                  {DAY_NAMES.map((d) => (
                    <span
                      key={d}
                      className="text-3xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 py-1"
                    >
                      {d}
                    </span>
                  ))}
                </div>

                {/* Days Grid */}
                <div className="grid grid-cols-7 gap-1">
                  {calendarDays.map((cell, idx) => {
                    const isSelected = cell.isSelected;
                    const isToday = cell.isToday;

                    if (!cell.isCurrentMonth) {
                      return (
                        <div
                          key={`other-${idx}`}
                          className="h-8 flex items-center justify-center text-xs text-slate-300 dark:text-slate-600 font-normal select-none pointer-events-none"
                        >
                          {cell.day}
                        </div>
                      );
                    }

                    return (
                      <button
                        key={`curr-${cell.day}`}
                        type="button"
                        disabled={cell.isDisabled}
                        onClick={(e) => handleSelectDay(cell.day, e)}
                        className={`h-8 w-full rounded-lg text-xs font-medium flex items-center justify-center transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-blue-600 dark:bg-blue-500 text-white font-bold shadow-xs scale-105'
                            : isToday
                            ? 'text-blue-600 dark:text-blue-400 font-bold border border-blue-300 dark:border-blue-700/80 hover:bg-blue-50 dark:hover:bg-blue-950/40'
                            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80'
                        } ${cell.isDisabled ? 'opacity-30 cursor-not-allowed pointer-events-none' : ''}`}
                      >
                        {cell.day}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {/* Footer Toolbar: Quick actions */}
            <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-2xs">
              <button
                type="button"
                onClick={handleSelectToday}
                className="font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer px-1 py-0.5"
              >
                Today
              </button>

              {!required && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer px-1 py-0.5"
                >
                  Clear
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer px-2 py-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Done
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
