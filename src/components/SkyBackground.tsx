import React, { useMemo } from 'react';

interface SkyBackgroundProps {
  theme?: 'light' | 'dark';
  mainColor?: string;
  uiStyle?: 'glass' | 'normal' | 'nothing';
}

interface Particle {
  id: number;
  top: string;
  left: string;
  size: number;
  colorKey: 'primary' | 'electric' | 'softGlow' | 'indigo';
  duration: string;
  delay: string;
}

/**
 * Converts a HEX color string into [H, S, L]
 */
function hexToHsl(hex: string): [number, number, number] {
  let cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map((c) => c + c).join('');
  }
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

/**
 * Generates a refined, cohesive color palette strictly derived from the application's Main Color.
 * Ensures all flowing fluid orbs harmonize with the main brand color.
 */
function generateMainColorPalette(baseHex: string = '#2563eb') {
  const [h, s, l] = hexToHsl(baseHex || '#2563eb');

  return {
    // Exact Main Color (e.g. Royal Blue)
    primary: `hsl(${h}, ${s}%, ${l}%)`,
    // Deep Anchor Tone (e.g. Cobalt / Deep Navy Blue)
    deep: `hsl(${h}, ${Math.min(100, s + 5)}%, ${Math.max(22, l - 18)}%)`,
    // Vibrant Electric Accent (e.g. Electric Sky Blue / Aqua)
    electric: `hsl(${(h - 18 + 360) % 360}, ${Math.min(100, s + 10)}%, ${Math.min(75, l + 8)}%)`,
    // Cool Analogous Tone (e.g. Deep Royal Indigo)
    indigo: `hsl(${(h + 20) % 360}, ${Math.min(100, s + 5)}%, ${Math.min(65, l + 4)}%)`,
    // Soft Crystalline Highlight (e.g. Soft Ice Blue)
    softGlow: `hsl(${h}, ${Math.min(100, s + 12)}%, ${Math.min(84, l + 18)}%)`,
    // Ocean Azure Bridge Tone
    accent: `hsl(${(h - 10 + 360) % 360}, ${s}%, ${l}%)`,
  };
}

/**
 * Dynamic Flowing Color Effect running in the background.
 * Adapts across Glassy (mesh & orbs), Normal (solid canvas), and Nothing OS (dot matrix & red glyph).
 */
