import React from 'react';

interface SkyBackgroundProps {
  theme?: 'light' | 'dark';
  mainColor?: string;
  uiStyle?: 'nothing';
}

/**
 * Nothing OS Background Canvas: Pure OLED black / crisp paper white with dot-matrix grid and signature red LED
 */
export const SkyBackground: React.FC<SkyBackgroundProps> = ({ theme }) => {
  const isDark = theme === 'dark';

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none overflow-hidden select-none z-0 transition-colors duration-500"
    >
      {/* Base Pure Canvas */}
      <div
        className={`absolute inset-0 transition-colors duration-500 ${
          isDark ? 'bg-black' : 'bg-[#f7f7f7]'
        }`}
      />

      {/* Nothing OS Dot Matrix Grid */}
      <div
        className="absolute inset-0 opacity-80"
        style={{
          backgroundImage: isDark
            ? 'radial-gradient(circle, rgba(255, 255, 255, 0.18) 1.2px, transparent 1.2px)'
            : 'radial-gradient(circle, rgba(0, 0, 0, 0.14) 1.2px, transparent 1.2px)',
          backgroundSize: '20px 20px',
        }}
      />

      {/* Minimal Vignette for Visual Focus */}
      <div
        className={`absolute inset-0 pointer-events-none ${
          isDark
            ? 'bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(0,0,0,0.75)_100%)]'
            : 'bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(225,225,225,0.45)_100%)]'
        }`}
      />

      {/* Signature Nothing Red Recording Indicator */}
      <div className="absolute top-4 right-6 sm:top-5 sm:right-8 flex items-center gap-2 opacity-70">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#D71921] opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-[#D71921]" />
        </span>
        <span className="text-[10px] font-mono tracking-widest uppercase text-neutral-400 dark:text-neutral-600 select-none">
          NOTHING (R)
        </span>
      </div>
    </div>
  );
};
