import React, { useState } from 'react';
import {
  Link2,
  Plus,
  ExternalLink,
  Copy,
  Check,
  Trash2,
  AlertCircle,
  Globe,
  Sparkles,
} from 'lucide-react';
import { AttachedLink } from '../types';
import {
  normalizeUrl,
  isValidUrl,
  detectPlatform,
  suggestTitle,
  extractHostname,
  PlatformLogo,
} from '../utils/linkUtils';

export interface LinkAttachmentManagerProps {
  links?: AttachedLink[];
  onChange?: (links: AttachedLink[]) => void;
  readOnly?: boolean;
  className?: string;
  titleLabel?: string;
}

export const LinkAttachmentManager: React.FC<LinkAttachmentManagerProps> = ({
  links = [],
  onChange,
  readOnly = false,
  className = '',
  titleLabel = 'Attached Links',
}) => {
  const [urlInput, setUrlInput] = useState('');
  const [titleInput, setTitleInput] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Live detection as user types or pastes
  const liveMeta = urlInput.trim() ? detectPlatform(urlInput) : null;
  const liveSuggestedTitle = (urlInput.trim() && liveMeta) ? suggestTitle(urlInput, liveMeta) : '';

  const handleAddLink = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) {
      setErrorMessage('Please enter a link URL');
      return;
    }

    if (!isValidUrl(trimmed)) {
      setErrorMessage('Please enter a valid URL (e.g. https://...)');
      return;
    }

    const cleanUrl = normalizeUrl(trimmed);
    const meta = detectPlatform(cleanUrl);
    const finalTitle = titleInput.trim() || suggestTitle(cleanUrl, meta) || extractHostname(cleanUrl);

    const newLink: AttachedLink = {
      id: `link-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      url: cleanUrl,
      title: finalTitle,
      platform: meta.id,
      createdAt: new Date().toISOString(),
    };

    if (onChange) {
      onChange([...links, newLink]);
    }

    setUrlInput('');
    setTitleInput('');
    setErrorMessage(null);
  };

  const handleRemoveLink = (id: string) => {
    if (onChange) {
      onChange(links.filter((item) => item.id !== id));
    }
  };

  const handleCopyLink = async (id: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch (err) {
      console.warn('Failed to copy to clipboard', err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddLink();
    }
  };

  // If readOnly and no links, don't occupy unnecessary space
  if (readOnly && links.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-2.5 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-200/60 dark:border-blue-800/60">
            <Link2 className="w-3.5 h-3.5" />
          </div>
          <label className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
            {titleLabel}
          </label>
          {links.length > 0 && (
            <span className="px-2 py-0.5 text-3xs font-bold rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              {links.length}
            </span>
          )}
        </div>

        {!readOnly && (
          <div className="hidden sm:flex items-center gap-1.5 text-3xs text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700">
              🔴 YouTube
            </span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700">
              🎨 Figma
            </span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700">
              📁 Drive / Docs
            </span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700">
              🐙 GitHub
            </span>
          </div>
        )}
      </div>

      {/* Redesigned Unified Smart Input Bar (Edit Mode Only) */}
      {!readOnly && (
        <div className="space-y-1.5">
          <div
            className={`flex flex-col sm:flex-row items-stretch rounded-xl border transition-all shadow-2xs overflow-hidden ${
              errorMessage
                ? 'border-red-400 dark:border-red-600 ring-2 ring-red-400/20'
                : 'border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900/90 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 dark:focus-within:border-blue-500'
            }`}
          >
            {/* URL Input Segment */}
            <div className="flex-1 flex items-center px-3 py-2 sm:py-2.5 min-w-0 bg-white dark:bg-slate-900">
              <div className="shrink-0 mr-2.5 flex items-center justify-center">
                {liveMeta ? (
                  <PlatformLogo platformId={liveMeta.id} url={urlInput} size={20} />
                ) : (
                  <Globe className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                )}
              </div>

              <input
                type="url"
                value={urlInput}
                onChange={(e) => {
                  setUrlInput(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Paste link (YouTube, Figma, Google Drive, Docs, GitHub...)"
                className="w-full bg-transparent text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none"
              />

              {/* Live Platform Badge */}
              {liveMeta && liveMeta.id !== 'general' && (
                <span
                  className={`shrink-0 ml-2 px-2 py-0.5 text-3xs font-bold rounded border ${liveMeta.bgLight} ${liveMeta.bgDark} ${liveMeta.badgeBorder}`}
                >
                  {liveMeta.label}
                </span>
              )}
            </div>

            {/* Vertical Divider */}
            <div className="hidden sm:block w-px bg-slate-200 dark:bg-slate-800 self-stretch" />

            {/* Custom Title Segment */}
            <div className="flex sm:w-56 items-center px-3 py-2 sm:py-2.5 border-t sm:border-t-0 border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50">
              <input
                type="text"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={liveSuggestedTitle ? `Title: ${liveSuggestedTitle}` : 'Title (optional)'}
                className="w-full bg-transparent text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none"
              />
            </div>

            {/* Add Button */}
            <button
              type="button"
              onClick={handleAddLink}
              disabled={!urlInput.trim()}
              className={`px-4 py-2 sm:py-2.5 flex items-center justify-center gap-1.5 text-xs font-bold shrink-0 transition-all cursor-pointer border-t sm:border-t-0 border-slate-200 dark:border-slate-800 ${
                urlInput.trim()
                  ? 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-2xs'
                  : 'bg-slate-100 dark:bg-slate-800/80 text-slate-400 dark:text-slate-500 cursor-not-allowed hover:bg-slate-100'
              }`}
            >
              <Plus className="w-4 h-4" />
              <span>Add</span>
              {urlInput.trim() && (
                <span className="hidden sm:inline text-3xs font-mono opacity-80 ml-0.5">⏎</span>
              )}
            </button>
          </div>

          {/* Validation Error Message */}
          {errorMessage && (
            <div className="flex items-center gap-1.5 px-2 text-xs text-rose-600 dark:text-rose-400">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>
      )}

      {/* List of Attached Links */}
      {links.length > 0 && (
        <div className="space-y-1.5">
          {links.map((link) => {
            const meta = detectPlatform(link.url);
            const hostname = extractHostname(link.url);
            const isCopied = copiedId === link.id;

            return (
              <div
                key={link.id}
                className="group flex items-center justify-between p-2.5 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900/80 hover:bg-slate-50/80 dark:hover:bg-slate-850/80 transition-all shadow-2xs"
              >
                {/* Left side: Platform Logo + Title + Hostname */}
                <div className="flex items-center gap-3 min-w-0 flex-1 mr-2">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 flex items-center justify-center shrink-0">
                    <PlatformLogo
                      platformId={link.platform || meta.id}
                      url={link.url}
                      size={20}
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {link.title || hostname}
                      </span>

                      {/* Platform Tag */}
                      <span
                        className={`inline-flex items-center px-1.5 py-0.2 text-3xs font-bold rounded border ${meta.bgLight} ${meta.bgDark} ${meta.badgeBorder} shrink-0`}
                      >
                        {meta.label}
                      </span>
                    </div>

                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-3xs sm:text-2xs text-slate-500 dark:text-slate-400 truncate block mt-0.5 hover:underline"
                    >
                      {link.url}
                    </a>
                  </div>
                </div>

                {/* Right side: Action Buttons */}
                <div className="flex items-center gap-1 shrink-0">
                  {/* Copy Button */}
                  <button
                    type="button"
                    onClick={() => handleCopyLink(link.id, link.url)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    title={isCopied ? 'Copied!' : 'Copy URL'}
                  >
                    {isCopied ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>

                  {/* Open Link Button */}
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors cursor-pointer"
                    title="Open link in new tab"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>

                  {/* Delete Button (Edit Mode Only) */}
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => handleRemoveLink(link.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                      title="Remove link"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