export const SkyBackground: React.FC<SkyBackgroundProps> = ({
  theme,
  mainColor = '#2563eb',
  uiStyle: propUiStyle,
}) => {
  const isDark = theme === 'dark';

  // Determine active style mode
  const activeStyle =
    propUiStyle ||
    (typeof document !== 'undefined'
      ? (document.documentElement.getAttribute('data-ui-style') as 'glass' | 'normal' | 'nothing')
      : 'glass') ||
    'glass';

  // Compute cohesive palette derived strictly from Main Color (for glass mode)
  const palette = useMemo(() => generateMainColorPalette(mainColor), [mainColor]);

  // Subtle floating luminescent particles derived from the Main Color palette
  const particles = useMemo<Particle[]>(() => {
    return [
      { id: 1, top: '22%', left: '16%', size: 3, colorKey: 'electric', duration: '9s', delay: '0s' },
      { id: 2, top: '42%', left: '26%', size: 4, colorKey: 'softGlow', duration: '13s', delay: '1.5s' },
      { id: 3, top: '16%', left: '74%', size: 2.5, colorKey: 'primary', duration: '11s', delay: '3s' },
      { id: 4, top: '64%', left: '84%', size: 3.5, colorKey: 'electric', duration: '14s', delay: '0.8s' },
      { id: 5, top: '76%', left: '44%', size: 3, colorKey: 'indigo', duration: '10s', delay: '2.2s' },
      { id: 6, top: '34%', left: '56%', size: 2, colorKey: 'softGlow', duration: '12s', delay: '4s' },
      { id: 7, top: '80%', left: '20%', size: 4, colorKey: 'primary', duration: '15s', delay: '1s' },
      { id: 8, top: '18%', left: '36%', size: 2.5, colorKey: 'indigo', duration: '8s', delay: '2.8s' },
    ];
  }, []);

  // 1. Nothing OS Style Background: Pure OLED black / crisp white with dot-matrix grid and signature red LED
  if (activeStyle === 'nothing') {
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
  }

  // 2. Normal UI Style Background: Clean solid canvas with zero heavy blur animations
  if (activeStyle === 'normal') {
    return (
      <div
        aria-hidden="true"
        className="fixed inset-0 pointer-events-none overflow-hidden select-none z-0 transition-colors duration-500"
      >
        <div
          className={`absolute inset-0 transition-colors duration-500 ${
            isDark ? 'bg-slate-950' : 'bg-slate-50'
          }`}
        />
      </div>
    );
  }

  // 3. Glassy UI Style Background: Dynamic flowing mesh, fluid blobs & floating luminescent particles
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none overflow-hidden select-none z-0 transition-colors duration-700"
    >
      {/* Base Canvas Tint with Smooth Light/Dark Transition */}
      <div
        className={`absolute inset-0 transition-colors duration-700 ${
          isDark ? 'bg-slate-950' : 'bg-slate-50'
        }`}
      />

      {/* Main Color Hue-Shifting Container: Oscillates gracefully within Main Color bounds (-18deg to +18deg) */}
      <div className="absolute inset-0 animate-main-color-hue">
        {/* Central Rotating Color Swirl Core */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[750px] h-[750px] sm:w-[950px] sm:h-[950px] md:w-[1150px] md:h-[1150px] animate-mesh-spin">
          <div
            className={`w-full h-full rounded-full blur-[100px] sm:blur-[140px] transition-opacity duration-700 ${
              isDark ? 'opacity-35' : 'opacity-40'
            }`}
            style={{
              background: `conic-gradient(from 0deg, ${palette.deep}, ${palette.primary}, ${palette.electric}, ${palette.indigo}, ${palette.deep})`,
            }}
          />
        </div>

        {/* Fluid Orb 1: Primary Main Color (Top-Left Drifting) */}
        <div className="absolute -top-24 -left-24 sm:-top-32 sm:-left-32 w-[520px] h-[520px] sm:w-[700px] sm:h-[700px] animate-fluid-blob-1">
          <div
            className={`w-full h-full rounded-full blur-[90px] sm:blur-[130px] transition-opacity duration-700 ${
              isDark ? 'opacity-40' : 'opacity-45'
            }`}
            style={{
              background: `radial-gradient(circle, ${palette.primary} 0%, ${palette.deep} 65%, transparent 100%)`,
            }}
          />
        </div>

        {/* Fluid Orb 2: Electric Accent Tone (Top-Right Sweeping) */}
        <div className="absolute -top-20 -right-20 sm:-top-28 sm:-right-28 w-[500px] h-[500px] sm:w-[680px] sm:h-[680px] animate-fluid-blob-2">
          <div
            className={`w-full h-full rounded-full blur-[90px] sm:blur-[130px] transition-opacity duration-700 ${
              isDark ? 'opacity-40' : 'opacity-45'
            }`}
            style={{
              background: `radial-gradient(circle, ${palette.electric} 0%, ${palette.primary} 70%, transparent 100%)`,
            }}
          />
        </div>

        {/* Fluid Orb 3: Soft Crystalline Glow (Mid-Screen Pulsing) */}
        <div className="absolute top-1/3 left-1/4 sm:left-1/3 w-[480px] h-[480px] sm:w-[650px] sm:h-[650px] animate-fluid-blob-3">
          <div
            className={`w-full h-full rounded-full blur-[95px] sm:blur-[135px] transition-opacity duration-700 ${
              isDark ? 'opacity-35' : 'opacity-40'
            }`}
            style={{
              background: `radial-gradient(circle, ${palette.softGlow} 0%, ${palette.accent} 65%, transparent 100%)`,
            }}
          />
        </div>

        {/* Fluid Orb 4: Deep Indigo Harmonic (Bottom-Left Rising) */}
        <div className="absolute -bottom-24 -left-16 sm:-bottom-32 sm:-left-24 w-[480px] h-[480px] sm:w-[640px] sm:h-[640px] animate-fluid-blob-4">
          <div
            className={`w-full h-full rounded-full blur-[90px] sm:blur-[130px] transition-opacity duration-700 ${
              isDark ? 'opacity-35' : 'opacity-40'
            }`}
            style={{
              background: `radial-gradient(circle, ${palette.indigo} 0%, ${palette.deep} 70%, transparent 100%)`,
            }}
          />
        </div>

        {/* Fluid Orb 5: Electric Ocean Tone (Bottom-Right Orbiting) */}
        <div className="absolute -bottom-20 -right-20 sm:-bottom-28 sm:-right-28 w-[520px] h-[520px] sm:w-[680px] sm:h-[680px] animate-fluid-blob-5">
          <div
            className={`w-full h-full rounded-full blur-[90px] sm:blur-[130px] transition-opacity duration-700 ${
              isDark ? 'opacity-35' : 'opacity-40'
            }`}
            style={{
              background: `radial-gradient(circle, ${palette.electric} 0%, ${palette.indigo} 70%, transparent 100%)`,
            }}
          />
        </div>
      </div>

      {/* Floating Luminescent Light Embers in Main Color tones */}
      <div className="absolute inset-0 pointer-events-none">
        {particles.map((p) => {
          const particleColor = palette[p.colorKey] || palette.primary;
          return (
            <div
              key={p.id}
              className="absolute animate-particle-float"
              style={{
                top: p.top,
                left: p.left,
                animationDuration: p.duration,
                animationDelay: p.delay,
              }}
            >
              <div
                className={`rounded-full shadow-lg ${isDark ? 'opacity-75' : 'opacity-55'}`}
                style={{
                  width: `${p.size}px`,
                  height: `${p.size}px`,
                  backgroundColor: particleColor,
                  boxShadow: `0 0 10px ${particleColor}`,
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Delicate Micro-Frosted Vignette for Visual Focus */}
      <div
        className={`absolute inset-0 pointer-events-none transition-opacity duration-700 ${
          isDark
            ? 'bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(15,23,42,0.45)_100%)]'
            : 'bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(248,250,252,0.35)_100%)]'
        }`}
      />
    </div>
  );
};
