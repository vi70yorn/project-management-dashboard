import React, { useState, useEffect } from 'react';
import {
  X,
  Share2,
  Lock,
  Globe,
  Users,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  Eye,
  EyeOff,
  Calendar,
  ShieldAlert,
  FileCheck,
  BarChart2,
  Clock,
  Sparkles,
  Layers,
} from 'lucide-react';
import { Project, ProjectShareConfig, AuthUser } from '../types';
import { getProjectShareUrl, copyTextToClipboard } from '../utils/shareUtils';
import {
  fetchProjectShareConfigApi,
  saveProjectShareConfigApi,
  revokeProjectShareLinkApi,
} from '../services/api';
import { FORM_STYLES } from '../utils/formStyles';
import { formatDateTime } from '../utils/dateUtils';

interface ShareProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  currentUser?: AuthUser | null;
  onShowToast?: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const ShareProjectModal: React.FC<ShareProjectModalProps> = ({
  isOpen,
  onClose,
  project,
  currentUser,
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<'client' | 'internal'>('client');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [shareConfig, setShareConfig] = useState<ProjectShareConfig | null>(null);

  // Form states for client share
  const [isEnabled, setIsEnabled] = useState(true);
  const [usePasscode, setUsePasscode] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [showPasscodeText, setShowPasscodeText] = useState(false);
  const [expiryPreset, setExpiryPreset] = useState<'never' | '7d' | '30d' | 'custom'>('never');
  const [customExpiryDate, setCustomExpiryDate] = useState('');
  const [showTasks, setShowTasks] = useState(true);
  const [showAttachments, setShowAttachments] = useState(true);

  // Copy status
  const [copiedClientLink, setCopiedClientLink] = useState(false);
  const [copiedInternalLink, setCopiedInternalLink] = useState(false);

  // Load existing share configuration
  useEffect(() => {
    if (!isOpen || !project?.id) return;

    let isMounted = true;
    setIsLoading(true);

    fetchProjectShareConfigApi(project.id, currentUser)
      .then((res) => {
        if (!isMounted) return;
        if (res.exists && res.config) {
          setShareConfig(res.config);
          setIsEnabled(res.config.isEnabled);
          setUsePasscode(res.config.hasPassword);
          setShowTasks(res.config.showTasks);
          setShowAttachments(res.config.showAttachments);

          if (res.config.expiresAt) {
            const expDate = new Date(res.config.expiresAt);
            setExpiryPreset('custom');
            setCustomExpiryDate(expDate.toISOString().split('T')[0]);
          } else {
            setExpiryPreset('never');
            setCustomExpiryDate('');
          }
        } else {
          // Defaults for new share link
          setShareConfig(null);
          setIsEnabled(true);
          setUsePasscode(false);
          setPasscode('');
          setExpiryPreset('never');
          setShowTasks(true);
          setShowAttachments(true);
        }
      })
      .catch((err) => {
        console.warn('Failed to load share settings:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, project?.id]);

  if (!isOpen) return null;

  // Build URLs
  const internalShareUrl = getProjectShareUrl(project.id);
  const clientShareUrl = shareConfig?.shareToken
    ? `${window.location.origin}${window.location.pathname}?shareToken=${shareConfig.shareToken}`
    : '';

  const handleCopyInternal = async () => {
    const ok = await copyTextToClipboard(internalShareUrl);
    if (ok) {
      setCopiedInternalLink(true);
      setTimeout(() => setCopiedInternalLink(false), 2000);
      onShowToast?.('success', 'Internal project link copied to clipboard!');
    }
  };

  const handleCopyClient = async () => {
    if (!clientShareUrl) return;
    const ok = await copyTextToClipboard(clientShareUrl);
    if (ok) {
      setCopiedClientLink(true);
      setTimeout(() => setCopiedClientLink(false), 2000);
      onShowToast?.('success', 'Client Portal link copied to clipboard!');
    }
  };

  const calculateExpiryDate = (): string | null => {
    if (expiryPreset === 'never') return null;
    const date = new Date();
    if (expiryPreset === '7d') {
      date.setDate(date.getDate() + 7);
      return date.toISOString();
    }
    if (expiryPreset === '30d') {
      date.setDate(date.getDate() + 30);
      return date.toISOString();
    }
    if (expiryPreset === 'custom' && customExpiryDate) {
      const custom = new Date(customExpiryDate);
      custom.setHours(23, 59, 59, 999);
      return custom.toISOString();
    }
    return null;
  };

  const handleSaveConfig = async (regenerate = false) => {
    setIsSaving(true);
    try {
      const calculatedExpiry = calculateExpiryDate();
      const payload: any = {
        isEnabled,
        expiresAt: calculatedExpiry,
        showTasks,
        showAttachments,
        regenerateToken: regenerate,
      };

      if (usePasscode) {
        if (passcode.trim()) {
          payload.passcode = passcode.trim();
        }
      } else if (shareConfig?.hasPassword) {
        payload.removePassword = true;
      }

      const res = await saveProjectShareConfigApi(project.id, payload, currentUser);
      if (res.success && res.config) {
        setShareConfig(res.config);
        setIsEnabled(res.config.isEnabled);
        setUsePasscode(res.config.hasPassword);
        setPasscode('');
        onShowToast?.(
          'success',
          regenerate
            ? 'New link generated successfully! Previous link was invalidated.'
            : 'Client share settings saved successfully!'
        );
      }
    } catch (err: any) {
      onShowToast?.('error', err.message || 'Failed to save share settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisableLink = async () => {
    setIsSaving(true);
    try {
      await revokeProjectShareLinkApi(project.id, currentUser);
      setIsEnabled(false);
      if (shareConfig) {
        setShareConfig({ ...shareConfig, isEnabled: false });
      }
      onShowToast?.('info', 'Client share link has been disabled.');
    } catch (err: any) {
      onShowToast?.('error', err.message || 'Failed to disable share link');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      id="share-project-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center glass-modal-backdrop p-3 sm:p-4 animate-in fade-in duration-150"
    >
      <div
        id="share-project-modal-container"
        className="w-full max-w-xl glass-modal rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-200/80 dark:border-slate-800 animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Share Project
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  {project.name}
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Generate links for internal team members or external clients
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-5 pt-3 gap-2 bg-white dark:bg-slate-900 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('client')}
            className={`pb-2.5 px-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'client'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Globe className="w-4 h-4" />
            Client Read-Only Portal
            <span className="px-1.5 py-0.2 rounded-full text-3xs font-bold uppercase tracking-wider bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
              New
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('internal')}
            className={`pb-2.5 px-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'internal'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            Internal Team Link
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1 custom-scrollbar">
          {activeTab === 'internal' ? (
            /* =========================================================
               INTERNAL TEAM LINK TAB
               ========================================================= */
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
                <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2 mb-1">
                  <Lock className="w-4 h-4 text-amber-500" />
                  Authenticated Staff Access Only
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  This direct link opens the full workspace for team members. Anyone opening it must log in with their staff or admin account.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Direct Internal URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={internalShareUrl}
                    className={`${FORM_STYLES.input} font-mono text-2xs select-all`}
                  />
                  <button
                    type="button"
                    onClick={handleCopyInternal}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors shrink-0 shadow-2xs cursor-pointer"
                  >
                    {copiedInternalLink ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-300" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* =========================================================
               CLIENT READ-ONLY PORTAL TAB
               ========================================================= */
            <div className="space-y-5">
              {isLoading ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-500">
                  <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
                  <span className="text-xs">Loading client share configuration...</span>
                </div>
              ) : (
                <>
                  {/* Enable / Disable Master Switch */}
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2 rounded-lg ${
                          isEnabled
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                            : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                        }`}
                      >
                        <Globe className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-900 dark:text-white block">
                          Client Portal Link
                        </span>
                        <span className="text-2xs text-slate-500 dark:text-slate-400">
                          {isEnabled
                            ? 'Anyone with this link can view sanitized project status'
                            : 'Public access is disabled'}
                        </span>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={(e) => setIsEnabled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  {/* Share URL Box */}
                  {shareConfig?.shareToken ? (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          Public Client Link
                        </label>
                        {shareConfig.viewCount > 0 && (
                          <span className="text-2xs font-medium text-slate-500 flex items-center gap-1">
                            <BarChart2 className="w-3 h-3 text-blue-500" />
                            {shareConfig.viewCount} {shareConfig.viewCount === 1 ? 'view' : 'views'}
                            {shareConfig.lastViewedAt && (
                              <span>&bull; Last seen {formatDateTime(shareConfig.lastViewedAt)}</span>
                            )}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          readOnly
                          value={clientShareUrl}
                          className={`${FORM_STYLES.input} font-mono text-2xs select-all`}
                        />
                        <button
                          type="button"
                          onClick={handleCopyClient}
                          disabled={!isEnabled}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition-colors shrink-0 shadow-2xs cursor-pointer"
                        >
                          {copiedClientLink ? (
                            <>
                              <Check className="w-4 h-4 text-emerald-300" />
                              <span>Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-4 h-4" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                        <a
                          href={clientShareUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/70 text-slate-700 dark:text-slate-200 transition-colors shadow-2xs"
                          title="Open Client Portal in new tab"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-900/60 flex items-start gap-3">
                      <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-xs font-bold text-blue-900 dark:text-blue-200">
                          Create Client Portal Link
                        </h4>
                        <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                          Configure your security settings below and click &quot;Generate Client Link&quot; to create a shareable presentation portal.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Security: Passcode Protection */}
                  <div className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-slate-500" />
                        Passcode Protection
                      </label>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={usePasscode}
                          onChange={(e) => setUsePasscode(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    {usePasscode && (
                      <div className="space-y-2 animate-in fade-in duration-150">
                        {shareConfig?.hasPassword && !passcode && (
                          <div className="flex items-center gap-2 text-2xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800/60">
                            <Check className="w-3.5 h-3.5" />
                            <span>A passcode is currently active. Enter a new one below to change it.</span>
                          </div>
                        )}
                        <div className="relative">
                          <input
                            type={showPasscodeText ? 'text' : 'password'}
                            value={passcode}
                            onChange={(e) => setPasscode(e.target.value)}
                            placeholder={shareConfig?.hasPassword ? 'Keep existing or type new passcode...' : 'Enter client passcode (e.g. client2026)'}
                            className={`${FORM_STYLES.input} pr-10`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPasscodeText(!showPasscodeText)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                          >
                            {showPasscodeText ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Expiration Settings */}
                  <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      Link Expiration
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { id: 'never', label: 'Never' },
                        { id: '7d', label: '7 Days' },
                        { id: '30d', label: '30 Days' },
                        { id: 'custom', label: 'Custom' },
                      ].map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => setExpiryPreset(preset.id as any)}
                          className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                            expiryPreset === preset.id
                              ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-500 text-blue-600 dark:text-blue-400 shadow-2xs'
                              : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                    {expiryPreset === 'custom' && (
                      <input
                        type="date"
                        value={customExpiryDate}
                        onChange={(e) => setCustomExpiryDate(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                        className={FORM_STYLES.input}
                      />
                    )}
                  </div>

                  {/* Visibility Controls */}
                  <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-slate-500" />
                      Client Visibility Permissions
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showTasks}
                          onChange={(e) => setShowTasks(e.target.checked)}
                          className="rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span>Display Deliverables &amp; Milestone Tasks</span>
                      </label>
                      <label className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showAttachments}
                          onChange={(e) => setShowAttachments(e.target.checked)}
                          className="rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span>Display Project Attachments &amp; Document Previews</span>
                      </label>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 flex-wrap">
                    {shareConfig?.shareToken ? (
                      <button
                        type="button"
                        onClick={() => handleSaveConfig(true)}
                        disabled={isSaving}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                        title="Invalidate old link and generate a brand new token"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isSaving ? 'animate-spin' : ''}`} />
                        Regenerate Token
                      </button>
                    ) : (
                      <div />
                    )}

                    <div className="flex items-center gap-2 ml-auto">
                      <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveConfig(false)}
                        disabled={isSaving}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {isSaving ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Saving...</span>
                          </>
                        ) : (
                          <span>{shareConfig ? 'Save Settings' : 'Generate Client Link'}</span>
                        )}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

