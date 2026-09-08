import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  AlertOctagon,
  ShieldCheck,
  Sparkles,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  CheckCircle2,
  Users,
} from 'lucide-react';
import { Project, Task, TeamMember } from '../types';
import { analyzeProjectRisksApi, AIRiskAnalysisResult } from '../services/aiApi';

interface AIRiskRadarCardProps {
  projects: Project[];
  tasks: Task[];
  teamMembers: TeamMember[];
  onSelectProject?: (projectId: string) => void;
  onOpenTaskModal?: (task?: Task | null) => void;
  onShowToast?: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const AIRiskRadarCard: React.FC<AIRiskRadarCardProps> = ({
  projects,
  tasks,
  teamMembers,
  onShowToast,
}) => {
  const [analysis, setAnalysis] = useState<AIRiskAnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [lastAnalyzedAt, setLastAnalyzedAt] = useState<Date | null>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  // Quick initial analysis on mount or when projects/tasks change significantly
  useEffect(() => {
    // Only auto-run once if tasks exist
    if (!analysis && tasks.length > 0) {
      runAnalysis(false);
    }
  }, [tasks.length, projects.length]);

  const runAnalysis = async (userInitiated: boolean = true) => {
    setIsLoading(true);
    try {
      const result = await analyzeProjectRisksApi({
        projects: projects.map((p) => ({
          id: p.id,
          name: p.name,
          status: p.status,
          targetDeadline: p.targetDeadline,
        })),
        tasks: tasks.map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          assigneeName: teamMembers.find((m) => m.id === t.assigneeId)?.name,
          assigneeId: t.assigneeId,
          dueDate: t.dueDate,
          projectName: projects.find((p) => p.id === t.projectId)?.name,
        })),
        teamMembers: teamMembers.map((m) => ({
          id: m.id,
          name: m.name,
          role: m.role,
        })),
      });

      setAnalysis(result);
      setLastAnalyzedAt(new Date());
      if (userInitiated && onShowToast) {
        onShowToast('success', '✨ AI Risk & Workload Analysis refreshed!');
      }
    } catch (err: any) {
      if (userInitiated && onShowToast) {
        onShowToast('error', 'Failed to run AI risk analysis: ' + err.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const getHealthBadge = (health: string) => {
    if (health === 'Critical Risk') {
      return {
        label: 'Critical Risk',
        bg: 'bg-rose-50 dark:bg-rose-950/60',
        border: 'border-rose-300 dark:border-rose-800',
        text: 'text-rose-700 dark:text-rose-300',
        icon: <AlertOctagon className="w-4 h-4 text-rose-600 dark:text-rose-400" />,
        color: '#f43f5e',
      };
    }
    if (health === 'Moderate Risk') {
      return {
        label: 'Moderate Risk',
        bg: 'bg-amber-50 dark:bg-amber-950/60',
        border: 'border-amber-300 dark:border-amber-800',
        text: 'text-amber-700 dark:text-amber-300',
        icon: <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />,
        color: '#f59e0b',
      };
    }
    return {
      label: 'Healthy Portfolio',
      bg: 'bg-emerald-50 dark:bg-emerald-950/60',
      border: 'border-emerald-300 dark:border-emerald-800',
      text: 'text-emerald-700 dark:text-emerald-300',
      icon: <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />,
      color: '#10b981',
    };
  };

  const badge = analysis ? getHealthBadge(analysis.health) : getHealthBadge('Healthy');

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xs transition-all">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 dark:bg-indigo-500 text-white flex items-center justify-center shadow-2xs">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                AI Project Risk & Bottleneck Radar
              </h3>
              {analysis && (
                <span
                  className={`inline-flex items-center gap-1 text-2xs font-bold px-2 py-0.5 rounded-md border ${badge.bg} ${badge.border} ${badge.text}`}
                >
                  {badge.icon}
                  {badge.label}
                </span>
              )}
            </div>
            <p className="text-2xs text-slate-500 dark:text-slate-400 mt-0.5">
              Automated workload distribution, deadline risks, and blocked deliverables analyzed by Gemini AI.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => runAnalysis(true)}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Scanning Risks...</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh Radar</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title={isExpanded ? 'Collapse analysis' : 'Expand analysis'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Body Area */}
      {isLoading && !analysis ? (
        <div className="py-8 flex flex-col items-center justify-center text-center space-y-2">
          <Loader2 className="w-7 h-7 animate-spin text-indigo-600 dark:text-indigo-400" />
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
            Analyzing active deliverables, deadlines, and member workload...
          </p>
        </div>
      ) : analysis ? (
        isExpanded && (
          <div className="pt-4 space-y-4">
            {/* Score & Summary Banner */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center shadow-2xs shrink-0">
                  <span
                    className="text-base font-black leading-none"
                    style={{ color: badge.color }}
                  >
                    {analysis.healthScore}
                  </span>
                  <span className="text-3xs text-slate-400 font-semibold mt-0.5">/ 100</span>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Portfolio Health Score: {analysis.health}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">
                    {analysis.summary}
                  </p>
                </div>
              </div>

              {lastAnalyzedAt && (
                <span className="text-3xs text-slate-400 shrink-0 self-end md:self-center">
                  Updated {lastAnalyzedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>

            {/* Bottlenecks Grid */}
            {analysis.bottlenecks && analysis.bottlenecks.length > 0 ? (
              <div>
                <h4 className="text-2xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                  Identified Bottlenecks & Capacity Risks ({analysis.bottlenecks.length})
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {analysis.bottlenecks.map((bn, idx) => {
                    const isHigh = bn.severity === 'high';
                    const isMedium = bn.severity === 'medium';
                    return (
                      <div
                        key={idx}
                        className={`p-3.5 rounded-xl border transition-all ${
                          isHigh
                            ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/60'
                            : isMedium
                            ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/60'
                            : 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/60'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {bn.title}
                          </span>
                          <span
                            className={`text-3xs uppercase tracking-wider font-bold px-1.5 py-0.5 rounded-md ${
                              isHigh
                                ? 'bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300'
                                : isMedium
                                ? 'bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300'
                                : 'bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300'
                            }`}
                          >
                            {bn.severity} risk
                          </span>
                        </div>

                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-2">
                          {bn.description}
                        </p>

                        <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-start gap-1.5 text-2xs font-medium text-slate-700 dark:text-slate-300">
                          <ArrowRight className="w-3 h-3 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                          <span>
                            <strong>Suggested Action:</strong> {bn.suggestion}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800/60 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>No severe capacity bottlenecks or overdue risks detected across the portfolio.</span>
              </div>
            )}

            {/* Strategic Recommendations */}
            {analysis.recommendations && analysis.recommendations.length > 0 && (
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/70 dark:border-slate-700/70">
                <h4 className="text-2xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  AI Strategic Recommendations
                </h4>
                <ul className="space-y-1 text-xs text-slate-700 dark:text-slate-300">
                  {analysis.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-indigo-600 dark:text-indigo-400 font-bold">•</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )
      ) : (
        <div className="pt-3 flex items-center justify-between gap-4 text-xs text-slate-600 dark:text-slate-400">
          <span>
            Click <strong>Refresh Radar</strong> above to trigger an AI capacity and bottleneck analysis with Google Gemini.
          </span>
        </div>
      )}
    </div>
  );
};

