import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Send,
  Sparkles,
  Bot,
  User,
  Trash2,
  Copy,
  Check,
  Settings,
  Loader2,
  HelpCircle,
  Clock,
  Layers,
  AlertOctagon,
  ArrowRight,
} from 'lucide-react';
import { Project, Task, TeamMember, AuthUser } from '../types';
import { chatWithCopilotApi, ChatHistoryItem } from '../services/aiApi';
import { FormattedText } from './ui/FormattedText';

interface AICopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  tasks: Task[];
  teamMembers: TeamMember[];
  currentUser?: AuthUser | null;
  onOpenAISettings?: () => void;
  onShowToast?: (type: 'success' | 'error' | 'info', message: string) => void;
}

interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: string;
}

const QUICK_PROMPTS = [
  'What are the most urgent deliverables due this week?',
  'Summarize team workload and identify who has capacity.',
  'Which projects currently have blockers and need escalation?',
  'Draft a polite status update message to send to client.',
];

export const AICopilotDrawer: React.FC<AICopilotDrawerProps> = ({
  isOpen,
  onClose,
  projects,
  tasks,
  teamMembers,
  currentUser,
  onOpenAISettings,
  onShowToast,
}) => {
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = localStorage.getItem('copilot_messages');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        id: 'welcome',
        role: 'model',
        content: `👋 Hello${currentUser?.name ? ' ' + currentUser.name.split(' ')[0] : ''}! I am your **UX/UI Project Copilot**, powered by **Google Gemini**.

I have full visibility into your active projects, deliverables, deadlines, and team workload. How can I help you today?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ];
  });

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Save messages to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('copilot_messages', JSON.stringify(messages));
    } catch {}
  }, [messages]);

  // Auto-scroll on new message
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || isLoading) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      // Build snapshot context
      const todayStr = new Date().toISOString().split('T')[0];
      const urgentTasks = tasks
        .filter((t) => (t.priority === 'Urgent' || t.priority === 'High') && t.status !== 'Completed')
        .slice(0, 10)
        .map((t) => `"${t.title}" (${t.status}, due ${t.dueDate || 'N/A'})`);

      const overdueTasks = tasks
        .filter((t) => t.dueDate && t.dueDate < todayStr && t.status !== 'Completed')
        .slice(0, 10)
        .map((t) => `"${t.title}" (past due ${t.dueDate})`);

      const blockedTasks = tasks
        .filter((t) => t.status === 'Blocked')
        .slice(0, 10)
        .map((t) => `"${t.title}" in ${projects.find((p) => p.id === t.projectId)?.name || 'Project'}`);

      const history: ChatHistoryItem[] = messages.slice(-8).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const reply = await chatWithCopilotApi({
        message: text,
        history,
        context: {
          projectsCount: projects.length,
          tasksCount: tasks.length,
          teamCount: teamMembers.length,
          activeProjects: projects.filter((p) => p.status !== 'Completed').map((p) => p.name),
          urgentTasks,
          overdueTasks,
          blockedTasks,
        },
      });

      const aiMsg: Message = {
        id: `model-${Date.now()}`,
        role: 'model',
        content: reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      const errorMsg: Message = {
        id: `error-${Date.now()}`,
        role: 'model',
        content: `⚠️ **Unable to complete request**: ${err.message}\n\n*Please ensure your Google Gemini API key is configured in AI Settings.*`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClearHistory = () => {
    setMessages([
      {
        id: 'welcome',
        role: 'model',
        content: `Conversation cleared. Ready for your next inquiry!`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    if (onShowToast) onShowToast('success', 'Copied to clipboard!');
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs transition-opacity animate-in fade-in"
      />

      {/* Drawer Panel */}
      <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col transition-transform animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-indigo-50/70 to-blue-50/50 dark:from-slate-900 dark:to-indigo-950/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 dark:bg-indigo-500 text-white flex items-center justify-center shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-none">
                  UX/UI Copilot
                </h3>
                <span className="text-3xs font-semibold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  Gemini AI
                </span>
              </div>
              <p className="text-3xs text-slate-500 dark:text-slate-400 mt-1">
                Context-aware assistant for your portfolio
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {currentUser?.role === 'admin' && onOpenAISettings && (
              <button
                type="button"
                onClick={onOpenAISettings}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-white/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="AI Settings & API Key"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={handleClearHistory}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-white/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Clear conversation"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-white/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close Copilot"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Live Context Strip */}
        <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-3xs text-slate-500 dark:text-slate-400 select-none">
          <span className="flex items-center gap-1 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Connected to Workspace Snapshot
          </span>
          <span>
            {projects.length} Projects • {tasks.length} Tasks • {teamMembers.length} Members
          </span>
        </div>

        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Quick Prompts */}
          {messages.length <= 2 && (
            <div className="space-y-1.5 pb-2">
              <span className="text-3xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Suggested Prompts
              </span>
              <div className="flex flex-col gap-1.5">
                {QUICK_PROMPTS.map((qp, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSend(qp)}
                    disabled={isLoading}
                    className="text-left text-xs p-2 rounded-lg bg-indigo-50/60 dark:bg-indigo-950/30 hover:bg-indigo-100/70 dark:hover:bg-indigo-900/40 text-indigo-900 dark:text-indigo-200 border border-indigo-200/60 dark:border-indigo-900/40 transition-colors flex items-center justify-between group cursor-pointer"
                  >
                    <span>{qp}</span>
                    <ArrowRight className="w-3 h-3 text-indigo-400 group-hover:translate-x-0.5 transition-transform shrink-0 ml-1.5" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Chat Messages */}
          {messages.map((m) => {
            const isUser = m.role === 'user';
            return (
              <div
                key={m.id}
                className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="w-7 h-7 rounded-lg bg-indigo-600 dark:bg-indigo-500 text-white flex items-center justify-center shrink-0 text-xs shadow-2xs mt-0.5">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                )}

                <div
                  className={`relative max-w-[85%] rounded-2xl p-3.5 text-xs ${
                    isUser
                      ? 'bg-blue-600 text-white rounded-br-xs shadow-2xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-bl-xs border border-slate-200/70 dark:border-slate-700 shadow-2xs'
                  }`}
                >
                  {isUser ? (
                    <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                  ) : (
                    <FormattedText
                      content={m.content}
                      className="leading-relaxed space-y-1.5"
                    />
                  )}

                  {/* Message Footer */}
                  <div
                    className={`flex items-center justify-between gap-2 mt-1 pt-1 text-3xs ${
                      isUser
                        ? 'text-blue-200 border-t border-blue-500/40'
                        : 'text-slate-400 border-t border-slate-200 dark:border-slate-700/60'
                    }`}
                  >
                    <span>{m.timestamp}</span>
                    {!isUser && (
                      <button
                        type="button"
                        onClick={() => handleCopyMessage(m.id, m.content)}
                        className="hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded transition-colors cursor-pointer"
                        title="Copy message text"
                      >
                        {copiedId === m.id ? (
                          <Check className="w-3 h-3 text-emerald-500" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {isUser && (
                  <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 text-xs shadow-2xs mt-0.5">
                    <User className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            );
          })}

          {/* Thinking Indicator */}
          {isLoading && (
            <div className="flex gap-2.5 items-center text-xs text-slate-500 dark:text-slate-400">
              <div className="w-7 h-7 rounded-lg bg-indigo-600 dark:bg-indigo-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              </div>
              <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-bl-xs border border-slate-200/70 dark:border-slate-700 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" />
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce delay-100" />
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce delay-200" />
                <span className="text-3xs font-medium ml-1">Copilot is thinking...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-3.5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="relative rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
            <textarea
              ref={inputRef}
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Copilot about projects, deadlines, team capacity..."
              className="w-full p-2.5 pr-12 text-xs bg-transparent text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden resize-none leading-relaxed"
            />

            <button
              type="button"
              onClick={() => handleSend()}
              disabled={!input.trim() || isLoading}
              className="absolute right-2 bottom-2 p-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
              title="Send message (Enter)"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center justify-between mt-1.5 px-1 text-3xs text-slate-400">
            <span>Press Enter to send, Shift+Enter for new line</span>
            <span>Gemini 2.5 Flash</span>
          </div>
        </div>
      </div>
    </>
  );
};
