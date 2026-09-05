import React, { useState } from 'react';
import { Database, CheckCircle2, AlertTriangle, RefreshCw, X, ExternalLink, Copy, Check } from 'lucide-react';
import { DatabaseHealthResponse } from '../services/api';

interface DatabaseStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  health: DatabaseHealthResponse | null;
  onRefresh: () => void;
  isRefreshing?: boolean;
}

export const DatabaseStatusModal: React.FC<DatabaseStatusModalProps> = ({
  isOpen,
  onClose,
  health,
  onRefresh,
  isRefreshing = false,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  const isConnected = health?.connected ?? false;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-xs ${
                isConnected ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
              }`}
            >
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">PostgreSQL & DBeaver Status</h3>
              <p className="text-xs text-slate-500">Database connectivity and management info</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Status Alert Banner */}
          <div
            className={`p-4 rounded-xl border flex items-start gap-3.5 ${
              isConnected
                ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                : 'bg-amber-50/80 border-amber-200 text-amber-900'
            }`}
          >
            {isConnected ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 text-xs">
              <div className="font-bold text-sm mb-0.5">
                {isConnected
                  ? 'Connected to PostgreSQL Database'
                  : 'Backend API / PostgreSQL Disconnected'}
              </div>
              <p className="leading-relaxed opacity-90">
                {isConnected
                  ? `Successfully queried PostgreSQL database "${health?.database || 'project_management'}" on localhost:5432. All changes in this dashboard persist directly to PostgreSQL.`
                  : health?.message ||
                    'The dashboard is running in offline fallback mode (localStorage). Start the API server via "npm run server" or check your PostgreSQL credentials in .env.'}
              </p>
              {health?.counts && isConnected && (
                <div className="mt-3 pt-2.5 border-t border-emerald-200/60 flex items-center gap-4 text-2xs font-semibold text-emerald-800">
                  <span>📁 Projects in DB: <strong>{health.counts.projects}</strong></span>
                  <span>⚡ Tasks in DB: <strong>{health.counts.tasks}</strong></span>
                  <span>👥 Team Members in DB: <strong>{health.counts.members}</strong></span>
                </div>
              )}
            </div>
          </div>

          {/* DBeaver Connection Details Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  DBeaver Connection Parameters
                </span>
                <span className="px-2 py-0.5 rounded-full text-3xs font-semibold bg-blue-100 text-blue-700">
                  Port 5432
                </span>
              </div>
              <span className="text-2xs text-slate-500 font-medium">PostgreSQL 18</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 bg-white rounded-lg border border-slate-200 flex flex-col justify-between">
                <span className="text-2xs font-semibold text-slate-400">HOST</span>
                <div className="flex items-center justify-between font-mono font-semibold text-slate-800 mt-1">
                  <span>localhost</span>
                  <button
                    onClick={() => copyToClipboard('localhost', 'host')}
                    className="text-slate-400 hover:text-slate-700"
                    title="Copy"
                  >
                    {copiedKey === 'host' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="p-2.5 bg-white rounded-lg border border-slate-200 flex flex-col justify-between">
                <span className="text-2xs font-semibold text-slate-400">PORT</span>
                <div className="flex items-center justify-between font-mono font-semibold text-slate-800 mt-1">
                  <span>5432</span>
                  <button
                    onClick={() => copyToClipboard('5432', 'port')}
                    className="text-slate-400 hover:text-slate-700"
                    title="Copy"
                  >
                    {copiedKey === 'port' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="p-2.5 bg-white rounded-lg border border-slate-200 flex flex-col justify-between">
                <span className="text-2xs font-semibold text-slate-400">DATABASE</span>
                <div className="flex items-center justify-between font-mono font-semibold text-slate-800 mt-1">
                  <span>project_management</span>
                  <button
                    onClick={() => copyToClipboard('project_management', 'db')}
                    className="text-slate-400 hover:text-slate-700"
                    title="Copy"
                  >
                    {copiedKey === 'db' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="p-2.5 bg-white rounded-lg border border-slate-200 flex flex-col justify-between">
                <span className="text-2xs font-semibold text-slate-400">USERNAME</span>
                <div className="flex items-center justify-between font-mono font-semibold text-slate-800 mt-1">
                  <span>postgres</span>
                  <button
                    onClick={() => copyToClipboard('postgres', 'user')}
                    className="text-slate-400 hover:text-slate-700"
                    title="Copy"
                  >
                    {copiedKey === 'user' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Steps for DBeaver */}
          <div className="text-xs text-slate-600 space-y-2">
            <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
              <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
              How to connect DBeaver Community:
            </h4>
            <ol className="list-decimal list-inside space-y-1 pl-1 text-slate-600 leading-relaxed text-2xs sm:text-xs">
              <li>Open <strong>DBeaver Community</strong> from your Start Menu.</li>
              <li>Click the <strong>New Database Connection</strong> icon (top left plug) or press <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded font-mono text-3xs">Ctrl+Shift+N</kbd>.</li>
              <li>Select <strong>PostgreSQL</strong> and click <strong>Next</strong>.</li>
              <li>Enter <strong>Host</strong>: <code className="text-blue-600 font-semibold">localhost</code>, <strong>Database</strong>: <code className="text-blue-600 font-semibold">project_management</code>, <strong>Username</strong>: <code className="text-blue-600 font-semibold">postgres</code>.</li>
              <li>Type the password you created during PostgreSQL installation.</li>
              <li>Click <strong>Test Connection ...</strong> (download driver if prompted) and click <strong>Finish</strong>!</li>
              <li>Under <strong>Schemas &gt; public &gt; Tables</strong>, view <code className="font-semibold">projects</code>, <code className="font-semibold">tasks</code>, <code className="font-semibold">team_members</code>.</li>
            </ol>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 shadow-2xs transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Checking Connection...' : 'Test / Refresh Connection'}</span>
          </button>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
