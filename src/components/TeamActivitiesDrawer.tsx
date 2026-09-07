import React, { useEffect, useState } from 'react';
import { TeamActivitiesFeed } from './TeamActivitiesFeed';

interface TeamActivitiesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProject?: (projectId: string) => void;
  refreshTrigger?: number;
}

export const TeamActivitiesDrawer: React.FC<TeamActivitiesDrawerProps> = ({
  isOpen,
  onClose,
  onSelectProject,
  refreshTrigger,
}) => {
  const [mounted, setMounted] = useState(false);

  // Manage mounting lifecycle to enable smooth entrance and exit animations
  useEffect(() => {
    if (isOpen) {
      setMounted(true);
    } else {
      const timer = setTimeout(() => setMounted(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Handle ESC key to dismiss drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent background body scrolling while drawer is active
  useEffect(() => {
    if (isOpen) {
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalStyle;
      };
    }
  }, [isOpen]);

  if (!mounted && !isOpen) return null;

  return (
    <div
      id="team-activities-drawer-container"
      className="fixed inset-0 z-50 overflow-hidden"
      aria-labelledby="team-activities-drawer-title"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop overlay */}
      <div
        onClick={onClose}
        className={`fixed inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-xs transition-opacity duration-300 ease-in-out cursor-pointer ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden="true"
      />

      {/* Slide-over panel container */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-6 sm:pl-10 pointer-events-none">
        <div
          className={`pointer-events-auto w-screen max-w-md sm:max-w-lg md:max-w-xl bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl transition-transform duration-300 ease-in-out transform flex flex-col ${
            isOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <TeamActivitiesFeed
            isDrawer={true}
            onClose={onClose}
            onSelectProject={onSelectProject}
            refreshTrigger={refreshTrigger}
          />
        </div>
      </div>
    </div>
  );
};
