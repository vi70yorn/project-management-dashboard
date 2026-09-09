import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  FileSpreadsheet,
  FileImage,
  File as FileIcon,
  UploadCloud,
  Download,
  ExternalLink,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  HardDrive,
  Cloud,
  Loader2,
  Info,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react';
import { DocumentAttachment, AuthUser, StorageConfigStatus } from '../types';
import {
  fetchAttachmentsApi,
  uploadAttachmentApi,
  deleteAttachmentApi,
  fetchStorageConfigStatusApi,
} from '../services/api';
import { formatDateTime } from '../utils/dateUtils';

interface DocumentAttachmentManagerProps {
  projectId?: string | null;
  taskId?: string | null;
  projectName?: string | null;
  taskTitle?: string | null;
  currentUser?: AuthUser | null;
  onAttachmentCountChange?: (count: number) => void;
  readOnly?: boolean;
  isCreateMode?: boolean;
  stagedFiles?: File[];
  onStagedFilesChange?: (files: File[]) => void;
}

const getFileTypeFromFileName = (name: string): DocumentAttachment['fileType'] => {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return 'pdf';
  if (ext === 'docx' || ext === 'doc') return 'word';
  if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') return 'excel';
  if (['png', 'jpg', 'jpeg', 'svg', 'webp', 'gif'].includes(ext || '')) return 'image';
  return 'other';
};

