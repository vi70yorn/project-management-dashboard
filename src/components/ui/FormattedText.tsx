import React from 'react';

interface FormattedTextProps {
  content?: string;
  className?: string;
  placeholder?: string;
}

const renderInline = (text: string, keyPrefix: string = ''): React.ReactNode[] => {
  const pattern = /(<u>[\s\S]*?<\/u>|\*\*[^*]+?\*\*|~~[^~]+?~~|`[^`]+`|\*[^*]+?\*)/g;
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(
        <span key={`${keyPrefix}-t-${index++}`}>
          {text.slice(lastIndex, match.index)}
        </span>
      );
    }
    const token = match[0];
    const itemKey = `${keyPrefix}-m-${index++}`;

    if (token.startsWith('<u>') && token.endsWith('</u>')) {
      const inner = token.slice(3, -4);
      nodes.push(
        <span key={itemKey} className="underline underline-offset-2 decoration-slate-400 dark:decoration-slate-500">
          {renderInline(inner, itemKey)}
        </span>
      );
    } else if (token.startsWith('**') && token.endsWith('**')) {
      const inner = token.slice(2, -2);
      nodes.push(
        <strong key={itemKey} className="font-semibold text-slate-900 dark:text-white">
          {renderInline(inner, itemKey)}
        </strong>
      );
    } else if (token.startsWith('~~') && token.endsWith('~~')) {
      const inner = token.slice(2, -2);
      nodes.push(
        <del key={itemKey} className="line-through text-slate-400 dark:text-slate-500">
          {renderInline(inner, itemKey)}
        </del>
      );
    } else if (token.startsWith('`') && token.endsWith('`')) {
      const inner = token.slice(1, -1);
      nodes.push(
        <code
          key={itemKey}
          className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400 font-mono text-[0.85em] border border-slate-200/80 dark:border-slate-700 shadow-2xs"
        >
          {inner}
        </code>
      );
    } else if (token.startsWith('*') && token.endsWith('*')) {
      const inner = token.slice(1, -1);
      nodes.push(
        <em key={itemKey} className="italic">
          {renderInline(inner, itemKey)}
        </em>
      );
    }
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(
      <span key={`${keyPrefix}-t-${index++}`}>
        {text.slice(lastIndex)}
      </span>
    );
  }

  return nodes;
};

interface LineGroup {
  type: 'paragraph' | 'quote';
  lines: string[];
}

export const FormattedText: React.FC<FormattedTextProps> = ({
  content,
  className = '',
  placeholder,
}) => {
  if (!content || !content.trim()) {
    if (placeholder) {
      return (
        <p className={`text-slate-400 dark:text-slate-500 italic ${className}`}>
          {placeholder}
        </p>
      );
    }
    return null;
  }

  const lines = content.split('\n');
  const groups: LineGroup[] = [];
  let currentGroup: LineGroup | null = null;

  for (const line of lines) {
    const isQuote = line.startsWith('> ') || line === '>';
    const cleanLine = isQuote ? line.replace(/^>\s?/, '') : line;

    if (isQuote) {
      if (currentGroup && currentGroup.type === 'quote') {
        currentGroup.lines.push(cleanLine);
      } else {
        if (currentGroup) groups.push(currentGroup);
        currentGroup = { type: 'quote', lines: [cleanLine] };
      }
    } else {
      if (currentGroup && currentGroup.type === 'paragraph') {
        currentGroup.lines.push(line);
      } else {
        if (currentGroup) groups.push(currentGroup);
        currentGroup = { type: 'paragraph', lines: [line] };
      }
    }
  }
  if (currentGroup) groups.push(currentGroup);

  return (
    <div className={`space-y-2 ${className}`}>
      {groups.map((group, gIdx) => {
        if (group.type === 'quote') {
          return (
            <blockquote
              key={gIdx}
              className="border-l-3 border-blue-500/80 dark:border-blue-400 pl-3 py-1 bg-blue-50/40 dark:bg-blue-950/20 rounded-r-md text-slate-700 dark:text-slate-300 italic space-y-0.5"
            >
              {group.lines.map((l, lIdx) => (
                <div key={lIdx} className="min-h-[1.25rem] break-words">
                  {l ? renderInline(l, `q-${gIdx}-${lIdx}`) : <span className="inline-block h-3" />}
                </div>
              ))}
            </blockquote>
          );
        }

        return (
          <div key={gIdx} className="space-y-0.5">
            {group.lines.map((l, lIdx) => (
              <div key={lIdx} className="min-h-[1.25rem] break-words">
                {l ? renderInline(l, `p-${gIdx}-${lIdx}`) : <span className="inline-block h-3" />}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
};

