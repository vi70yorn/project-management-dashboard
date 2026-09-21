import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Pipette, X, Check, ArrowLeftRight } from 'lucide-react';

interface ColorPickerPopoverProps {
  color: string;
  onChange: (color: string) => void;
  isOpen: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
}

// Color conversion helpers
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
  const r = parseInt(hex.substring(0, 2), 16) || 0;
  const g = parseInt(hex.substring(2, 4), 16) || 0;
  const b = parseInt(hex.substring(4, 6), 16) || 0;
  return { r, g, b };
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.min(255, Math.max(0, Math.round(n))).toString(16).padStart(2, '0');
  return '#' + toHex(r) + toHex(g) + toHex(b);
}

function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;
  if (max !== min) {
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
  return { h: h * 360, s, v };
}

function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const i = Math.floor((h / 60) % 6);
  const f = h / 60 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  let r = 0,
    g = 0,
    b = 0;
  switch (i) {
    case 0:
      r = v;
      g = t;
      b = p;
      break;
    case 1:
      r = q;
      g = v;
      b = p;
      break;
    case 2:
      r = p;
      g = v;
      b = t;
      break;
    case 3:
      r = p;
      g = q;
      b = v;
      break;
    case 4:
      r = t;
      g = p;
      b = v;
      break;
    case 5:
      r = v;
      g = p;
      b = q;
      break;
  }
  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

function hsvToHex(h: number, s: number, v: number): string {
  const { r, g, b } = hsvToRgb(h, s, v);
  return rgbToHex(r, g, b);
}

const PRESET_PALETTES = [
  '#2563eb', // Blue
  '#3b82f6', // Light Blue
  '#0284c7', // Sky
  '#0891b2', // Cyan
  '#7c3aed', // Purple
  '#8b5cf6', // Violet
  '#a855f7', // Fushia
  '#ec4899', // Pink
  '#f43f5e', // Rose
  '#ef4444', // Red
  '#ea580c', // Orange
  '#f59e0b', // Amber
  '#10b981', // Emerald
  '#059669', // Green
  '#14b8a6', // Teal
  '#84cc16', // Lime
  '#475569', // Slate
  '#1e293b', // Dark
];

