import React, { useState, useEffect } from 'react';
import {
  X,
  Send,
  CheckCircle2,
  AlertCircle,
  Clock,
  KeyRound,
  MessageSquare,
  HelpCircle,
  ExternalLink,
  Sparkles,
  RefreshCw,
  Bell,
} from 'lucide-react';
import {
  fetchTelegramSettingsApi,
  updateTelegramSettingsApi,
  testTelegramApi,
  sendTelegramWeeklyReportApi,
  TelegramSettings,
} from '../services/api';

interface TelegramSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast?: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const TelegramSettingsModal: React.FC<TelegramSettingsModalProps> = ({
  isOpen,
  onClose,
  onShowToast,
}) => {
  const [settings, setSettings] = useState<TelegramSettings | null>(null);
  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [sendDay, setSendDay] = useState('Monday');
  const [sendTime, setSendTime] = useState('08:00');

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSendingReport, setIsSendingReport] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const data = await fetchTelegramSettingsApi();
      setSettings(data);
      setChatId(data.chatId || '');
      setEnabled(data.enabled);
      setSendDay(data.sendDay || 'Monday');
      setSendTime(data.sendTime || '08:00');
      setBotToken(''); // Don't expose token; user leaves blank to keep existing
    } catch (err: any) {
      if (onShowToast) onShowToast('error', 'Failed to load Telegram settings: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updated = await updateTelegramSettingsApi({
        botToken: botToken.trim() || undefined,
        chatId: chatId.trim(),
        enabled,
        sendDay,
        sendTime,
      });
      setSettings(updated);
      setBotToken('');
      if (onShowToast) {
        onShowToast('success', 'Telegram auto-report settings saved successfully!');
      }
      onClose();
    } catch (err: any) {
      if (onShowToast) onShowToast('error', err.message || 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    try {
      const res = await testTelegramApi(botToken.trim() || undefined, chatId.trim() || undefined);
      if (onShowToast) onShowToast('success', res.message || 'Test message sent to your Telegram!');
    } catch (err: any) {
      if (onShowToast) onShowToast('error', err.message || 'Test failed');
    } finally {
      setIsTesting(false);
    }
  };

  const handleSendReportNow = async () => {
    setIsSendingReport(true);
    try {
      const res = await sendTelegramWeeklyReportApi();
      if (onShowToast) onShowToast('success', res.message || 'Weekly report sent to Telegram!');
    } catch (err: any) {
      if (onShowToast) onShowToast('error', err.message || 'Failed to send report');
    } finally {
      setIsSendingReport(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500 text-white flex items-center justify-center shadow-xs">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Telegram Weekly Auto-Report
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Receive Project Weekly Summary every Monday morning
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Quick Status Banner */}
          <div
            className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs ${
              settings?.hasToken && settings?.chatId
                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300'
                : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {settings?.hasToken && settings?.chatId ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              )}
              <span>
                {settings?.hasToken && settings?.chatId
                  ? settings.enabled
                    ? `Active • Sends every Monday at ${settings.sendTime}`
                    : 'Telegram connected • Auto-send is currently disabled'
                  : 'Not fully configured. Add your Bot Token & Chat ID below.'}
              </span>
            </div>
            {settings?.lastSentAt && (
              <span className="text-3xs text-slate-500 dark:text-slate-400 shrink-0">
                Last sent: {new Date(settings.lastSentAt).toLocaleDateString()}
              </span>
            )}
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            {/* Bot Token Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-slate-400" />
                  <span>Telegram Bot Token</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowInstructions(!showInstructions)}
                  className="text-3xs font-semibold text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <HelpCircle className="w-3 h-3" />
                  <span>{showInstructions ? 'Hide Help' : 'How to get Bot Token?'}</span>
                </button>
              </div>
              <input
                type="password"
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                placeholder={
                  settings?.hasToken
                    ? `Current: ${settings.botTokenMasked} (leave blank to keep)`
                    : 'e.g. 123456789:ABCdefGhIJKlmNoPQRstuVWXyz'
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            {/* How-to Guide Callout */}
            {showInstructions && (
              <div className="p-3.5 bg-sky-50/60 dark:bg-sky-950/40 rounded-xl border border-sky-100 dark:border-sky-900/40 text-2xs space-y-2 text-slate-700 dark:text-slate-300">
                <p className="font-bold text-sky-800 dark:text-sky-300">
                  How to set up your Telegram Bot (Takes 1 minute):
                </p>
                <ol className="list-decimal list-inside space-y-1 pl-1">
                  <li>
                    Open Telegram, search for <b>@BotFather</b> and click <b>Start</b>.
                  </li>
                  <li>
                    Send the command <code className="bg-sky-100 dark:bg-sky-900 px-1 rounded">/newbot</code>, give it a name and a username ending in <code className="bg-sky-100 dark:bg-sky-900 px-1 rounded">bot</code>.
                  </li>
                  <li>
                    Copy the <b>HTTP API Token</b> and paste it into the Bot Token box above.
                  </li>
                  <li>
                    Search for <b>@userinfobot</b> in Telegram to get your personal <b>Id (Chat ID)</b>.
                  </li>
                  <li>
                    <b>Important:</b> Open a chat with your new bot and click <b>Start</b> so it has permission to message you!
                  </li>
                </ol>
              </div>
            )}

            {/* Chat ID Field */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Telegram Chat ID (Your User ID or Group ID)
              </label>
              <input
                type="text"
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
                placeholder="e.g. 123456789 or -100123456789"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              <p className="text-3xs text-slate-400 mt-1">
                Find your Chat ID by messaging @userinfobot or @RawDataBot in Telegram.
              </p>
            </div>

            {/* Test Connection Button */}
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={handleTest}
                disabled={isTesting || (!chatId && !settings?.chatId)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 hover:bg-sky-100 dark:hover:bg-sky-900 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isTesting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Sending Test...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    Send Test Message
                  </>
                )}
              </button>
            </div>

            <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Automated Schedule Settings
                </h4>
                {settings?.serverCurrentTime && (
                  <span className="text-3xs font-medium text-slate-400 dark:text-slate-500">
                    Server: {settings.serverCurrentDay} {settings.serverCurrentTime}
                  </span>
                )}
              </div>

              {/* Enable toggle */}
              <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/60">
                <div>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Enable Automated Report Delivery
                  </p>
                  <p className="text-2xs text-slate-500 dark:text-slate-400">
                    Automatically generates and delivers project summary to Telegram
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => setEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-500"></div>
                </label>
              </div>

              {/* Day & Time Configuration */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Delivery Day
                  </label>
                  <select
                    value={sendDay}
                    onChange={(e) => setSendDay(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
                  >
                    <option value="Monday">Every Monday (Weekly Report)</option>
                    <option value="Tuesday">Every Tuesday</option>
                    <option value="Wednesday">Every Wednesday</option>
                    <option value="Thursday">Every Thursday</option>
                    <option value="Friday">Every Friday</option>
                    <option value="Saturday">Every Saturday</option>
                    <option value="Sunday">Every Sunday</option>
                    <option value="Daily">Daily (Every Single Day)</option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      Delivery Time
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const now = new Date();
                        now.setMinutes(now.getMinutes() + 2);
                        const h = String(now.getHours()).padStart(2, '0');
                        const m = String(now.getMinutes()).padStart(2, '0');
                        setSendTime(`${h}:${m}`);
                        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                        setSendDay(dayNames[now.getDay()]);
                        setEnabled(true);
                      }}
                      className="text-3xs text-sky-600 dark:text-sky-400 hover:underline font-semibold cursor-pointer"
                      title="Set delivery to 2 minutes from now to test automated sending"
                    >
                      ⚡ Test in 2 min
                    </button>
                  </div>
                  <input
                    type="time"
                    value={sendTime}
                    onChange={(e) => setSendTime(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              {/* Active Schedule Status Banner */}
              {enabled && (
                <div className="p-3 rounded-xl bg-sky-50/70 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/80 text-xs text-sky-900 dark:text-sky-200 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <Clock className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                    <span>Automated Schedule Active</span>
                  </div>
                  <p className="text-2xs text-sky-800 dark:text-sky-300">
                    Will automatically dispatch to Telegram chat <b>{chatId || settings?.chatId}</b> every{' '}
                    <b>{sendDay}</b> at <b>{sendTime}</b>.
                  </p>
                  {settings?.lastSentAt && (
                    <p className="text-3xs text-slate-500 dark:text-slate-400">
                      Last Message Sent: {new Date(settings.lastSentAt).toLocaleString()}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/50">
          <button
            type="button"
            onClick={handleSendReportNow}
            disabled={isSendingReport || (!chatId && !settings?.chatId)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 cursor-pointer shadow-2xs"
          >
            {isSendingReport ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5 text-sky-500" />
                Send Weekly Report Now
              </>
            )}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-sky-500 hover:bg-sky-600 transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Settings'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

