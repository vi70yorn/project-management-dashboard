/**
 * Utility functions for generating direct share links and copying to clipboard
 */

export function getProjectShareUrl(projectId: string): string {
  if (typeof window === 'undefined') return `?projectId=${projectId}`;
  const origin = window.location.origin;
  const pathname = window.location.pathname;
  return `${origin}${pathname}?projectId=${encodeURIComponent(projectId)}`;
}

export function getTaskShareUrl(projectId: string, taskId: string): string {
  if (typeof window === 'undefined') return `?projectId=${projectId}&taskId=${taskId}`;
  const origin = window.location.origin;
  const pathname = window.location.pathname;
  return `${origin}${pathname}?projectId=${encodeURIComponent(projectId)}&taskId=${encodeURIComponent(taskId)}`;
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    console.warn('[Clipboard API failed, falling back to execCommand]', err);
  }

  // Fallback for older browsers or restricted contexts
  try {
    if (typeof document !== 'undefined') {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.top = '0';
      textArea.style.left = '0';
      textArea.style.opacity = '0';
      textArea.style.pointerEvents = 'none';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      return successful;
    }
  } catch (err) {
    console.error('[execCommand copy failed]', err);
  }

  return false;
}
