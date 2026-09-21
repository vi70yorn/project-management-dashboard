import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Users,
  ChevronDown,
  Check,
  X,
  Search,
  CheckSquare,
  Square,
} from 'lucide-react';
import { TeamMember } from '../../types';

interface TeamMemberMultiSelectProps {
  id?: string;
  members: TeamMember[];
  selectedMemberIds: string[];
  onChange: (selectedIds: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export const TeamMemberMultiSelect: React.FC<TeamMemberMultiSelectProps> = ({
  id,
  members,
  selectedMemberIds,
  onChange,
  placeholder = 'Select team members for this project...',
  disabled = false,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [menuCoords, setMenuCoords] = useState<{
    top?: number;
    bottom?: number;
    left?: number;
    width?: number;
  }>({});

  const updatePosition = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();

    if (rect.bottom < 0 || rect.top > window.innerHeight) {
      setIsOpen(false);
      return;
    }

    const estimatedHeight = 320;
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

    const menuWidth = rect.width;
    let left = rect.left;

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
      width: rect.width,
    });
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      return;
    }

    updatePosition();
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);

    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
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

    const handleScrollOrResize = () => {
      updatePosition();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick, true);
    document.addEventListener('touchstart', handleOutsideClick, true);
    window.addEventListener('resize', handleScrollOrResize, true);
    window.addEventListener('scroll', handleScrollOrResize, true);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick, true);
      document.removeEventListener('touchstart', handleOutsideClick, true);
      window.removeEventListener('resize', handleScrollOrResize, true);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, updatePosition]);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    if (!isOpen) {
      updatePosition();
    }
    setIsOpen((prev) => !prev);
  };

  const toggleMember = (memberId: string) => {
    if (selectedMemberIds.includes(memberId)) {
      if (selectedMemberIds.length > 1) {
        onChange(selectedMemberIds.filter((id) => id !== memberId));
      }
    } else {
      onChange([...selectedMemberIds, memberId]);
    }
  };

  const removeMember = (memberId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedMemberIds.length > 1) {
      onChange(selectedMemberIds.filter((id) => id !== memberId));
    }
  };

  const handleSelectAll = () => {
    onChange(members.map((m) => m.id));
  };

  const handleSelectFirstOnly = () => {
    if (members.length > 0) {
      onChange([members[0].id]);
    }
  };

  const selectedMembers = members.filter((m) => selectedMemberIds.includes(m.id));

  const filteredMembers = members.filter((m) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      m.name.toLowerCase().includes(q) ||
      m.role?.toLowerCase().includes(q) ||
      (m.department && m.department.toLowerCase().includes(q))
    );
  });

  return (
    <div
      ref={containerRef}
      id={id}
      className={`relative w-full ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Dropdown Trigger Button */}
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        className={`w-full min-h-[42px] px-3 py-1.5 flex items-center justify-between gap-2 rounded-xl border text-left cursor-pointer transition-all shadow-2xs select-none bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 ${
          isOpen
            ? 'border-blue-500 ring-2 ring-blue-500/20 dark:border-blue-500'
            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <div className="flex-1 flex items-center gap-1.5 min-w-0 flex-wrap py-0.5">
          {selectedMembers.length === 0 ? (
            <span className="text-xs sm:text-sm text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-slate-400" />
              {placeholder}
            </span>
          ) : (
            <>
              {selectedMembers.slice(0, 3).map((m) => (
                <span
                  key={m.id}
                  className="inline-flex items-center gap-1.5 pl-1 pr-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700/80 text-slate-800 dark:text-slate-100 text-xs font-medium border border-slate-200 dark:border-slate-600 shadow-2xs"
                >
                  {m.avatar ? (
                    <img
                      src={m.avatar}
                      alt={m.name}
                      className="w-4 h-4 rounded-full object-cover shrink-0"
                    />
                  ) : (
                    <div
                      style={{ backgroundColor: m.color || '#2563eb' }}
                      className="w-4 h-4 rounded-full text-white text-[9px] font-bold flex items-center justify-center shrink-0"
                    >
                      {m.name.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <span className="truncate max-w-[85px]">{m.name}</span>
                  {selectedMemberIds.length > 1 && (
                    <span
                      onClick={(e) => removeMember(m.id, e)}
                      className="text-slate-400 hover:text-rose-500 rounded-full p-0.5 cursor-pointer transition-colors"
                      title={`Remove ${m.name}`}
                    >
                      <X className="w-2.5 h-2.5" />
                    </span>
                  )}
                </span>
              ))}

              {selectedMembers.length > 3 && (
                <span className="text-3xs font-bold px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                  +{selectedMembers.length - 3} more
                </span>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-2xs font-medium text-slate-400 dark:text-slate-500">
            {selectedMemberIds.length} of {members.length}
          </span>
          <ChevronDown
            className={`w-4 h-4 text-slate-400 dark:text-slate-500 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-blue-600 dark:text-blue-400' : ''
            }`}
          />
        </div>
      </button>

      {/* Popover Portal Menu */}
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
            className="max-h-80 overflow-hidden flex flex-col bg-white dark:bg-slate-900 backdrop-blur-md rounded-xl border border-slate-200/90 dark:border-slate-700/80 shadow-2xl shadow-slate-900/20 dark:shadow-black/70 animate-in fade-in zoom-in-95 duration-100"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search and Quick Actions Header */}
            <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 space-y-2 shrink-0">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search team members by name or role..."
                  className="w-full pl-8 pr-7 py-1.5 text-xs bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between px-1 text-3xs font-semibold">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <CheckSquare className="w-3 h-3" />
                    Select All ({members.length})
                  </button>
                  <span className="text-slate-300 dark:text-slate-600">•</span>
                  <button
                    type="button"
                    onClick={handleSelectFirstOnly}
                    className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:underline cursor-pointer"
                  >
                    Reset (Lead Only)
                  </button>
                </div>
                <span className="text-slate-400 dark:text-slate-500">
                  {selectedMemberIds.length} selected
                </span>
              </div>
            </div>

            {/* Members List */}
            <div className="flex-1 overflow-y-auto p-1.5 space-y-1 custom-scrollbar">
              {filteredMembers.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400 dark:text-slate-500 italic">
                  No team members matching "{searchQuery}"
                </div>
              ) : (
                filteredMembers.map((member) => {
                  const isSelected = selectedMemberIds.includes(member.id);

                  return (
                    <div
                      key={member.id}
                      onClick={() => toggleMember(member.id)}
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer text-xs transition-colors ${
                        isSelected
                          ? 'bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200'
                          : 'bg-white dark:bg-slate-800/60 border border-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        {member.avatar ? (
                          <img
                            src={member.avatar}
                            alt={member.name}
                            className="w-7 h-7 rounded-full object-cover shrink-0 border border-slate-200 dark:border-slate-700"
                          />
                        ) : (
                          <div
                            style={{ backgroundColor: member.color || '#2563eb' }}
                            className="w-7 h-7 rounded-full text-white text-3xs font-bold flex items-center justify-center shrink-0 shadow-2xs"
                          >
                            {member.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="truncate">
                          <p className="font-semibold text-xs text-slate-900 dark:text-white truncate">
                            {member.name}
                          </p>
                          <p className="text-3xs text-slate-500 dark:text-slate-400 truncate">
                            {member.role}
                            {member.department && ` • ${member.department}`}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        {isSelected ? (
                          <div className="w-5 h-5 rounded-md bg-blue-600 text-white flex items-center justify-center shadow-2xs">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900" />
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Dropdown Footer */}
            <div className="p-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 flex items-center justify-between shrink-0">
              <span className="text-3xs text-slate-500 dark:text-slate-400">
                Tip: Click any member to toggle assignment
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-2xs cursor-pointer transition-colors"
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
