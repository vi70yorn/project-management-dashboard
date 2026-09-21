import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Quote,
  Code,
} from 'lucide-react';

interface RichTextEditorProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  disabled?: boolean;
}

// Convert markdown to HTML for contentEditable display
const markdownToHtml = (md: string): string => {
  if (!md) return '';

  // If already contains block HTML tags, return as-is
  if (/<(div|p|blockquote|br)[^>]*>/i.test(md)) {
    return md;
  }

  // Handle markdown quotes (> line)
  const lines = md.split('\n');
  const processedLines: string[] = [];
  let inQuote = false;
  let quoteLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith('> ') || line === '>') {
      inQuote = true;
      quoteLines.push(line.replace(/^>\s?/, ''));
    } else {
      if (inQuote) {
        processedLines.push('<blockquote>' + quoteLines.join('<br>') + '</blockquote>');
        quoteLines = [];
        inQuote = false;
      }
      processedLines.push(line);
    }
  }
  if (inQuote) {
    processedLines.push('<blockquote>' + quoteLines.join('<br>') + '</blockquote>');
  }

  let html = processedLines.join('<br>');

  // Inline code: `code`
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Bold: **text**
  html = html.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  // Strikethrough: ~~text~~
  html = html.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  // Italic: *text*
  html = html.replace(/(^|[^*])\*([^*]+)\*([^*]|$)/g, '$1<i>$2</i>$3');

  return html;
};

