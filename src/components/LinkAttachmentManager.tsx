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
  GripVertical,
  Edit2,
  X,
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

  // Edit Link State
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const [editUrlInput, setEditUrlInput] = useState('');
  const [editTitleInput, setEditTitleInput] = useState('');
  const [editErrorMessage, setEditErrorMessage] = useState<string | null>(null);

  // Drag-to-reorder State
  const [draggedLinkId, setDraggedLinkId] = useState<string | null>(null);
  const [dragOverLinkId, setDragOverLinkId] = useState<string | null>(null);

  // Live detection as user types or pastes in Add bar
  const liveMeta = urlInput.trim() ? detectPlatform(urlInput) : null;
  const liveSuggestedTitle = (urlInput.trim() && liveMeta) ? suggestTitle(urlInput, liveMeta) : '';

  // Live detection as user types in Edit form
  const editLiveMeta = editUrlInput.trim() ? detectPlatform(editUrlInput) : null;

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

  // Edit Link Handlers
  const handleStartEdit = (link: AttachedLink) => {
    setEditingLinkId(link.id);
    setEditUrlInput(link.url);
    setEditTitleInput(link.title || '');
    setEditErrorMessage(null);
  };

  const handleCancelEdit = () => {
    setEditingLinkId(null);
    setEditUrlInput('');
    setEditTitleInput('');
    setEditErrorMessage(null);
  };

  const handleSaveEdit = () => {
    if (!editingLinkId) return;
    const trimmed = editUrlInput.trim();
    if (!trimmed) {
      setEditErrorMessage('Please enter a link URL');
      return;
    }

    if (!isValidUrl(trimmed)) {
      setEditErrorMessage('Please enter a valid URL (e.g. https://...)');
      return;
    }

    const cleanUrl = normalizeUrl(trimmed);
    const meta = detectPlatform(cleanUrl);
    const finalTitle = editTitleInput.trim() || suggestTitle(cleanUrl, meta) || extractHostname(cleanUrl);

    if (onChange) {
      onChange(
        links.map((item) =>
          item.id === editingLinkId
            ? {
                ...item,
                url: cleanUrl,
                title: finalTitle,
                platform: meta.id,
              }
            : item
        )
      );
    }

    handleCancelEdit();
  };

  // Drag to Reorder Handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
    setDraggedLinkId(id);
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverLinkId !== id) {
      setDragOverLinkId(id);
    }
  };

  const handleDragEnd = () => {
    setDraggedLinkId(null);
    setDragOverLinkId(null);
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedLinkId || draggedLinkId === targetId) {
      handleDragEnd();
      return;
    }

    const sourceIndex = links.findIndex((item) => item.id === draggedLinkId);
    const targetIndex = links.findIndex((item) => item.id === targetId);

    if (sourceIndex !== -1 && targetIndex !== -1) {
      const updated = [...links];
      const [movedItem] = updated.splice(sourceIndex, 1);
      updated.splice(targetIndex, 0, movedItem);
      if (onChange) {
        onChange(updated);
      }
    }

    handleDragEnd();
  };

  // If readOnly and no links, don't occupy unnecessary space
  if (readOnly && links.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-2.5 ${className}`}>
      {/* Clean Header */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            {titleLabel}
          </label>
          {links.length > 0 && (
            <span className="text-3xs font-semibold px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200/80 dark:border-slate-700/80">
              {links.length}
            </span>
          )}
        </div>
      </div>

      {/* Clean Input Row (Edit Mode Only) */}
      {!readOnly && (
        <div className="space-y-1.5">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {/* URL Input */}
            <div className="relative flex-1 min-w-0">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none flex items-center">
                {liveMeta ? (
                  <PlatformLogo platformId={liveMeta.id} url={urlInput} size={16} />
                ) : (
                  <Link2 className="w-3.5 h-3.5" />
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
                placeholder="Paste link URL (e.g. Figma, GitHub, Docs)..."
                className={`w-full pl-9 ${
                  liveMeta && liveMeta.id !== 'general' ? 'pr-20' : 'pr-3'
                } py-2 bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-2xs`}
              />

              {/* Live Platform Badge */}
              {liveMeta && liveMeta.id !== 'general' && (
                <span
                  className={`absolute right-2.5 top-1/2 -translate-y-1/2 px-1.5 py-0.2 text-4xs font-bold rounded border ${liveMeta.bgLight} ${liveMeta.bgDark} ${liveMeta.badgeBorder}`}
                >
                  {liveMeta.label}
                </span>
              )}
            </div>

            {/* Custom Title Input */}
            <div className="w-full sm:w-44 shrink-0">
              <input
                type="text"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={liveSuggestedTitle ? `Title: ${liveSuggestedTitle}` : 'Title (optional)'}
                className="w-full px-3 py-2 bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-2xs"
              />
            </div>

            {/* Add Button */}
            <button
              type="button"
              onClick={handleAddLink}
              disabled={!urlInput.trim()}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shrink-0 select-none ${
                urlInput.trim()
                  ? 'bg-blue-600 hover:bg-blue-700 active:scale-95 text-white shadow-2xs cursor-pointer'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-200/80 dark:border-slate-700/80'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </div>

          {/* Validation Error Message */}
          {errorMessage && (
            <div className="flex items-center gap-1.5 px-1 text-xs text-rose-600 dark:text-rose-400">
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
            const isEditing = editingLinkId === link.id;
            const meta = detectPlatform(link.url);
            const hostname = extractHostname(link.url);
            const isCopied = copiedId === link.id;
            const isDragging = draggedLinkId === link.id;
            const isDragOver = dragOverLinkId === link.id && draggedLinkId !== link.id;

            if (isEditing) {
              return (
                <div
                  key={link.id}
                  id={`edit-link-card-${link.id}`}
                  className="p-3 rounded-xl border-2 border-blue-500 bg-white dark:bg-slate-900 shadow-md space-y-2.5 animate-in fade-in zoom-in-95 duration-100"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700">
                        {editLiveMeta ? (
                          <PlatformLogo platformId={editLiveMeta.id} url={editUrlInput} size={16} />
                        ) : (
                          <Globe className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                        )}
                      </div>
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        Edit Link
                      </span>
                      {editLiveMeta && editLiveMeta.id !== 'general' && (
                        <span
                          className={`px-1.5 py-0.2 text-3xs font-bold rounded border ${editLiveMeta.bgLight} ${editLiveMeta.bgDark} ${editLiveMeta.badgeBorder}`}
                        >
                          {editLiveMeta.label}
                        </span>
                      )}
                    </div>
                    <span className="text-3xs text-slate-400 dark:text-slate-500">
                      Enter to save &bull; Esc to cancel
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-3xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                        URL <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="url"
                        value={editUrlInput}
                        onChange={(e) => {
                          setEditUrlInput(e.target.value);
                          if (editErrorMessage) setEditErrorMessage(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSaveEdit();
                          } else if (e.key === 'Escape') {
                            e.preventDefault();
                            handleCancelEdit();
                          }
                        }}
                        autoFocus
                        placeholder="https://..."
                        className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-3xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                        Title (optional)
                      </label>
                      <input
                        type="text"
                        value={editTitleInput}
                        onChange={(e) => setEditTitleInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSaveEdit();
                          } else if (e.key === 'Escape') {
                            e.preventDefault();
                            handleCancelEdit();
                          }
                        }}
                        placeholder="Custom label or title"
                        className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {editErrorMessage && (
                    <div className="flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{editErrorMessage}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveEdit}
                      className="px-3 py-1 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Save</span>
                    </button>
                  </div>
                </div>
              );
            }

            const canDrag = !readOnly && links.length > 1;

            return (
              <div
                key={link.id}
                id={`link-item-${link.id}`}
                draggable={canDrag}
                onDragStart={(e) => handleDragStart(e, link.id)}
                onDragOver={(e) => handleDragOver(e, link.id)}
                onDragEnd={handleDragEnd}
                onDrop={(e) => handleDrop(e, link.id)}
                className={`group flex items-center justify-between p-2.5 rounded-xl border transition-all shadow-2xs select-none ${
                  isDragging
                    ? 'opacity-40 scale-[0.98] ring-2 ring-blue-400 border-blue-400'
                    : isDragOver
                    ? 'border-blue-400 dark:border-blue-500 bg-blue-50/70 dark:bg-blue-950/40 ring-2 ring-blue-300/60 dark:ring-blue-800/60'
                    : 'border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900/80 hover:bg-slate-50/80 dark:hover:bg-slate-850/80'
                }`}
              >
                {/* Left side: Drag Handle + Platform Logo + Title + Hostname */}
                <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
                  {canDrag && (
                    <div
                      className="text-slate-300 dark:text-slate-600 group-hover:text-slate-500 dark:group-hover:text-slate-400 cursor-grab active:cursor-grabbing p-0.5 -ml-1 rounded transition-colors shrink-0"
                      title="Drag to reorder"
                    >
                      <GripVertical className="w-3.5 h-3.5" />
                    </div>
                  )}

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

                  {/* Edit Button (Edit Mode Only) */}
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => handleStartEdit(link)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors cursor-pointer"
                      title="Edit link title and URL"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}

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
