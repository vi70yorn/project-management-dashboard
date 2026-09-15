import React from 'react';
import { Sparkles, Layout, Command, Sun, Moon } from 'lucide-react';

interface FooterProps {
  uiStyle: 'glass' | 'normal' | 'nothing';
  onToggleUiStyle?: () => void;
  onSelectUiStyle?: (style: 'glass' | 'normal' | 'nothing') => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onOpenCommandPalette?: () => void;
}

export const Footer: React.FC<FooterProps> = ({
  uiStyle,
  onToggleUiStyle,
  onSelectUiStyle,
  theme,
  onToggleTheme,
  onOpenCommandPalette,
}) => {
  const handleSelectStyle = (style: 'glass' | 'normal' | 'nothing') => {
    if (onSelectUiStyle) {
      onSelectUiStyle(style);
    } else if (onToggleUiStyle) {
      onToggleUiStyle();
    }
  };

  return (
    <footer
      id="app-footer"
      className="relative z-10 w-full mt-auto border-t border-slate-200/80 dark:border-slate-800/80 transition-all duration-300 bg-white/60 dark:bg-slate-900/50 backdrop-blur-md"
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-5 flex flex-col sm:flex-row items-center justify-between gap-3.5 sm:gap-4">
        {/* Left: Branding, Version & Copyright */}
        <div className="flex items-center gap-2.5 text-xs text-slate-500 dark:text-slate-400 flex-wrap justify-center sm:justify-start">
        {/*   <div className="flex items-center gap-2">
            <img
              src="/favicon.svg"
              alt="UX/UI Task Tracking"
              className="w-5 h-5 shadow-2xs shrink-0"
            />
            <span className="font-bold text-slate-800 dark:text-slate-200">
              UX/UI Task Tracking
            </span>
          </div> */}
         {/*  <span className="text-slate-300 dark:text-slate-700 hidden min-[480px]:inline">•</span> */}
          <span className="px-1.5 py-0.5 rounded text-3xs font-semibold bg-blue-100/70 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/50 dark:border-blue-800/40">
            v2.4
          </span>
          <span className="text-slate-300 dark:text-slate-700 hidden min-[480px]:inline">•</span>
          <span className="text-3xs text-slate-400 dark:text-slate-500">
            © 2026 UX/UI Team
          </span>
        </div>

        {/* Center: Command Palette Helper */}
        {/* {onOpenCommandPalette && (
          <button
            type="button"
            onClick={onOpenCommandPalette}
            className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-3xs font-medium text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100/60 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
            title="Open Command Palette (Ctrl+K or ⌘K)"
          >
            <Command className="w-3 h-3 text-slate-400" />
            <span>Quick search: Press</span>
            <kbd className="px-1 py-0.5 text-4xs font-mono font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded shadow-2xs text-slate-700 dark:text-slate-300">
              Ctrl+K
            </kbd>
          </button>
        )} */}

        {/* Right: Controls Cluster: Theme (Light/Dark) + UI Style (Glassy/Normal) */}
        <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2.5 sm:gap-3">
          {/* Light / Dark Mode Switch */}
          <div className="flex items-center gap-1.5">
            <span className="text-3xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 hidden min-[400px]:inline">
              Theme:
            </span>
            <div
              id="footer-theme-switch"
              className="flex items-center p-1 rounded-xl glass-card-subtle border border-slate-200/80 dark:border-slate-700/60 shadow-2xs"
              role="radiogroup"
              aria-label="Theme Mode"
            >
              <button
                type="button"
                id="footer-theme-light-btn"
                onClick={() => {
                  if (theme !== 'light') onToggleTheme();
                }}
                role="radio"
                aria-checked={theme === 'light'}
                className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  theme === 'light'
                    ? 'bg-white text-amber-600 shadow-2xs border border-amber-200/60 font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Switch to Light Mode"
              >
                <Sun className={`w-3.5 h-3.5 ${theme === 'light' ? 'text-amber-500' : 'text-slate-400'}`} />
                <span>Light</span>
              </button>

              <button
                type="button"
                id="footer-theme-dark-btn"
                onClick={() => {
                  if (theme !== 'dark') onToggleTheme();
                }}
                role="radio"
                aria-checked={theme === 'dark'}
                className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  theme === 'dark'
                    ? 'bg-slate-800 text-blue-400 shadow-2xs border border-blue-500/30 font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Switch to Dark Mode"
              >
                <Moon className={`w-3.5 h-3.5 ${theme === 'dark' ? 'text-blue-400' : 'text-slate-400'}`} />
                <span>Dark</span>
              </button>
            </div>
          </div>

          <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block" />

          {/* UI Style Switch (Glassy vs Normal) */}
          <div className="flex items-center gap-1.5">
            <span className="text-3xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 hidden min-[400px]:inline">
              Style:
            </span>
            <div
              id="footer-ui-style-switch"
              className="flex items-center p-1 rounded-xl glass-card-subtle border border-slate-200/80 dark:border-slate-700/60 shadow-2xs"
              role="radiogroup"
              aria-label="Interface Style"
            >
              {/* 1. Normal UI Switch Option */}
              <button
                type="button"
                id="switch-ui-normal-btn"
                onClick={() => handleSelectStyle('normal')}
                role="radio"
                aria-checked={uiStyle === 'normal'}
                className={`inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  uiStyle === 'normal'
                    ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-2xs border border-blue-200/60 dark:border-blue-500/30 font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Apply clean, solid flat modern UI without blur or background animations"
              >
                <Layout className={`w-3.5 h-3.5 ${uiStyle === 'normal' ? 'text-blue-500' : 'text-slate-400'}`} />
                <span>Normal</span>
              </button>

              {/* 2. Glassy Effect Switch Option */}
              <button
                type="button"
                id="switch-ui-glassy-btn"
                onClick={() => handleSelectStyle('glass')}
                role="radio"
                aria-checked={uiStyle === 'glass'}
                className={`inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  uiStyle === 'glass'
                    ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-2xs border border-blue-200/60 dark:border-blue-500/30 font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Apply Glassmorphic surfaces with frosted blur and ambient lighting"
              >
                <Sparkles className={`w-3.5 h-3.5 ${uiStyle === 'glass' ? 'text-amber-500 animate-pulse' : 'text-slate-400'}`} />
                <span>Glassy</span>
              </button>

              {/* 3. Nothing OS Style Switch Option */}
              <button
                type="button"
                id="switch-ui-nothing-btn"
                onClick={() => handleSelectStyle('nothing')}
                role="radio"
                aria-checked={uiStyle === 'nothing'}
                className={`inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  uiStyle === 'nothing'
                    ? 'bg-neutral-900 text-white dark:bg-black dark:text-neutral-100 shadow-2xs border border-neutral-700 dark:border-neutral-700 font-mono tracking-tight font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-mono'
                }`}
                title="Apply minimalist Nothing OS monochrome style with dot matrix grid & red accents"
              >
                <span className="relative flex h-2 w-2 items-center justify-center">
                  {uiStyle === 'nothing' && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#D71921] opacity-75" />
                  )}
                  <span
                    className={`relative inline-flex rounded-full h-2 w-2 transition-colors ${
                      uiStyle === 'nothing' ? 'bg-[#D71921]' : 'bg-neutral-400 dark:bg-neutral-600'
                    }`}
                  />
                </span>
                <span>Nothing</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};
