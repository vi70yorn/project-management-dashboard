import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
  Check,
  RotateCcw,
  Sparkles,
} from 'lucide-react';

export interface ModernDateRangePickerProps {
  startDate: string; // 'YYYY-MM-DD'
  endDate: string;   // 'YYYY-MM-DD'
  onChange: (startDate: string, endDate: string, presetName?: string) => void;
  className?: string;
  placeholder?: string;
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

const WEEKDAY_NAMES = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

// Helpers
const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);

const formatDateToISO = (d: Date): string => {
  const year = d.getFullYear();
  const month = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${year}-${month}-${day}`;
};

const parseLocalDate = (str?: string): Date | null => {
  if (!str || typeof str !== 'string') return null;
  const parts = str.trim().split('-');
  if (parts.length !== 3) return null;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
  return new Date(y, m, d);
};

const formatDisplayDate = (str?: string): string => {
  const parsed = parseLocalDate(str);
  if (!parsed) return '';
  const monthShort = MONTH_NAMES[parsed.getMonth()].slice(0, 3);
  return `${monthShort} ${parsed.getDate()}, ${parsed.getFullYear()}`;
};

const formatShortDate = (str?: string): string => {
  const parsed = parseLocalDate(str);
  if (!parsed) return '';
  const monthShort = MONTH_NAMES[parsed.getMonth()].slice(0, 3);
  return `${monthShort} ${parsed.getDate()}`;
};

export const ModernDateRangePicker: React.FC<ModernDateRangePickerProps> = ({
  startDate,
  endDate,
  onChange,
  className = '',
  placeholder = 'Select date range...',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Active month/year view in the calendar
  const initialDate = parseLocalDate(startDate) || parseLocalDate(endDate) || new Date();
  const [viewYear, setViewYear] = useState<number>(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(initialDate.getMonth());

  // Interactive selection state
  // When user clicks a date to start selecting, selectingStart is set
  const [selectingStart, setSelectingStart] = useState<string | null>(null);
  const [hoverDate, setHoverDate] = useState<string | null>(null);

  // Reset view month when opening
  useEffect(() => {
    if (isOpen) {
      const d = parseLocalDate(startDate) || parseLocalDate(endDate) || new Date();
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
      setSelectingStart(null);
      setHoverDate(null);
    }
  }, [isOpen, startDate, endDate]);

  // Position coordinates for floating portal menu
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

    const estimatedHeight = 390;
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

    const menuWidth = 340;
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

  // Month navigation
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

  // Jump to today
  const handleJumpToToday = (e: React.MouseEvent) => {
    e.stopPropagation();
    const today = new Date();
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
  };

  // Handle clicking a day cell
  const handleDayClick = (iso: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!selectingStart) {
      // First click: sets start date, begins range selection
      setSelectingStart(iso);
    } else {
      // Second click: completes range selection
      let start = selectingStart;
      let end = iso;
      if (start > end) {
        const tmp = start;
        start = end;
        end = tmp;
      }
      onChange(start, end, 'custom');
      setSelectingStart(null);
      setHoverDate(null);
    }
  };

  // Quick preset shortcuts inside popover
  const applyInternalPreset = (preset: 'this-week' | 'last-week' | 'this-month' | 'last-month' | 'all', e: React.MouseEvent) => {
    e.stopPropagation();
    const now = new Date();
    const day = now.getDay();
    const isoDay = day === 0 ? 7 : day;

    if (preset === 'this-week') {
      const mon = new Date(now);
      mon.setDate(now.getDate() - (isoDay - 1));
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      onChange(formatDateToISO(mon), formatDateToISO(sun), 'this-week');
    } else if (preset === 'last-week') {
      const mon = new Date(now);
      mon.setDate(now.getDate() - (isoDay - 1) - 7);
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      onChange(formatDateToISO(mon), formatDateToISO(sun), 'last-week');
    } else if (preset === 'this-month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      onChange(formatDateToISO(start), formatDateToISO(end), 'this-month');
    } else if (preset === 'last-month') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      onChange(formatDateToISO(start), formatDateToISO(end), 'last-month');
    } else if (preset === 'all') {
      onChange('', '', 'all');
    }

    setSelectingStart(null);
    setIsOpen(false);
  };

  // Build 42-cell calendar grid starting Monday
  const calendarCells = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    let startDayOfWeek = firstDay.getDay(); // 0 = Sun, 1 = Mon ...
    startDayOfWeek = startDayOfWeek === 0 ? 7 : startDayOfWeek; // 1 = Mon, 7 = Sun

    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const todayIso = formatDateToISO(new Date());

    // Effective range during selection
    let effectiveStart = startDate;
    let effectiveEnd = endDate;

    if (selectingStart) {
      effectiveStart = selectingStart;
      effectiveEnd = hoverDate || selectingStart;
      if (effectiveStart > effectiveEnd) {
        const tmp = effectiveStart;
        effectiveStart = effectiveEnd;
        effectiveEnd = tmp;
      }
    }

    const cells: Array<{
      day: number;
      iso: string;
      isCurrentMonth: boolean;
      isToday: boolean;
      isStart: boolean;
      isEnd: boolean;
      isInRange: boolean;
    }> = [];

    // 1. Days from previous month
    for (let i = startDayOfWeek - 1; i > 0; i--) {
      const d = daysInPrevMonth - i + 1;
      const prevDate = new Date(viewYear, viewMonth - 1, d);
      const iso = formatDateToISO(prevDate);
      cells.push({
        day: d,
        iso,
        isCurrentMonth: false,
        isToday: iso === todayIso,
        isStart: iso === effectiveStart,
        isEnd: iso === effectiveEnd,
        isInRange: Boolean(effectiveStart && effectiveEnd && iso > effectiveStart && iso < effectiveEnd),
      });
    }

    // 2. Days from current month
    for (let d = 1; d <= daysInMonth; d++) {
      const curDate = new Date(viewYear, viewMonth, d);
      const iso = formatDateToISO(curDate);
      cells.push({
        day: d,
        iso,
        isCurrentMonth: true,
        isToday: iso === todayIso,
        isStart: iso === effectiveStart,
        isEnd: iso === effectiveEnd,
        isInRange: Boolean(effectiveStart && effectiveEnd && iso > effectiveStart && iso < effectiveEnd),
      });
    }

    // 3. Days from next month to fill grid to 35 or 42 cells
    const remaining = (cells.length > 35 ? 42 : 35) - cells.length;
    for (let d = 1; d <= remaining; d++) {
      const nextDate = new Date(viewYear, viewMonth + 1, d);
      const iso = formatDateToISO(nextDate);
      cells.push({
        day: d,
        iso,
        isCurrentMonth: false,
        isToday: iso === todayIso,
        isStart: iso === effectiveStart,
        isEnd: iso === effectiveEnd,
        isInRange: Boolean(effectiveStart && effectiveEnd && iso > effectiveStart && iso < effectiveEnd),
      });
    }

    return cells;
  }, [viewYear, viewMonth, startDate, endDate, selectingStart, hoverDate]);

  // Compute days count in range
  const rangeDaysCount = useMemo(() => {
    if (!startDate || !endDate) return null;
    const s = parseLocalDate(startDate);
    const e = parseLocalDate(endDate);
    if (!s || !e) return null;
    const diffTime = Math.abs(e.getTime() - s.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  }, [startDate, endDate]);

  // Trigger button label
  const displayLabel = useMemo(() => {
    if (!startDate && !endDate) return 'All Time';
    if (startDate && endDate) {
      if (startDate === endDate) return formatDisplayDate(startDate);
      const sParsed = parseLocalDate(startDate);
      const eParsed = parseLocalDate(endDate);
      if (sParsed && eParsed && sParsed.getFullYear() === eParsed.getFullYear()) {
        return `${formatShortDate(startDate)} – ${formatDisplayDate(endDate)}`;
      }
      return `${formatShortDate(startDate)} – ${formatShortDate(endDate)}`;
    }
    if (startDate) return `From ${formatShortDate(startDate)}`;
    return `Up to ${formatShortDate(endDate)}`;
  }, [startDate, endDate]);

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      {/* Modern Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`group flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold backdrop-blur-xs transition-all cursor-pointer shadow-2xs select-none ${
          isOpen
            ? 'bg-white dark:bg-slate-800 border-2 border-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.2)] text-blue-700 dark:text-blue-300'
            : 'bg-white/85 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 hover:border-blue-400 dark:hover:border-blue-500 text-slate-800 dark:text-slate-200'
        }`}
        title="Click to select date range"
      >
        <CalendarIcon className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />

        <span className="font-bold truncate max-w-[200px]">{displayLabel || placeholder}</span>

        {rangeDaysCount !== null && (
          <span className="px-1.5 py-0.2 rounded-md text-3xs font-extrabold bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60 shrink-0">
            {rangeDaysCount}d
          </span>
        )}

        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180 text-blue-600 dark:text-blue-400' : ''
          }`}
        />
      </button>

      {/* Floating Modern Calendar Popover */}
      {isOpen &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: 'fixed',
              top: menuCoords.top !== undefined ? `${menuCoords.top}px` : undefined,
              bottom: menuCoords.bottom !== undefined ? `${menuCoords.bottom}px` : undefined,
              left: menuCoords.left !== undefined ? `${menuCoords.left}px` : undefined,
              width: '340px',
              zIndex: 9999,
            }}
            className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl rounded-2xl shadow-2xl border border-slate-200/90 dark:border-slate-800 p-4 animate-in fade-in zoom-in-95 duration-150 select-none text-slate-800 dark:text-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header: Month / Year / Navigators */}
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                  {MONTH_NAMES[viewMonth]} {viewYear}
                </span>
                <button
                  type="button"
                  onClick={handleJumpToToday}
                  className="px-1.5 py-0.5 rounded text-4xs font-bold text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  title="Jump to Current Month"
                >
                  Today
                </button>
              </div>

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

            {/* Weekdays Row (Mo -> Su) */}
            <div className="grid grid-cols-7 gap-1 text-center mb-1">
              {WEEKDAY_NAMES.map((name) => (
                <div
                  key={name}
                  className="text-3xs font-bold text-slate-400 dark:text-slate-500 py-1"
                >
                  {name}
                </div>
              ))}
            </div>

            {/* Days Grid */}
            <div
              className="grid grid-cols-7 gap-y-1 gap-x-0.5"
              onMouseLeave={() => setHoverDate(null)}
            >
              {calendarCells.map((cell) => {
                const isSelectedEndpoint = cell.isStart || cell.isEnd;

                return (
                  <button
                    key={cell.iso}
                    type="button"
                    onClick={(e) => handleDayClick(cell.iso, e)}
                    onMouseEnter={() => selectingStart && setHoverDate(cell.iso)}
                    className={`relative h-8 w-full text-xs font-semibold flex items-center justify-center transition-all cursor-pointer ${
                      cell.isStart && cell.isEnd
                        ? 'rounded-xl bg-blue-600 text-white font-black shadow-xs z-10'
                        : cell.isStart
                        ? 'rounded-l-xl bg-blue-600 text-white font-black shadow-xs z-10'
                        : cell.isEnd
                        ? 'rounded-r-xl bg-blue-600 text-white font-black shadow-xs z-10'
                        : cell.isInRange
                        ? 'bg-blue-100 dark:bg-blue-950/70 text-blue-900 dark:text-blue-200'
                        : cell.isToday
                        ? 'text-blue-600 dark:text-blue-400 font-extrabold hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg'
                        : cell.isCurrentMonth
                        ? 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg'
                        : 'text-slate-300 dark:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/40 rounded-lg'
                    }`}
                  >
                    <span>{cell.day}</span>
                    {cell.isToday && !isSelectedEndpoint && (
                      <span className="absolute bottom-1 w-1 h-1 rounded-full bg-blue-500" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Quick Presets Chips Inside Popover */}
            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <div className="text-4xs uppercase tracking-wider font-extrabold text-slate-400 mb-1.5">
                Quick Presets
              </div>
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  onClick={(e) => applyInternalPreset('this-week', e)}
                  className="px-2 py-1 rounded-lg text-3xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100/80 dark:bg-slate-800/80 hover:bg-blue-100 hover:text-blue-700 dark:hover:bg-emerald-950/60 dark:hover:text-emerald-300 transition-colors cursor-pointer"
                >
                  ✨ This Week
                </button>
                <button
                  type="button"
                  onClick={(e) => applyInternalPreset('last-week', e)}
                  className="px-2 py-1 rounded-lg text-3xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100/80 dark:bg-slate-800/80 hover:bg-sky-100 hover:text-sky-700 dark:hover:bg-sky-950/60 dark:hover:text-sky-300 transition-colors cursor-pointer"
                >
                  ⏮️ Last Week
                </button>
                <button
                  type="button"
                  onClick={(e) => applyInternalPreset('this-month', e)}
                  className="px-2 py-1 rounded-lg text-3xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100/80 dark:bg-slate-800/80 hover:bg-blue-100 hover:text-blue-700 dark:hover:bg-emerald-950/60 dark:hover:text-emerald-300 transition-colors cursor-pointer"
                >
                  📅 This Month
                </button>
                <button
                  type="button"
                  onClick={(e) => applyInternalPreset('all', e)}
                  className="px-2 py-1 rounded-lg text-3xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100/80 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  ♾️ All Time
                </button>
              </div>
            </div>

            {/* Selection Status & Action Footer */}
            <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="text-3xs text-slate-500 dark:text-slate-400">
                {selectingStart ? (
                  <span className="text-blue-600 dark:text-blue-400 font-semibold animate-pulse">
                    Click an end date...
                  </span>
                ) : startDate && endDate ? (
                  <span>
                    Selected: <strong className="text-slate-800 dark:text-slate-200">{rangeDaysCount} days</strong>
                  </span>
                ) : (
                  <span>All dates selected</span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                {(startDate || endDate) && (
                  <button
                    type="button"
                    onClick={(e) => applyInternalPreset('all', e)}
                    className="px-2 py-1 text-3xs font-semibold text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
                  >
                    Clear
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectingStart(null);
                    setIsOpen(false);
                  }}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-3xs font-bold shadow-2xs transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