export const ColorPickerPopover: React.FC<ColorPickerPopoverProps> = ({
  color,
  onChange,
  isOpen,
  onClose,
  anchorRef,
}) => {
  const popoverRef = useRef<HTMLDivElement>(null);
  const satValRef = useRef<HTMLDivElement>(null);
  const isDraggingSatVal = useRef(false);

  // Internal HSV state
  const [hue, setHue] = useState(220);
  const [sat, setSat] = useState(0.85);
  const [val, setVal] = useState(0.9);

  // Text inputs
  const [hexInput, setHexInput] = useState(color);
  const [inputMode, setInputMode] = useState<'hex' | 'rgb'>('hex');

  const [coords, setCoords] = useState<{ top?: number; bottom?: number; left?: number }>({});

  // Sync internal HSV when incoming color prop changes
  useEffect(() => {
    if (!color) return;
    const cleanHex = color.startsWith('#') ? color : `#${color}`;
    setHexInput(cleanHex.toUpperCase());
    const rgb = hexToRgb(cleanHex);
    const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
    if (!isNaN(hsv.h)) setHue(hsv.h);
    setSat(hsv.s);
    setVal(hsv.v);
  }, [color]);

  // Position calculation
  const updatePosition = useCallback(() => {
    if (!anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();

    const popoverWidth = 280;
    const popoverHeight = 360;

    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    const openUpward = spaceBelow < popoverHeight && spaceAbove > spaceBelow;

    let top: number | undefined;
    let bottom: number | undefined;

    if (openUpward) {
      bottom = window.innerHeight - rect.top + 8;
    } else {
      top = rect.bottom + 8;
    }

    let left = rect.left;
    if (left + popoverWidth > window.innerWidth - 12) {
      left = window.innerWidth - popoverWidth - 12;
    }
    if (left < 12) {
      left = 12;
    }

    setCoords({ top, bottom, left });
  }, [anchorRef]);

  useEffect(() => {
    if (!isOpen) return;
    updatePosition();

    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        anchorRef.current &&
        !anchorRef.current.contains(target) &&
        popoverRef.current &&
        !popoverRef.current.contains(target)
      ) {
        onClose();
      }
    };

    const handleScrollOrResize = () => {
      updatePosition();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
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
  }, [isOpen, onClose, updatePosition, anchorRef]);

  // 2D Saturation / Value interactive dragging
  const updateSatValFromPointer = (clientX: number, clientY: number) => {
    if (!satValRef.current) return;
    const rect = satValRef.current.getBoundingClientRect();
    const x = Math.min(Math.max(0, clientX - rect.left), rect.width);
    const y = Math.min(Math.max(0, clientY - rect.top), rect.height);
    const newSat = x / rect.width;
    const newVal = 1 - y / rect.height;

    setSat(newSat);
    setVal(newVal);

    const newHex = hsvToHex(hue, newSat, newVal);
    onChange(newHex);
  };

  const handleSatValMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingSatVal.current = true;
    updateSatValFromPointer(e.clientX, e.clientY);

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (isDraggingSatVal.current) {
        updateSatValFromPointer(moveEvent.clientX, moveEvent.clientY);
      }
    };

    const onMouseUp = () => {
      isDraggingSatVal.current = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleSatValTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 0) return;
    isDraggingSatVal.current = true;
    updateSatValFromPointer(e.touches[0].clientX, e.touches[0].clientY);

    const onTouchMove = (moveEvent: TouchEvent) => {
      if (isDraggingSatVal.current && moveEvent.touches.length > 0) {
        updateSatValFromPointer(moveEvent.touches[0].clientX, moveEvent.touches[0].clientY);
      }
    };

    const onTouchEnd = () => {
      isDraggingSatVal.current = false;
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };

    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('touchend', onTouchEnd);
  };

  // Hue slider
  const handleHueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newHue = Number(e.target.value);
    setHue(newHue);
    const newHex = hsvToHex(newHue, sat, val);
    onChange(newHex);
  };

  // Hex text input
  const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let text = e.target.value.trim();
    if (!text.startsWith('#')) text = '#' + text;
    setHexInput(text);
    if (/^#[0-9A-Fa-f]{6}$/.test(text)) {
      onChange(text);
    }
  };

  // RGB text inputs
  const currentRgb = hexToRgb(color);

  const handleRgbChange = (channel: 'r' | 'g' | 'b', valStr: string) => {
    const num = Math.min(255, Math.max(0, parseInt(valStr) || 0));
    const newRgb = { ...currentRgb, [channel]: num };
    const newHex = rgbToHex(newRgb.r, newRgb.g, newRgb.b);
    onChange(newHex);
  };

  // Native EyeDropper API (Chromium / Edge / Opera)
  const hasEyeDropper = typeof window !== 'undefined' && 'EyeDropper' in window;

  const handleEyeDropper = async () => {
    if (!hasEyeDropper) return;
    try {
      const eyeDropper = new (window as any).EyeDropper();
      const result = await eyeDropper.open();
      if (result && result.sRGBHex) {
        onChange(result.sRGBHex.toLowerCase());
      }
    } catch {
      // User cancelled
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      ref={popoverRef}
      style={{
        position: 'fixed',
        top: coords.top !== undefined ? `${coords.top}px` : undefined,
        bottom: coords.bottom !== undefined ? `${coords.bottom}px` : undefined,
        left: coords.left !== undefined ? `${coords.left}px` : undefined,
        width: '280px',
        zIndex: 999999,
      }}
      className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-700/80 shadow-2xl shadow-slate-900/25 dark:shadow-black/80 overflow-hidden flex flex-col p-3 space-y-3 animate-in fade-in zoom-in-95 duration-100 select-none text-slate-800 dark:text-slate-100"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Popover Header */}
      <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
          Color Accent
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 2D Saturation / Value Gradient Canvas */}
      <div
        ref={satValRef}
        onMouseDown={handleSatValMouseDown}
        onTouchStart={handleSatValTouchStart}
        style={{
          backgroundColor: `hsl(${hue}, 100%, 50%)`,
        }}
        className="w-full h-32 rounded-xl relative cursor-crosshair overflow-hidden shadow-inner"
      >
        {/* White horizontal gradient (saturation) */}
        <div className="absolute inset-0 bg-gradient-to-r from-white to-transparent pointer-events-none" />
        {/* Black vertical gradient (brightness/value) */}
        <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent pointer-events-none" />

        {/* Draggable Selector Thumb */}
        <div
          style={{
            left: `${sat * 100}%`,
            top: `${(1 - val) * 100}%`,
            backgroundColor: color,
          }}
          className="absolute w-4 h-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md pointer-events-none ring-1 ring-black/30"
        />
      </div>

      {/* Rainbow Hue Slider & Eyedropper Controls */}
      <div className="flex items-center gap-2.5">
        {hasEyeDropper && (
          <button
            type="button"
            onClick={handleEyeDropper}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer shadow-2xs"
            title="Pick color from screen (Eyedropper)"
          >
            <Pipette className="w-4 h-4" />
          </button>
        )}

        {/* Current Color Preview Swatch */}
        <div
          style={{ backgroundColor: color }}
          className="w-7 h-7 rounded-full border-2 border-white dark:border-slate-800 shadow-xs shrink-0"
        />

        {/* Hue Range Slider */}
        <div className="flex-1 relative flex items-center">
          <input
            type="range"
            min={0}
            max={360}
            value={hue}
            onChange={handleHueChange}
            className="w-full h-3.5 rounded-full appearance-none cursor-pointer focus:outline-hidden"
            style={{
              background:
                'linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)',
            }}
          />
        </div>
      </div>

      {/* Formatted Values (HEX / RGB) */}
      <div className="flex items-center gap-2 pt-0.5">
        <div className="flex-1">
          {inputMode === 'hex' ? (
            <div className="relative flex items-center">
              <span className="absolute left-2.5 text-xs text-slate-400 font-mono font-bold">#</span>
              <input
                type="text"
                value={hexInput.replace('#', '')}
                onChange={handleHexChange}
                maxLength={6}
                className="w-full pl-6 pr-2.5 py-1.5 text-xs font-mono font-semibold uppercase rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:bg-white dark:focus:bg-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1.5 text-center">
              <div>
                <input
                  type="number"
                  min={0}
                  max={255}
                  value={currentRgb.r}
                  onChange={(e) => handleRgbChange('r', e.target.value)}
                  className="w-full py-1 text-xs font-mono font-semibold text-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/30"
                />
                <span className="text-3xs text-slate-400 font-semibold block mt-0.5">R</span>
              </div>
              <div>
                <input
                  type="number"
                  min={0}
                  max={255}
                  value={currentRgb.g}
                  onChange={(e) => handleRgbChange('g', e.target.value)}
                  className="w-full py-1 text-xs font-mono font-semibold text-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/30"
                />
                <span className="text-3xs text-slate-400 font-semibold block mt-0.5">G</span>
              </div>
              <div>
                <input
                  type="number"
                  min={0}
                  max={255}
                  value={currentRgb.b}
                  onChange={(e) => handleRgbChange('b', e.target.value)}
                  className="w-full py-1 text-xs font-mono font-semibold text-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/30"
                />
                <span className="text-3xs text-slate-400 font-semibold block mt-0.5">B</span>
              </div>
            </div>
          )}
        </div>

        {/* Toggle Mode Button (HEX / RGB) */}
        <button
          type="button"
          onClick={() => setInputMode((prev) => (prev === 'hex' ? 'rgb' : 'hex'))}
          className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-3xs font-bold text-slate-600 dark:text-slate-300 transition-colors cursor-pointer flex items-center gap-1 shrink-0 uppercase"
          title="Switch color mode (HEX / RGB)"
        >
          <ArrowLeftRight className="w-2.5 h-2.5" />
          <span>{inputMode}</span>
        </button>
      </div>

      {/* Preset Swatches Palette */}
      <div className="pt-1 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
        <span className="text-3xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
          Preset Palettes
        </span>
        <div className="grid grid-cols-6 gap-1.5">
          {PRESET_PALETTES.map((preset) => {
            const isSelected = color.toLowerCase() === preset.toLowerCase();
            return (
              <button
                key={preset}
                type="button"
                onClick={() => onChange(preset)}
                style={{ backgroundColor: preset }}
                className={`w-6.5 h-6.5 rounded-lg transition-transform cursor-pointer flex items-center justify-center text-white shadow-2xs ${
                  isSelected
                    ? 'scale-110 ring-2 ring-blue-500 ring-offset-1 dark:ring-offset-slate-900'
                    : 'hover:scale-105 opacity-90 hover:opacity-100'
                }`}
                title={preset}
              >
                {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Done Button */}
      <div className="pt-1">
        <button
          type="button"
          onClick={onClose}
          className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer text-center"
        >
          Apply Color
        </button>
      </div>
    </div>,
    document.body
  );
};

