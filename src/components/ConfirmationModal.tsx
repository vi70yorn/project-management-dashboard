import React from 'react';
import { AlertTriangle, Trash2, CheckCircle2, X, LogOut } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  details?: string[];
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  iconType?: 'alert' | 'trash' | 'logout';
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  message,
  details,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDestructive = false,
  iconType,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  const isDanger = isDestructive || iconType === 'logout' || iconType === 'trash';

  return (
    <div
      id="confirmation-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150"
    >
      <div
        id="confirmation-modal-container"
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
      >
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div
              className={`p-3 rounded-full shrink-0 ${
                isDanger
                  ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
                  : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400'
              }`}
            >
              {iconType === 'logout' ? (
                <LogOut className="w-6 h-6" />
              ) : isDestructive || iconType === 'trash' ? (
                <Trash2 className="w-6 h-6" />
              ) : (
                <AlertTriangle className="w-6 h-6" />
              )}
            </div>
            <div className="flex-1">
              <h3 id="confirmation-modal-title" className="text-lg font-semibold text-slate-900 dark:text-white">
                {title}
              </h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{message}</p>

              {details && details.length > 0 && (
                <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 space-y-1">
                  {details.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-500"></span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button
              id="close-confirmation-modal-btn"
              onClick={onCancel}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              id="confirmation-cancel-btn"
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              {cancelLabel}
            </button>
            <button
              id="confirmation-action-btn"
              type="button"
              onClick={onConfirm}
              className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors flex items-center gap-2 shadow-xs cursor-pointer ${
                isDanger
                  ? 'bg-rose-600 hover:bg-rose-700 focus:ring-2 focus:ring-rose-400'
                  : 'bg-blue-600 hover:bg-blue-700 focus:ring-2 focus:ring-blue-400'
              }`}
            >
              {iconType === 'logout' ? (
                <LogOut className="w-4 h-4" />
              ) : isDestructive || iconType === 'trash' ? (
                <Trash2 className="w-4 h-4" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