export const DocumentAttachmentManager: React.FC<DocumentAttachmentManagerProps> = ({
  projectId,
  taskId,
  projectName,
  taskTitle,
  currentUser,
  onAttachmentCountChange,
  readOnly = false,
  isCreateMode = false,
  stagedFiles = [],
  onStagedFilesChange,
}) => {
  const [attachments, setAttachments] = useState<DocumentAttachment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [storageStatus, setStorageStatus] = useState<StorageConfigStatus | null>(null);
  const [showSetupGuide, setShowSetupGuide] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = async () => {
    if (isCreateMode) {
      setIsLoading(true);
      try {
        const status = await fetchStorageConfigStatusApi().catch(() => null);
        if (status) setStorageStatus(status);
      } finally {
        setIsLoading(false);
      }
      onAttachmentCountChange?.(stagedFiles.length);
      return;
    }

    try {
      setIsLoading(true);
      const [items, status] = await Promise.all([
        fetchAttachmentsApi(projectId || undefined, taskId || undefined),
        fetchStorageConfigStatusApi().catch(() => null),
      ]);
      setAttachments(items || []);
      if (status) setStorageStatus(status);
      onAttachmentCountChange?.(items ? items.length : 0);
    } catch (err: any) {
      console.warn('[Attachments] Failed to load:', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [projectId, taskId, isCreateMode]);

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadError(null);
    setUploadSuccess(null);
    setIsUploading(true);

    if (isCreateMode) {
      const validFiles: File[] = [];
      const errors: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.size > 30 * 1024 * 1024) {
          errors.push(`"${file.name}" exceeds maximum allowed size of 30MB.`);
          continue;
        }
        validFiles.push(file);
      }
      if (validFiles.length > 0) {
        const updated = [...stagedFiles, ...validFiles];
        onStagedFilesChange?.(updated);
        onAttachmentCountChange?.(updated.length);
        setUploadSuccess(
          validFiles.length === 1
            ? `"${validFiles[0].name}" attached (ready to upload on save)`
            : `${validFiles.length} documents attached (ready to upload on save)`
        );
        setTimeout(() => setUploadSuccess(null), 4000);
      }
      if (errors.length > 0) setUploadError(errors.join(' '));
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const uploadedItems: DocumentAttachment[] = [];
    const errors: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Limit file size to 30MB
      if (file.size > 30 * 1024 * 1024) {
        errors.push(`"${file.name}" exceeds maximum allowed size of 30MB.`);
        continue;
      }

      try {
        const item = await uploadAttachmentApi({
          file,
          projectId: projectId || null,
          taskId: taskId || null,
          projectName: projectName || null,
          taskTitle: taskTitle || null,
          currentUser,
        });
        uploadedItems.push(item);
      } catch (err: any) {
        errors.push(`Failed to upload "${file.name}": ${err.message}`);
      }
    }

    if (uploadedItems.length > 0) {
      setAttachments((prev) => {
        const next = [...uploadedItems, ...prev];
        onAttachmentCountChange?.(next.length);
        return next;
      });
      setUploadSuccess(
        uploadedItems.length === 1
          ? `"${uploadedItems[0].fileName}" uploaded successfully!`
          : `${uploadedItems.length} documents uploaded successfully!`
      );
      setTimeout(() => setUploadSuccess(null), 4000);
    }

    if (errors.length > 0) {
      setUploadError(errors.join(' '));
    }

    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDeleteAttachment = async (attachment: DocumentAttachment) => {
    if (!confirm(`Are you sure you want to delete "${attachment.fileName}"?`)) return;

    try {
      await deleteAttachmentApi(attachment.id, currentUser);
      setAttachments((prev) => {
        const next = prev.filter((a) => a.id !== attachment.id);
        onAttachmentCountChange?.(next.length);
        return next;
      });
    } catch (err: any) {
      alert(`Could not delete attachment: ${err.message}`);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getFileBadge = (fileType: DocumentAttachment['fileType']) => {
    switch (fileType) {
      case 'pdf':
        return (
          <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 px-2 py-0.5 rounded text-3xs font-bold uppercase tracking-wider">
            <FileText className="w-3 h-3" />
            <span>PDF</span>
          </div>
        );
      case 'word':
        return (
          <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900/60 px-2 py-0.5 rounded text-3xs font-bold uppercase tracking-wider">
            <FileText className="w-3 h-3" />
            <span>Word</span>
          </div>
        );
      case 'excel':
        return (
          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900/60 px-2 py-0.5 rounded text-3xs font-bold uppercase tracking-wider">
            <FileSpreadsheet className="w-3 h-3" />
            <span>Excel</span>
          </div>
        );
      case 'image':
        return (
          <div className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-900/60 px-2 py-0.5 rounded text-3xs font-bold uppercase tracking-wider">
            <FileImage className="w-3 h-3" />
            <span>Image</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded text-3xs font-bold uppercase tracking-wider">
            <FileIcon className="w-3 h-3" />
            <span>Doc</span>
          </div>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Storage Provider Status Pill & Info */}
      {storageStatus && (
        <div className="flex items-center justify-between gap-3 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl p-3">
          <div className="flex items-center gap-2">
            {storageStatus.configured ? (
              <>
                <Cloud className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    Google Drive Storage Active
                  </span>
                  <span className="text-2xs text-slate-500 dark:text-slate-400 ml-1.5 hidden sm:inline">
                    Files sync automatically to your team Google Drive
                  </span>
                </div>
              </>
            ) : (
              <>
                <HardDrive className="w-4 h-4 text-amber-500 shrink-0" />
                <div>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    Local Storage Mode
                  </span>
                  <span className="text-2xs text-slate-500 dark:text-slate-400 ml-1.5">
                    (Ready to use! Connect Google Drive anytime in .env)
                  </span>
                </div>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowSetupGuide(!showSetupGuide)}
            className="inline-flex items-center gap-1 text-2xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer shrink-0"
          >
            <span>{showSetupGuide ? 'Hide Guide' : 'Setup Guide'}</span>
            {showSetupGuide ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      )}

      {/* Google Drive Setup Instructions Dropdown */}
      {showSetupGuide && (
        <div className="bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 rounded-xl p-4 text-xs space-y-3 text-slate-700 dark:text-slate-300">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              How to Connect Your Google Drive Folder (3 Quick Steps)
            </span>
            <button
              type="button"
              onClick={() => setShowSetupGuide(false)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <ol className="list-decimal list-inside space-y-1.5 text-2xs leading-relaxed">
            <li>
              Go to <strong className="text-blue-600 dark:text-blue-400">Google Cloud Console</strong> &rarr; Create a project &rarr; Enable <strong>Google Drive API</strong>.
            </li>
            <li>
              Create a <strong>Service Account</strong> (e.g. <code>pm-drive-bot@project.iam.gserviceaccount.com</code>), generate a JSON Key, and save it as <code>service-account.json</code> in your project folder.
            </li>
            <li>
              In your <strong>Google Drive</strong>, open or create a folder, click <strong>Share</strong>, and add your Service Account email as <strong>Editor</strong>.
            </li>
            <li>
              Copy the Folder ID from the URL (the string after <code>/folders/</code>) and add it to your <code>.env</code> file:
              <pre className="mt-1 p-2 bg-slate-900 text-emerald-400 rounded-lg overflow-x-auto text-3xs font-mono">
                GOOGLE_DRIVE_FOLDER_ID=1aBcDeFgHiJkLmNoPqRsTuVwXyZ
              </pre>
            </li>
          </ol>
        </div>
      )}

      {/* Upload Dropzone */}
      {!readOnly && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            handleFileUpload(e.dataTransfer.files);
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer ${
            isDragging
              ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/40 scale-[1.01]'
              : 'border-slate-200 dark:border-slate-700/80 hover:border-blue-400 dark:hover:border-blue-500/60 bg-white dark:bg-slate-900/60'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg"
            onChange={(e) => handleFileUpload(e.target.files)}
            className="hidden"
          />

          <div className="flex flex-col items-center justify-center gap-2">
            <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200/80 dark:border-blue-800/80 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-2xs">
              {isUploading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <UploadCloud className="w-5 h-5" />
              )}
            </div>
            <div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {isUploading ? 'Uploading Document to Storage...' : 'Click or Drag & Drop Documents here'}
              </span>
              <p className="text-2xs text-slate-500 dark:text-slate-400 mt-0.5">
                Supports Word (.docx, .doc), PDF (.pdf), Excel (.xlsx), images up to 30MB
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Toast Alerts */}
      {uploadSuccess && (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/80 rounded-xl text-xs font-semibold text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{uploadSuccess}</span>
        </div>
      )}

      {uploadError && (
        <div className="flex items-center gap-2 p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/80 rounded-xl text-xs font-semibold text-rose-700 dark:text-rose-300">
          <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}

      {/* Document List */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Attached Files ({isCreateMode ? stagedFiles.length : attachments.length})
          </span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
            <span>Loading documents...</span>
          </div>
        ) : isCreateMode ? (
          stagedFiles.length === 0 ? (
            <div className="p-8 text-center bg-slate-50/50 dark:bg-slate-900/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 text-xs">
              No documents attached yet. Click or drop Word, PDF, or Excel files above to attach them!
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
              {stagedFiles.map((file, idx) => {
                const fileType = getFileTypeFromFileName(file.name);
                return (
                  <div
                    key={`${file.name}-${idx}`}
                    className="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="shrink-0">{getFileBadge(fileType)}</div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-xs text-slate-900 dark:text-white truncate">
                          {file.name}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5 text-3xs text-slate-500 dark:text-slate-400">
                          <span>{formatFileSize(file.size)}</span>
                          <span>&bull;</span>
                          <span className="px-1.5 py-0.2 rounded font-semibold text-3xs bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60">
                            Ready to upload on save
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const next = stagedFiles.filter((_, i) => i !== idx);
                        onStagedFilesChange?.(next);
                        onAttachmentCountChange?.(next.length);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                      title="Remove document"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )
        ) : attachments.length === 0 ? (
          <div className="p-8 text-center bg-slate-50/50 dark:bg-slate-900/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 text-xs">
            No documents uploaded yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
            {attachments.map((file) => (
              <div
                key={file.id}
                className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors group"
              >
                {/* Left: Badge, Name, Size & Uploader */}
                <div className="flex items-start gap-3 min-w-0">
                  <div className="shrink-0 mt-0.5">{getFileBadge(file.fileType)}</div>
                  <div className="min-w-0 flex-1">
                    <a
                      href={file.webViewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-bold text-xs text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors line-clamp-1 flex items-center gap-1.5"
                      title={`Preview "${file.fileName}"`}
                    >
                      <span className="truncate">{file.fileName}</span>
                      <ExternalLink className="w-3 h-3 text-slate-400 shrink-0" />
                    </a>
                    <div className="flex items-center gap-2 mt-1 text-3xs text-slate-500 dark:text-slate-400 flex-wrap">
                      <span>{formatFileSize(file.fileSize)}</span>
                      <span>&bull;</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        {formatDateTime(file.createdAt)}
                      </span>
                      {file.uploadedByName && (
                        <>
                          <span>&bull;</span>
                          <span>by {file.uploadedByName}</span>
                        </>
                      )}
                      <span>&bull;</span>
                      <span className="inline-flex items-center gap-0.5 text-slate-400">
                        {file.storageProvider === 'google_drive' ? (
                          <>
                            <Cloud className="w-2.5 h-2.5 text-blue-500" />
                            <span>Google Drive</span>
                          </>
                        ) : (
                          <>
                            <HardDrive className="w-2.5 h-2.5 text-slate-500" />
                            <span>Local</span>
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-1.5 shrink-0 sm:self-center self-end">
                  {/* Open in Google Drive / Preview */}
                  <a
                    href={file.webViewLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-2xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200/60 dark:border-blue-800/60 transition-colors"
                    title={file.storageProvider === 'google_drive' ? 'Open in Google Drive preview' : 'View document'}
                  >
                    <span>{file.storageProvider === 'google_drive' ? 'Open in Drive' : 'Preview'}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>

                  {/* Direct Download */}
                  {file.downloadLink && (
                    <a
                      href={file.downloadLink}
                      download={file.fileName}
                      className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-slate-200/60 dark:border-slate-800/60"
                      title="Download file"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>
                  )}

                  {/* Delete (Admin or uploader) */}
                  {!readOnly && (currentUser?.role === 'admin' || currentUser?.memberId === file.uploadedBy) && (
                    <button
                      type="button"
                      onClick={() => handleDeleteAttachment(file)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                      title="Delete document"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

