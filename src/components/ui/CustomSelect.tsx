import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  color?: string;
  badge?: string | number;
  sublabel?: string;
}

export type CustomSelectOption = SelectOption;

export interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  icon?: React.ReactNode;
  size?: 'sm' | 'md';
  fullWidth?: boolean;
  disabled?: boolean;
  align?: 'left' | 'right';
  className?: string;
  menuClassName?: string;
  id?: string;
  ariaLabel?: string;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Select option...',
  icon,
  size = 'md',
  fullWidth = false,
  disabled = false,
  align = 'left',
  className = '',
  menuClassName = '',
  id,
  ariaLabel,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

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

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;

    if (!isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setOpenUpward(spaceBelow < 240 && rect.top > 240);
    }

    setIsOpen((prev) => !prev);
  };

  const handleSelect = (val: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(val);
    setIsOpen(false);
  };

  const sizeClasses = {
    sm: 'h-8 px-2.5 py-1 text-xs rounded-lg',
    md: 'h-9.5 px-3 py-2 text-xs sm:text-sm rounded-lg',
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
        aria-label={ariaLabel || placeholder}
        className={`w-full flex items-center justify-between font-medium border transition-all cursor-pointer shadow-2xs select-none bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 ${
          sizeClasses[size]
        } ${
          isOpen
            ? 'ring-2 ring-blue-500/20 border-blue-500 dark:border-blue-500'
            : ''
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <div className="flex items-center gap-2 min-w-0 pr-2">
          {icon && <span className="text-slate-400 dark:text-slate-500 shrink-0">{icon}</span>}
          {selectedOption?.icon && <span className="shrink-0">{selectedOption.icon}</span>}
          {selectedOption?.color && (
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs"
              style={{ backgroundColor: selectedOption.color }}
            />
          )}
          <span className="truncate text-left">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          {selectedOption?.badge !== undefined && (
            <span className="text-3xs px-1.5 py-0.2 rounded-full font-semibold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
              {selectedOption.badge}
            </span>
          )}
        </div>

        <ChevronDown
          className={`w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Popover Menu */}
      {isOpen && (
        <div
          className={`absolute z-50 min-w-[200px] w-full max-h-60 overflow-y-auto p-1.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-xl border border-slate-200/90 dark:border-slate-700/80 shadow-xl shadow-slate-900/10 dark:shadow-black/50 animate-in fade-in zoom-in-95 duration-150 ${
            align === 'right' ? 'right-0' : 'left-0'
          } ${openUpward ? 'bottom-full mb-1.5' : 'top-full mt-1.5'} ${menuClassName}`}
        >
          <div className="space-y-0.5">
            {options.map((opt) => {
              const isSelected = opt.value === value;

              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={(e) => handleSelect(opt.value, e)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer text-left ${
                    isSelected
                      ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 pr-2">
                    {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                    {opt.color && (
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs"
                        style={{ backgroundColor: opt.color }}
                      />
                    )}
                    <div className="min-w-0">
                      <span className="truncate block">{opt.label}</span>
                      {opt.sublabel && (
                        <span className="text-3xs text-slate-400 dark:text-slate-500 truncate block">
                          {opt.sublabel}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    {opt.badge !== undefined && (
                      <span className="text-3xs px-1.5 py-0.2 rounded-full font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {opt.badge}
                      </span>
                    )}
                    {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
