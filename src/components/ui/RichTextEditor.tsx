import React, { useRef, useState } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Quote,
  Code,
  Eye,
  PenLine,
} from 'lucide-react';
import { FormattedText } from './FormattedText';

interface RichTextEditorProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  disabled?: boolean;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  id,
  value,
  onChange,
  placeholder = 'Write formatted text...',
  className = '',
  disabled = false,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [activeTab, setActiveTab] = useState<'write' | 'preview'>('write');

  const applyFormat = (
    formatType: 'bold' | 'italic' | 'underline' | 'strikethrough' | 'quote' | 'code'
  ) => {
    if (disabled) return;
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Switch to write tab if currently previewing
    if (activeTab === 'preview') {
      setActiveTab('write');
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);

    let prefix = '';
    let suffix = '';
    let defaultPlaceholder = '';

    switch (formatType) {
      case 'bold':
        prefix = '**';
        suffix = '**';
        defaultPlaceholder = 'bold text';
        break;
      case 'italic':
        prefix = '*';
        suffix = '*';
        defaultPlaceholder = 'italic text';
        break;
      case 'underline':
        prefix = '<u>';
        suffix = '</u>';
        defaultPlaceholder = 'underlined text';
        break;
      case 'strikethrough':
        prefix = '~~';
        suffix = '~~';
        defaultPlaceholder = 'strikethrough text';
        break;
      case 'quote':
        if (selectedText) {
          const quoted = selectedText
            .split('\n')
            .map((line) => (line.startsWith('> ') ? line : `> ${line}`))
            .join('\n');
          const newValue = value.substring(0, start) + quoted + value.substring(end);
          onChange(newValue);
          setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(start, start + quoted.length);
          }, 0);
          return;
        } else {
          const needsNewline = start > 0 && value[start - 1] !== '\n';
          const insertText = `${needsNewline ? '\n' : ''}> quote text`;
          const newValue = value.substring(0, start) + insertText + value.substring(end);
          onChange(newValue);
          const cursorStart = start + (needsNewline ? 1 : 0) + 2;
          const cursorEnd = cursorStart + 'quote text'.length;
          setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(cursorStart, cursorEnd);
          }, 0);
          return;
        }
      case 'code':
        prefix = '`';
        suffix = '`';
        defaultPlaceholder = 'code';
        break;
    }

    if (selectedText.length > 0) {
      const newText = prefix + selectedText + suffix;
      const newValue = value.substring(0, start) + newText + value.substring(end);
      onChange(newValue);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + prefix.length, end + prefix.length);
      }, 0);
    } else {
      const newText = prefix + defaultPlaceholder + suffix;
      const newValue = value.substring(0, start) + newText + value.substring(end);
      onChange(newValue);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(
          start + prefix.length,
          start + prefix.length + defaultPlaceholder.length
        );
      }, 0);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      if (e.key.toLowerCase() === 'b') {
        e.preventDefault();
        applyFormat('bold');
      } else if (e.key.toLowerCase() === 'i') {
        e.preventDefault();
        applyFormat('italic');
      } else if (e.key.toLowerCase() === 'u') {
        e.preventDefault();
        applyFormat('underline');
      }
    }
  };

  const lineCount = value ? value.split('\n').length : 0;

  return (
    <div
      className={`w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/90 shadow-2xs overflow-hidden focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all ${className}`}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 gap-2 flex-wrap">
        {/* Formatting actions */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => applyFormat('bold')}
            disabled={disabled}
            title="Bold (Ctrl+B) - **bold**"
            className="p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-700 transition-colors cursor-pointer disabled:opacity-50"
          >
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => applyFormat('italic')}
            disabled={disabled}
            title="Italic (Ctrl+I) - *italic*"
            className="p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-700 transition-colors cursor-pointer disabled:opacity-50"
          >
            <Italic className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => applyFormat('underline')}
            disabled={disabled}
            title="Underline (Ctrl+U) - <u>underline</u>"
            className="p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-700 transition-colors cursor-pointer disabled:opacity-50"
          >
            <Underline className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => applyFormat('strikethrough')}
            disabled={disabled}
            title="Strikethrough - ~~strikethrough~~"
            className="p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-700 transition-colors cursor-pointer disabled:opacity-50"
          >
            <Strikethrough className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => applyFormat('quote')}
            disabled={disabled}
            title="Quote - > quote"
            className="p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-700 transition-colors cursor-pointer disabled:opacity-50"
          >
            <Quote className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => applyFormat('code')}
            disabled={disabled}
            title="Monospace - `code`"
            className="p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-700 transition-colors cursor-pointer disabled:opacity-50"
          >
            <Code className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* View Toggle Tabs */}
        <div className="flex items-center gap-1 bg-slate-200/70 dark:bg-slate-700/60 p-0.5 rounded-md text-2xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('write')}
            className={`px-2 py-1 rounded transition-colors flex items-center gap-1 cursor-pointer ${
              activeTab === 'write'
                ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <PenLine className="w-3 h-3" />
            <span>Write</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`px-2 py-1 rounded transition-colors flex items-center gap-1 cursor-pointer ${
              activeTab === 'preview'
                ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Eye className="w-3 h-3" />
            <span>Preview</span>
          </button>
        </div>
      </div>

      {/* Editor Body - Exactly 10 lines height (~240px) with vertical scroll beyond 10 lines */}
      <div className="relative">
        {activeTab === 'write' ? (
          <textarea
            ref={textareaRef}
            id={id}
            rows={10}
            disabled={disabled}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="w-full h-[240px] min-h-[240px] max-h-[240px] p-3 text-xs sm:text-sm bg-transparent text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-hidden resize-none leading-relaxed overflow-y-auto block"
          />
        ) : (
          <div className="w-full h-[240px] min-h-[240px] max-h-[240px] p-3 text-xs sm:text-sm overflow-y-auto leading-relaxed bg-slate-50/50 dark:bg-slate-900/30">
            <FormattedText
              content={value}
              placeholder="Nothing to preview yet. Switch to 'Write' to enter text."
            />
          </div>
        )}
      </div>

      {/* Helper Footer Strip */}
      <div className="flex items-center justify-between px-3 py-1 bg-slate-50/70 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-700/60 text-2xs text-slate-400 dark:text-slate-500 select-none">
        <span className="truncate mr-2">
          Markdown: <b>**bold**</b>, <i>*italic*</i>, <u>&lt;u&gt;underline&lt;/u&gt;</u>, <del>~~strike~~</del>, &gt; quote, <code className="font-mono text-2xs">`code`</code>
        </span>
        <span className="shrink-0 font-medium">
          {lineCount} {lineCount === 1 ? 'line' : 'lines'} (scrolls after 10)
        </span>
      </div>
    </div>
  );
};