// Convert contentEditable HTML back to clean Markdown
const htmlToMarkdown = (html: string): string => {
  if (!html) return '';

  // Check if visually empty
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  if (!tempDiv.textContent && !tempDiv.innerText) {
    return '';
  }

  let md = html;

  // Replace blockquotes
  md = md.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_match, p1) => {
    const textLines = p1
      .replace(/<div[^>]*>/gi, '\n')
      .replace(/<\/div>/gi, '')
      .replace(/<p[^>]*>/gi, '\n')
      .replace(/<\/p>/gi, '')
      .replace(/<br\s*[\/]?>/gi, '\n')
      .split('\n')
      .map((l: string) => l.trim())
      .filter((l: string) => l.length > 0);
    return '\n' + textLines.map((l: string) => '> ' + l).join('\n') + '\n';
  });

  // Protect <u> tags
  md = md.replace(/<u\b[^>]*>([\s\S]*?)<\/u>/gi, '@@U_START@@$1@@U_END@@');

  // Bold: <b>, <strong>
  md = md.replace(/<(b|strong)\b[^>]*>([\s\S]*?)<\/\1>/gi, '**$2**');

  // Italic: <i>, <em>
  md = md.replace(/<(i|em)\b[^>]*>([\s\S]*?)<\/\1>/gi, '*$2*');

  // Strikethrough: <del>, <s>, <strike>
  md = md.replace(/<(del|s|strike)\b[^>]*>([\s\S]*?)<\/\1>/gi, '~~$2~~');

  // Code: <code>
  md = md.replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, '`$1`');

  // Handle newlines from divs and paragraphs
  md = md.replace(/<br\s*[\/]?>/gi, '\n');
  md = md.replace(/<\/div>/gi, '\n');
  md = md.replace(/<div[^>]*>/gi, '');
  md = md.replace(/<\/p>/gi, '\n\n');
  md = md.replace(/<p[^>]*>/gi, '');

  // Strip remaining HTML tags
  md = md.replace(/<[^>]+>/g, '');

  // Restore <u> tags
  md = md.replace(/@@U_START@@/g, '<u>').replace(/@@U_END@@/g, '</u>');

  // Decode HTML entities
  md = md
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');

  // Normalize excessive newlines
  md = md.replace(/\n{3,}/g, '\n\n');

  return md.trim();
};

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  id,
  value,
  onChange,
  placeholder = 'Write formatted text...',
  className = '',
  disabled = false,
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastValueRef = useRef(value);

  const [activeFormats, setActiveFormats] = useState({
    bold: false,
    italic: false,
    underline: false,
    strikethrough: false,
    quote: false,
    code: false,
  });

  const updateActiveFormats = useCallback(() => {
    if (disabled || !editorRef.current) return;

    let isBold = false;
    let isItalic = false;
    let isUnderline = false;
    let isStrike = false;

    try {
      isBold = document.queryCommandState('bold');
      isItalic = document.queryCommandState('italic');
      isUnderline = document.queryCommandState('underline');
      isStrike = document.queryCommandState('strikeThrough');
    } catch {
      // ignore if queryCommandState is unavailable
    }

    let inQuote = false;
    let inCode = false;

    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && editorRef.current) {
      let node: Node | null = selection.anchorNode;
      while (node && node !== editorRef.current) {
        if (node.nodeName === 'BLOCKQUOTE') inQuote = true;
        if (node.nodeName === 'CODE') inCode = true;
        node = node.parentNode;
      }
    }

    setActiveFormats({
      bold: isBold,
      italic: isItalic,
      underline: isUnderline,
      strikethrough: isStrike,
      quote: inQuote,
      code: inCode,
    });
  }, [disabled]);

  // Synchronize incoming value if changed externally
  useEffect(() => {
    if (editorRef.current && value !== lastValueRef.current) {
      lastValueRef.current = value;
      editorRef.current.innerHTML = markdownToHtml(value);
      updateActiveFormats();
    }
  }, [value, updateActiveFormats]);

  // Mount initialization
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = markdownToHtml(value);
      lastValueRef.current = value;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleInput = () => {
    if (!editorRef.current) return;
    const rawHtml = editorRef.current.innerHTML;
    const md = htmlToMarkdown(rawHtml);
    lastValueRef.current = md;
    onChange(md);
    updateActiveFormats();
  };

  const applyFormat = (type: 'bold' | 'italic' | 'underline' | 'strikethrough' | 'quote' | 'code') => {
    if (disabled || !editorRef.current) return;
    editorRef.current.focus();

    if (type === 'bold') {
      document.execCommand('bold', false);
    } else if (type === 'italic') {
      document.execCommand('italic', false);
    } else if (type === 'underline') {
      document.execCommand('underline', false);
    } else if (type === 'strikethrough') {
      document.execCommand('strikeThrough', false);
    } else if (type === 'quote') {
      const selection = window.getSelection();
      let inBlockquote = false;
      if (selection && selection.rangeCount > 0) {
        let node: Node | null = selection.anchorNode;
        while (node && node !== editorRef.current) {
          if (node.nodeName === 'BLOCKQUOTE') {
            inBlockquote = true;
            break;
          }
          node = node.parentNode;
        }
      }

      if (inBlockquote) {
        document.execCommand('formatBlock', false, '<div>');
      } else {
        document.execCommand('formatBlock', false, '<blockquote>');
      }
    } else if (type === 'code') {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        let node: Node | null = selection.anchorNode;
        let codeNode: HTMLElement | null = null;
        while (node && node !== editorRef.current) {
          if (node.nodeName === 'CODE') {
            codeNode = node as HTMLElement;
            break;
          }
          node = node.parentNode;
        }

        if (codeNode) {
          const parent = codeNode.parentNode;
          if (parent) {
            while (codeNode.firstChild) {
              parent.insertBefore(codeNode.firstChild, codeNode);
            }
            parent.removeChild(codeNode);
          }
        } else {
          const range = selection.getRangeAt(0);
          if (range.collapsed) {
            const codeEl = document.createElement('code');
            codeEl.textContent = 'code';
            range.insertNode(codeEl);
            const newRange = document.createRange();
            newRange.selectNodeContents(codeEl);
            selection.removeAllRanges();
            selection.addRange(newRange);
          } else {
            const fragment = range.extractContents();
            const codeEl = document.createElement('code');
            codeEl.appendChild(fragment);
            range.insertNode(codeEl);
          }
        }
      }
    }

    handleInput();
  };

  const isEditorEmpty = !value || value.trim() === '';

  return (
    <div
      className={`w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/90 shadow-2xs overflow-hidden focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all ${className}`}
    >
      {/* WYSIWYG Toolbar */}
      <div className="flex items-center justify-between px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 gap-2 flex-wrap">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyFormat('bold')}
            disabled={disabled}
            title="Bold (Ctrl+B)"
            className={`p-1.5 rounded-md transition-colors cursor-pointer disabled:opacity-50 ${
              activeFormats.bold
                ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300 font-bold'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-700'
            }`}
          >
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyFormat('italic')}
            disabled={disabled}
            title="Italic (Ctrl+I)"
            className={`p-1.5 rounded-md transition-colors cursor-pointer disabled:opacity-50 ${
              activeFormats.italic
                ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-700'
            }`}
          >
            <Italic className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyFormat('underline')}
            disabled={disabled}
            title="Underline (Ctrl+U)"
            className={`p-1.5 rounded-md transition-colors cursor-pointer disabled:opacity-50 ${
              activeFormats.underline
                ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-700'
            }`}
          >
            <Underline className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyFormat('strikethrough')}
            disabled={disabled}
            title="Strikethrough"
            className={`p-1.5 rounded-md transition-colors cursor-pointer disabled:opacity-50 ${
              activeFormats.strikethrough
                ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-700'
            }`}
          >
            <Strikethrough className="w-3.5 h-3.5" />
          </button>
          <div className="w-[1px] h-4 bg-slate-200 dark:bg-slate-700 mx-0.5" />
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyFormat('quote')}
            disabled={disabled}
            title="Quote"
            className={`p-1.5 rounded-md transition-colors cursor-pointer disabled:opacity-50 ${
              activeFormats.quote
                ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-700'
            }`}
          >
            <Quote className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyFormat('code')}
            disabled={disabled}
            title="Inline code"
            className={`p-1.5 rounded-md transition-colors cursor-pointer disabled:opacity-50 ${
              activeFormats.code
                ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-700'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Editor Body - Instant Visual WYSIWYG */}
      <div className="relative">
        {isEditorEmpty && (
          <div className="absolute top-3 left-3 text-xs sm:text-sm text-slate-400 dark:text-slate-500 pointer-events-none select-none">
            {placeholder}
          </div>
        )}
        <div
          ref={editorRef}
          id={id}
          contentEditable={!disabled}
          onInput={handleInput}
          onBlur={handleInput}
          onKeyUp={updateActiveFormats}
          onMouseUp={updateActiveFormats}
          onSelect={updateActiveFormats}
          className="w-full h-[240px] min-h-[240px] max-h-[240px] p-3 text-xs sm:text-sm bg-transparent text-slate-800 dark:text-slate-100 focus:outline-hidden overflow-y-auto leading-relaxed block [&_blockquote]:border-l-3 [&_blockquote]:border-blue-500 [&_blockquote]:pl-3 [&_blockquote]:py-1 [&_blockquote]:my-1.5 [&_blockquote]:bg-blue-50/40 dark:[&_blockquote]:bg-blue-950/20 [&_blockquote]:italic [&_blockquote]:rounded-r-md [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded-md [&_code]:bg-slate-100 dark:[&_code]:bg-slate-800 [&_code]:text-blue-600 dark:[&_code]:text-blue-400 [&_code]:font-mono [&_code]:text-[0.85em] [&_code]:border [&_code]:border-slate-200/80 dark:[&_code]:border-slate-700 [&_b]:font-semibold [&_b]:text-slate-900 dark:[&_b]:text-white [&_strong]:font-semibold [&_strong]:text-slate-900 dark:[&_strong]:text-white [&_u]:underline [&_u]:underline-offset-2 [&_u]:decoration-slate-400 dark:[&_u]:decoration-slate-500 [&_del]:line-through [&_del]:text-slate-400 dark:[&_del]:text-slate-500 [&_s]:line-through [&_s]:text-slate-400 dark:[&_s]:text-slate-500 [&_strike]:line-through [&_strike]:text-slate-400 dark:[&_strike]:text-slate-500"
        />
      </div>
    </div>
  );
};
